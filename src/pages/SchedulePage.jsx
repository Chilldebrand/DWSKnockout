import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient.js'

const SEASON = 2026

export default function SchedulePage() {
  const [games, setGames] = useState([])
  const [teams, setTeams] = useState([])
  const [week, setWeek] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('games').select('*').eq('season', SEASON).order('kickoff'),
      supabase.from('teams').select('*'),
    ]).then(([{ data: g }, { data: t }]) => {
      setGames(g ?? [])
      setTeams(t ?? [])
      if (g?.length) {
        const now = Date.now()
        const current =
          g.find((x) => x.status === 'scheduled' && new Date(x.kickoff) > new Date(now))?.week ??
          g[g.length - 1].week
        setWeek(current)
      }
      setLoading(false)
    })
  }, [])

  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams])
  const weeks = useMemo(() => [...new Set(games.map((g) => g.week))].sort((a, b) => a - b), [games])
  const weekGames = useMemo(() => games.filter((g) => g.week === week), [games, week])

  if (loading) return <p className="text-gray-400">Loading schedule…</p>
  if (!games.length)
    return (
      <div className="glass rounded-2xl p-8">
        <h1 className="font-display text-2xl font-bold">No schedule yet</h1>
        <p className="mt-2 text-gray-400">Run the daily sync to populate the season.</p>
      </div>
    )

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">
        <span className="text-gradient">{SEASON}</span> Schedule
      </h1>

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
        {weekGames.map((g, i) => {
          const home = teamMap[g.home_team]
          const away = teamMap[g.away_team]
          if (!home || !away) return null
          const kickoff = new Date(g.kickoff)
          const isFinal = g.status === 'final'
          const homeWon = g.winner === g.home_team
          const awayWon = g.winner === g.away_team
          const fav = g.favorite

          return (
            <motion.div
              key={g.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`flex items-center gap-3 px-4 py-3 ${
                i > 0 ? 'border-t border-white/5' : ''
              } ${isFinal ? 'bg-white/[0.02]' : ''}`}
            >
              {/* Away team */}
              <TeamCell team={away} won={isFinal ? awayWon : null} />
              <span className="text-xs font-bold text-gray-600">@</span>
              {/* Home team */}
              <TeamCell team={home} won={isFinal ? homeWon : null} />

              {/* Middle info */}
              <div className="mx-2 hidden flex-1 text-center text-xs text-gray-400 sm:block">
                {fav && (
                  <span className="font-semibold text-accent-400">
                    {fav} −{Math.abs(parseFloat(g.spread))}
                  </span>
                )}
              </div>

              {/* Right: time or score */}
              <div className="ml-auto text-right">
                {isFinal ? (
                  <div className="font-mono text-sm font-bold text-white">
                    {g.away_score} – {g.home_score}
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-gray-200">
                      {kickoff.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {kickoff.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function TeamCell({ team, won }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {team.logo ? (
        <img src={team.logo} alt="" className="h-8 w-8 shrink-0 object-contain" loading="lazy" />
      ) : (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
          style={{ backgroundColor: team.color }}
        >
          {team.id}
        </span>
      )}
      <span
        className={`truncate text-sm font-semibold sm:text-base ${
          won === true ? 'text-white' : won === false ? 'text-gray-500' : 'text-gray-200'
        }`}
      >
        {team.name}
        <span className="ml-1.5 hidden text-xs text-gray-500 md:inline">
          {team.wins}-{team.losses}
        </span>
      </span>
    </div>
  )
}
