import { createClient } from '@supabase/supabase-js'

const token = process.argv[2]
const ref = process.argv[3]

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  return { ok: res.ok, body: await res.text() }
}

const checks = [
  ['team count', 'select count(*) as teams from public.teams'],
  ['tables', "select tablename from pg_tables where schemaname = 'public'"],
  ['policies', "select policyname, tablename from pg_policies where schemaname = 'public' order by tablename"],
  ['functions', "select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'"],
  ['triggers', "select trigger_name, event_object_schema from information_schema.triggers where event_object_schema = 'auth'"],
]

for (const [label, sql] of checks) {
  const { ok, body } = await query(sql)
  console.log(`\n--- ${label} ---`)
  console.log(ok ? body : `FAILED: ${body}`)
}
