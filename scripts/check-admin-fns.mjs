const KEY = 'sb_publishable_4RTMniM2d1qLSqNNLeB_1g_9vsuMPjV'
const URL = 'https://ydrqvqwvqoxixgimodvo.supabase.co/rest/v1'

async function rpc(name, body) {
  const res = await fetch(`${URL}/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  console.log(`${name}: ${res.status} ${await res.text()}`)
}

await rpc('admin_reset_password', {
  target_user_id: '00000000-0000-0000-0000-000000000000',
  temp_password: 'testtest',
})
await rpc('admin_change_email', {
  target_user_id: '00000000-0000-0000-0000-000000000000',
  new_email: 'x@y.zz',
})
