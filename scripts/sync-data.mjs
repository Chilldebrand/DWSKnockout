import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const SEASON = 2026
const TOTAL_WEEKS = 18
// League rule: player who fails to submit a pick loses when all Week N games finish
const MISSED_PICK_IS_LOSS = true
const DRY_RUN = process.env.DRY_RUN === '1'

const ESPN_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

// ESPN ignores week/seasontype params on this endpoint, so we scan
// 7-day date windows and filter events by their own season/week metadata.
const WINDOW_START = '20260901'
const WINDOW_END = '20270120'

function* dateWindows(from, to, days = 7) {
  let cur = new Date(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}T00:00Z`)
  const end = new Date(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}T00:00Z`)
  while (cur < end) {
    const next = new Date(Math.min(cur.getTime() + days * 86400000, end.getTime()))
    const fmt = (d) => d.toISOString().slice(0, 10).replaceAll('-', '')
    yield [fmt(cur), fmt(next)]
    cur = next
  }
}

async function fetchWindow(from, to) {
  const url = `${ESPN_BASE}?dates=${from}-${to}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${from}-${to}`)
  return res.json()
}

function normColor(c) {
  if (!c || typeof c !== 'string') return undefined
  return c.startsWith('#') ? c : `#${c}`
}

function parseRecords(event) {
  const comp = event.competitions[0]
  const out = {}
  for (const c of comp.competitors) {
    const rec = (c.records ?? []).find((r) => r.type === 'total')?.summary ?? ''
    const m = rec.match(/^(\d+)-(\d+)(?:-(\d+))?/)
    out[c.team.abbreviation] = {
      w: m ? +m[1] : 0,
      l: m ? +m[2] : 0,
      t: m ? +(m[3] ?? 0) : 0,
      logo: c.team.logo ?? null,
      // Full row needed: Postgres validates NOT NULL columns even on
      // the update path of an upsert
      name: c.team.name ?? c.team.abbreviation,
      display: c.team.displayName ?? c.team.abbreviation,
      color: normColor(c.team.color),
      alt_color: normColor(c.team.alternateColor),
    }
  }
  return out
}

function parseGame(event, week) {
  const comp = event.competitions[0]
  const home = comp.competitors.find((c) => c.homeAway === 'home')
  const away = comp.competitors.find((c) => c.homeAway === 'away')
  if (!home || !away) return null

  const status = event.status?.type?.state ?? 'pre' // pre | in | post
  const gameStatus =
    status === 'post' ? 'final' : status === 'in' ? 'in_progress' : 'scheduled'

  let winner = null
  if (gameStatus === 'final') {
    const hs = parseInt(home.score ?? -1, 10)
    const as = parseInt(away.score ?? -1, 10)
    winner = hs > as ? home.team.abbreviation : hs < as ? away.team.abbreviation : 'TIE'
  }

  const odds = comp.odds?.[0]
  let favorite = null
  let spread = null
  let overUnder = null
  if (odds) {
    overUnder = odds.overUnder ?? null
    spread = odds.spread ?? null // home-relative
    favorite =
      odds.homeTeamOdds?.favorite
        ? home.team.abbreviation
        : odds.awayTeamOdds?.favorite
          ? away.team.abbreviation
          : null
  }

  return {
    id: event.id,
    season: SEASON,
    week,
    kickoff: event.date,
    home_team: home.team.abbreviation,
    away_team: away.team.abbreviation,
    favorite,
    spread,
    over_under: overUnder,
    status: gameStatus,
    home_score: gameStatus === 'scheduled' ? null : parseInt(home.score, 10),
    away_score: gameStatus === 'scheduled' ? null : parseInt(away.score, 10),
    winner,
  }
}

async function main() {
  console.log(`Syncing ${SEASON} season…`)

  const teamUpdates = new Map() // abbr -> {w,l,t,logo}
  const eventsById = new Map() // dedupe across overlapping windows

  for (const [from, to] of dateWindows(WINDOW_START, WINDOW_END)) {
    try {
      const data = await fetchWindow(from, to)
      let kept = 0
      for (const ev of data.events ?? []) {
        const s = ev.season ?? {}
        // Regular season of our year only — skips preseason & playoffs
        if (s.year !== SEASON || s.type !== 2) continue
        const weekNum = ev.week?.number
        if (!weekNum || weekNum < 1 || weekNum > TOTAL_WEEKS) continue
        if (eventsById.has(ev.id)) continue

        eventsById.set(ev.id, { ev, week: weekNum })
        for (const [abbr, rec] of Object.entries(parseRecords(ev))) {
          teamUpdates.set(abbr, rec)
        }
        kept++
      }
      console.log(`Window ${from}-${to}: ${data.events?.length ?? 0} raw, ${kept} regular-season kept`)
    } catch (err) {
      console.error(`Window ${from}-${to} failed: ${err.message}`)
    }
  }

  const games = []
  for (const { ev, week } of eventsById.values()) {
    const g = parseGame(ev, week)
    if (g) games.push(g)
  }

  if (!games.length) {
    console.log('No games found — aborting.')
    process.exit(1)
  }

  // Upsert games (odds refresh happens here every run = daily spread updates)
  if (DRY_RUN) {
    const byWeek = {}
    for (const g of games) (byWeek[g.week] ??= []).push(g)
    for (const w of Object.keys(byWeek))
      console.log(
        `Week ${w}: ${byWeek[w].length} games, e.g. ${byWeek[w][0].away_team}@${byWeek[w][0].home_team} fav=${byWeek[w][0].favorite} spread=${byWeek[w][0].spread}`,
      )
    console.log(`DRY RUN — would upsert ${games.length} games and ${teamUpdates.size} team records`)
    return
  }

  const { error: gErr } = await supabase.from('games').upsert(games, {
    onConflict: 'id',
  })
  if (gErr) throw gErr
  console.log(`Upserted ${games.length} games`)

  // Update team records
  if (teamUpdates.size) {
    const rows = [...teamUpdates.entries()].map(([id, r]) => ({
      id,
      name: r.name,
      display: r.display,
      color: r.color ?? '#333333',
      alt_color: r.alt_color ?? '#999999',
      logo: r.logo,
      wins: r.w,
      losses: r.l,
      ties: r.t,
    }))
    const { error } = await supabase.from('teams').upsert(rows, { onConflict: 'id' })
    if (error) throw error
    console.log(`Updated records for ${rows.length} teams`)
  }

  // Grade picks for final games
  const finals = games.filter((g) => g.status === 'final' && g.winner && g.winner !== 'TIE')
  let graded = 0
  for (const g of finals) {
    const { data: picks, error: pErr } = await supabase
      .from('picks')
      .select('id, user_id, team, result')
      .eq('game_id', g.id)
    if (pErr) throw pErr

    for (const p of picks ?? []) {
      const result = p.team === g.winner ? 'win' : 'loss'
      if (p.result !== result) {
        const { error } = await supabase
          .from('picks')
          .update({ result })
          .eq('id', p.id)
        if (error) console.error(`pick ${p.id}: ${error.message}`)
        else graded++
        if (result === 'loss') {
          await supabase
            .from('profiles')
            .update({ eliminated_week: g.week })
            .eq('id', p.user_id)
            .is('eliminated_week', null)
        }
      }
    }
  }
  console.log(`Graded ${graded} picks`)

  // Missed-pick enforcement: once every game of a week is final,
  // anyone without a pick that week takes the loss
  if (MISSED_PICK_IS_LOSS) {
    for (let week = 1; week <= TOTAL_WEEKS; week++) {
      const weekGames = games.filter((g) => g.week === week)
      if (!weekGames.length || !weekGames.every((g) => g.status === 'final')) continue

      const { data: aliveProfiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .is('eliminated_week', null)
      const { data: weekPicks } = await supabase
        .from('picks')
        .select('user_id, result')
        .eq('season', SEASON)
        .eq('week', week)

      const pickers = new Map((weekPicks ?? []).map((p) => [p.user_id, p]))
      const losers = (aliveProfiles ?? []).filter(
        (pr) => !pickers.has(pr.id) || pickers.get(pr.id).result !== 'win',
      )
      // Only eliminate non-pickers here; pickers already handled above
      for (const pr of losers.filter((l) => !pickers.has(l.id))) {
        await supabase
          .from('profiles')
          .update({ eliminated_week: week })
          .eq('id', pr.id)
          .is('eliminated_week', null)
        console.log(`${pr.display_name}: no pick week ${week} — ELIMINATED`)
      }
    }
  }

  // Champion check: one player left standing after final week completes
  const { data: alive } = await supabase
    .from('profiles')
    .select('display_name')
    .is('eliminated_week', null)
  if ((alive ?? []).length <= 1) {
    console.log(
      alive?.length === 1
        ? `🏆 LEAGUE WINNER: ${alive[0].display_name}`
        : 'League complete.',
    )
  }

  console.log('Sync complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
