import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const SEASON = 2026

export default function AdminPage() {
  const { profile: me } = useAuth()
  const [tab, setTab] = useState('players')
  const [profiles, setProfiles] = useState([])
  const [picks, setPicks] = useState([])
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])
  const [week, setWeek] = useState(1)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')

  const isAllowed = me?.is_admin

  async function refresh() {
    setLoading(true)
    const [p, k, t, g] = await Promise.all([
      supabase.from('profiles').select('*').order('display_name'),
      supabase.from('picks').select('*'),
      supabase.from('teams').select('*'),
      supabase.from('games').select('*').eq('season', SEASON).order('kickoff'),
    ])
    setProfiles(p.data ?? [])
    setPicks(k.data ?? [])
    setTeams(t.data ?? [])
    setGames(g.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (isAllowed) refresh()
  }, [isAllowed])

  const weeks = useMemo(
    () => [...new Set(games.map((g) => g.week))].sort((a, b) => a - b),
    [games],
  )
  const weekGames = useMemo(() => games.filter((g) => g.week === week), [games, week])
  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams])

  async function save(table, id, patch, label) {
    const { error } = await supabase.from(table).update(patch).eq('id', id)
    setNotice(error ? `⚠ ${error.message}` : `✓ ${label} updated`)
    setTimeout(() => setNotice(''), 3000)
    if (!error) refresh()
  }

  if (!me)
    return (
      <div className="glass rounded-2xl p-8 text-center text-gray-400">
        Log in with an admin account to manage the league.
      </div>
    )

  if (!isAllowed)
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-red-400">Access denied</h1>
        <p className="mt-2 text-gray-400">
          Your account isn't an admin. Run the promotion SQL from{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
            supabase/admin_policies.sql
          </code>{' '}
          against your display name, then refresh.
        </p>
      </div>
    )

  if (loading) return <p className="text-gray-400">Loading admin data…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">
          Admin <span className="text-gradient">Console</span>
        </h1>
        {notice && (
          <motion.span
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold"
          >
            {notice}
          </motion.span>
        )}
      </div>

      <div className="flex gap-2">
        {['players', 'games'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
              tab === t
                ? 'bg-gradient-to-r from-turf-500 to-turf-400 text-field-950'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'players' && (
        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Eliminated (week)</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Picks</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-semibold">
                    {p.display_name}
                    {p.id === me.id && <span className="ml-2 text-xs text-turf-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      max="18"
                      placeholder="alive"
                      value={p.eliminated_week ?? ''}
                      onChange={(e) =>
                        setProfiles((prev) =>
                          prev.map((x) =>
                            x.id === p.id
                              ? { ...x, eliminated_week: e.target.value === '' ? null : +e.target.value }
                              : x,
                          ),
                        )
                      }
                      onBlur={(e) => {
                        const val = e.target.value === '' ? null : +e.target.value
                        if (val !== p.eliminated_week)
                          save('profiles', p.id, { eliminated_week: val }, p.display_name)
                      }}
                      className="w-20 rounded-lg border border-white/10 bg-field-950 px-2 py-1.5 outline-none focus:border-turf-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        save('profiles', p.id, { is_admin: !p.is_admin }, p.display_name)
                      }
                      className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                        p.is_admin
                          ? 'bg-accent-500/20 text-accent-400'
                          : 'bg-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {p.is_admin ? '★ Admin' : '☆ Player'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {picks.filter((k) => k.user_id === p.id).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'games' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {weeks.map((w) => (
              <button
                key={w}
                onClick={() => setWeek(w)}
                className={`h-9 w-9 rounded-lg text-sm font-bold transition-colors ${
                  w === week
                    ? 'bg-gradient-to-r from-turf-500 to-turf-400 text-field-950'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <div className="glass overflow-hidden rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-3">Matchup</th>
                  <th className="px-4 py-3">Score (A-H)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Winner override</th>
                </tr>
              </thead>
              <tbody>
                {weekGames.map((g) => (
                  <tr key={g.id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-semibold">
                      {teamMap[g.away_team]?.id ?? g.away_team} @{' '}
                      {teamMap[g.home_team]?.id ?? g.home_team}
                      {g.favorite && (
                        <span className="ml-2 text-xs text-accent-400">
                          {g.favorite} {g.spread != null ? `−${Math.abs(parseFloat(g.spread))}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ScoreBox
                          value={g.away_score}
                          onChange={(v) => {
                            if (v !== g.away_score)
                              save('games', g.id, { away_score: v }, `${g.away_team} score`)
                          }}
                        />
                        <span className="text-gray-600">–</span>
                        <ScoreBox
                          value={g.home_score}
                          onChange={(v) => {
                            if (v !== g.home_score)
                              save('games', g.id, { home_score: v }, `${g.home_team} score`)
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={g.status}
                        onChange={(e) =>
                          save('games', g.id, { status: e.target.value }, 'status')
                        }
                        className="rounded-lg border border-white/10 bg-field-950 px-2 py-1.5 outline-none focus:border-turf-500"
                      >
                        <option value="scheduled">scheduled</option>
                        <option value="in_progress">in_progress</option>
                        <option value="final">final</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={g.winner ?? ''}
                        onChange={(e) =>
                          save('games', g.id, { winner: e.target.value || null }, 'winner')
                        }
                        className="rounded-lg border border-white/10 bg-field-950 px-2 py-1.5 outline-none focus:border-turf-500"
                      >
                        <option value="">—</option>
                        <option value={g.away_team}>{g.away_team}</option>
                        <option value={g.home_team}>{g.home_team}</option>
                        <option value="TIE">TIE</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">
            Note: the nightly sync overwrites game data from ESPN. Manual overrides are best
            used between syncs, or when ESPN data is wrong.
          </p>
        </div>
      )}
    </div>
  )
}

function ScoreBox({ value, onChange }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  return (
    <input
      type="number"
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value === '' ? '' : +e.target.value)}
      onBlur={() => draft !== '' && +draft !== value && onChange(+draft)}
      className="w-14 rounded-lg border border-white/10 bg-field-950 px-2 py-1.5 outline-none focus:border-turf-500"
    />
  )
}
