import { readFileSync } from 'node:fs'

const [token, ref] = process.argv.slice(2)
const files = process.argv.slice(4) ?? []

async function runQuery(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, text }
}

for (const f of files) {
  const sql = readFileSync(f, 'utf8')
  console.log(`\n=== Running ${f} ===`)
  const { ok, status, text } = await runQuery(sql)
  console.log(ok ? 'SUCCESS' : `FAILED (${status})`)
  if (text && text !== '[]') console.log(text.slice(0, 500))
  if (!ok) process.exit(1)
}
console.log('\nAll SQL executed.')
