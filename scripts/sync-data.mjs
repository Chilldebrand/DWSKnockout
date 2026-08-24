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

const ESPN_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

async function fetchWeek(week) {
  const url = `${ESPN_BASE}?dates=${SEASON}&weeks=${week}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN ${res.status} for week ${week}`)
  return res.json()
}

function parseRecords(event) {
  const comp = event.competitions[0]
  const out = {}
  for (const c of comp.competitors) {
    const rec = (c.records ?? []).find((r) => r.type === 'total')?.summary ?? ''
    const m = rec.match(/^(\d+)-(\d+)(?:-(\d+))?/)
    out[c.team.abbreviation] = m
      ? { w: +m[1], l: +m[2], t: +(m[3] ?? 0) }
      : { w: 0, l: 0, t: 0 }
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

  const teamUpdates = new Map() // abbr -> {w,l,t}
  const games = []

  for (let week = 1; week <= TOTAL_WEEKS; week++) {
    try {
      const data = await fetchWeek(week)

      for (const ev of data.events ?? []) {
        Object.entries(parseRecords(ev)).forEach(([abbr, rec]) =>
          teamUpdates.set(abbr, rec),
        )
        const g = parseGame(ev, week)
        if (g) games.push(g)
      }
      console.log(`Week ${week}: ${data.events?.length ?? 0} games`)
    } catch (err) {
      console.error(`Week ${week} failed: ${err.message}`)
    }
  }

  if (!games.length) {
    console.log('No games found — aborting.')
    process.exit(1)
  }

  // Upsert games (odds refresh happens here every run = daily spread updates)
  const { error: gErr } = await supabase.from('games').upsert(games, {
    onConflict: 'id',
  })
  if (gErr) throw gErr
  console.log(`Upserted ${games.length} games`)

  // Update team records
  if (teamUpdates.size) {
    const rows = [...teamUpdates.entries()].map(([id, r]) => ({
      id,
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
