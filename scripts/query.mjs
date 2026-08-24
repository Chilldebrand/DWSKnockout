const token = process.argv[2]
const ref = process.argv[3]
const sql = process.argv[4]

async function query(querySql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: querySql }),
  })
  const ok = res.ok
  const body = await res.text()
  console.log(ok ? body : `FAILED: ${body}`)
  if (!ok) process.exit(1)
}

await query(sql)
