import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Standings() {
  const { profile: me } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('picks').select('*'),
    ]).then(([{ data: p }, { data: k }]) => {
      setProfiles(p ?? [])
      setPicks(k ?? [])
      setLoading(false)
    })
  }, [])

  const rows = useMemo(() => {
    return profiles
      .map((pr) => {
        const mine = picks.filter((p) => p.user_id === pr.id)
        const wins = mine.filter((p) => p.result === 'win').length
        const losses = mine.filter((p) => p.result === 'loss').length
        const pending = mine.filter((p) => p.result === 'pending')
        const sorted = [...mine].sort((a, b) => b.week - a.week)
        let streak = 0
        for (const p of sorted) {
          if (p.result === 'win') streak++
          else break
        }
        const eliminatedWeek = pending.length && !pr.eliminated_week ? null : pr.eliminated_week
        return {
          ...pr,
          wins,
          losses,
          weeksPicked: mine.length,
          streak,
          hasPending: pending.length > 0,
          eliminatedWeek,
        }
      })
      .sort((a, b) => {
        if (!!a.eliminatedWeek !== !!b.eliminatedWeek)
          return a.eliminatedWeek ? 1 : -1
        if (a.eliminatedWeek && b.eliminatedWeek)
          return a.eliminatedWeek - b.eliminatedWeek
        return b.wins - a.wins || a.losses - b.losses
      })
  }, [profiles, picks])

  const aliveCount = rows.filter((r) => !r.eliminatedWeek).length

  if (loading) return <p className="text-gray-400">Loading standings…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">
          Stan<span className="text-gradient">dings</span>
        </h1>
        <motion.span
          key={aliveCount}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className="rounded-full bg-turf-500/15 px-4 py-1.5 text-sm font-bold text-turf-500"
        >
          {aliveCount} survivor{aliveCount === 1 ? '' : 's'} remaining
        </motion.span>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Pick Record</th>
              <th className="px-4 py-3">Streak</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`border-t border-white/5 ${
                  r.id === me?.id ? 'bg-turf-500/5' : ''
                }`}
              >
                <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                <td className="px-4 py-3 font-semibold">{r.display_name}</td>
                <td className="px-4 py-3">
                  <span className="font-mono">
                    {r.wins}-{r.losses}
                  </span>
                  {!r.hasPending && r.weeksPicked > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({r.weeksPicked} wk{r.weeksPicked === 1 ? '' : 's'})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.streak > 0 ? (
                    <span className="text-turf-500" title="current win streak">
                      🔥 {r.streak}
                    </span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.eliminatedWeek ? (
                    <motion.span
                      initial={{ x: [0, -4, 4, -2, 2, 0] }}
                      transition={{ duration: 0.4 }}
                      className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400"
                    >
                      ❌ Out — Wk {r.eliminatedWeek}
                    </motion.span>
                  ) : (
                    <span className="rounded-full bg-turf-500/15 px-3 py-1 text-xs font-bold text-turf-500">
                      ✓ Alive
                    </span>
                  )}
                </td>
              </motion.tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No players yet — be the first to register!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
