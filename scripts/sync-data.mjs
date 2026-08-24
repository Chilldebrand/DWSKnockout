import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const SEASON = 2026
const REG_SEASON_WEEKS = 18
const PLAYOFF_WEEKS = [19, 20, 21, 22] // Wild Card, Divisional, Conf Championships, Super Bowl
// League rule: missed pick = random unused team from a game kicking off within
// ASSIGNMENT_WINDOW hours; eliminated only if the whole week passes with no pick
const ASSIGNMENT_WINDOW_HOURS = 24
const DRY_RUN = process.env.DRY_RUN === '1'

const ESPN_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

// ESPN ignores week/seasontype params on this endpoint, so we scan
// 7-day date windows and filter events by their own season/week metadata.
// Extends through the Super Bowl to support playoff extension rounds.
const WINDOW_START = '20260901'
const WINDOW_END = '20270215'

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
        // Regular season (type 2, weeks 1-18) and playoffs (type 3, weeks 19+)
        const isRegular = s.year === SEASON && s.type === 2 && ev.week?.number >= 1 && ev.week?.number <= REG_SEASON_WEEKS
        const isPlayoff = s.year === SEASON && s.type === 3 && PLAYOFF_WEEKS.includes(ev.week?.number)
        if (!isRegular && !isPlayoff) continue
        const weekNum = ev.week?.number
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

  // Grade picks for final games (league rule: tie = survive)
  const finals = games.filter((g) => g.status === 'final' && g.winner)
  let graded = 0
  for (const g of finals) {
    const { data: picks, error: pErr } = await supabase
      .from('picks')
      .select('id, user_id, team, result')
      .eq('game_id', g.id)
    if (pErr) throw pErr

    for (const p of picks ?? []) {
      const result = g.winner === 'TIE' || p.team === g.winner ? 'win' : 'loss'
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

  // Missed-pick handling (league rule): assign a random unused team from a game
  // kicking off within the assignment window. Eliminated only if the entire week
  // passes with no pick and no assignable options.
  {
    const now = Date.now()
    const windowEnd = now + ASSIGNMENT_WINDOW_HOURS * 3600000
    const { data: allSeasonPicks } = await supabase
      .from('picks')
      .select('user_id, team, week')
      .eq('season', SEASON)
    const usedTeamsByUser = new Map()
    for (const p of allSeasonPicks ?? []) {
      if (!usedTeamsByUser.has(p.user_id)) usedTeamsByUser.set(p.user_id, new Set())
      usedTeamsByUser.get(p.user_id).add(p.team)
    }

    const maxWeek = Math.max(...games.map((g) => g.week))
    for (let week = 1; week <= maxWeek; week++) {
      const weekGames = games.filter((g) => g.week === week)
      if (!weekGames.length) continue

      const { data: aliveProfiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .is('eliminated_week', null)
      const { data: weekPicks } = await supabase
        .from('picks')
        .select('user_id')
        .eq('season', SEASON)
        .eq('week', week)
      const pickers = new Set((weekPicks ?? []).map((p) => p.user_id))

      for (const pr of aliveProfiles ?? []) {
        if (pickers.has(pr.id)) continue

        const eligibleGames = weekGames.filter((g) => {
          const k = new Date(g.kickoff).getTime()
          return k > now && k <= windowEnd
        })
        const used = usedTeamsByUser.get(pr.id) ?? new Set()
        const candidates = []
        for (const g of eligibleGames) {
          for (const t of [g.home_team, g.away_team]) {
            if (!used.has(t)) candidates.push({ team: t, game: g })
          }
        }

        if (candidates.length) {
          const choice = candidates[Math.floor(Math.random() * candidates.length)]
          const { error } = await supabase
            .from('picks')
            .upsert(
              {
                user_id: pr.id,
                season: SEASON,
                week,
                team: choice.team,
                game_id: choice.game.id,
                auto_assigned: true,
              },
              { onConflict: 'user_id,season,week' },
            )
          if (error) console.error(`assign ${pr.display_name}: ${error.message}`)
          else console.log(`${pr.display_name}: auto-assigned ${choice.team} (week ${week})`)
        } else if (weekGames.every((g) => g.status === 'final')) {
          await supabase
            .from('profiles')
            .update({ eliminated_week: week })
            .eq('id', pr.id)
            .is('eliminated_week', null)
          console.log(`${pr.display_name}: no pick and no options week ${week} — ELIMINATED`)
        }
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
