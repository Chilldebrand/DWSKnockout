const SEED = ['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WAS']
const seen = new Map()

function* dateWindows(from, to, days = 7) {
  let cur = new Date(`${from.slice(0,4)}-${from.slice(4,6)}-${from.slice(6,8)}T00:00Z`)
  const end = new Date(`${to.slice(0,4)}-${to.slice(4,6)}-${to.slice(6,8)}T00:00Z`)
  while (cur < end) {
    const next = new Date(Math.min(cur.getTime() + days * 86400000, end.getTime()))
    const fmt = (d) => d.toISOString().slice(0, 10).replaceAll('-', '')
    yield [fmt(cur), fmt(next)]
    cur = next
  }
}

for (const [from, to] of dateWindows('20260901', '20270120')) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${from}-${to}`)
  if (!res.ok) continue
  const data = await res.json()
  for (const ev of data.events ?? []) {
    if (ev.season?.year !== 2026 || ev.season?.type !== 2) continue
    for (const c of ev.competitions[0].competitors) {
      const abbr = c.team.abbreviation
      if (!seen.has(abbr)) seen.set(abbr, c.team.displayName)
    }
  }
}

console.log('ESPN abbrs NOT in our seed:')
for (const [abbr, name] of seen) {
  if (!SEED.includes(abbr)) console.log(` ${abbr} = ${name}`)
}
console.log(`\nTotal distinct ESPN abbrs: ${seen.size} | seeded: ${SEED.length}`)
console.log('Seed abbrs never seen on ESPN:', SEED.filter((a) => ![...seen.keys()].includes(a)))
