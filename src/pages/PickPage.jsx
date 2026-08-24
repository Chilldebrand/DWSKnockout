import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const SEASON = 2026

export default function PickPage() {
  const { session, profile } = useAuth()
  const [games, setGames] = useState([])
  const [teams, setTeams] = useState([])
  const [myPicks, setMyPicks] = useState([])
  const [week, setWeek] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savedTeam, setSavedTeam] = useState(null)

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams],
  )

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: teamData }, { data: pickData }] = await Promise.all([
        supabase.from('teams').select('*'),
        session
          ? supabase.from('picks').select('*').eq('user_id', session.user.id)
          : Promise.resolve({ data: [] }),
      ])
      setTeams(teamData ?? [])
      setMyPicks(pickData ?? [])
      setLoading(false)
    }
    load()
  }, [session?.user?.id])

  // Determine current week: first week with un-started games, else latest week
  useEffect(() => {
    async function findWeek() {
      const { data } = await supabase
        .from('games')
        .select('week, kickoff, status')
        .eq('season', SEASON)
        .order('week')
      if (!data?.length) return
      const now = new Date()
      const current =
        data.find((g) => new Date(g.kickoff) > now && g.status === 'scheduled')?.week ??
        data[data.length - 1].week
      setWeek(current)

      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('season', SEASON)
        .eq('week', current)
        .order('kickoff')
      setGames(gameData ?? [])
    }
    findWeek()
  }, [])

  const myPickThisWeek = myPicks.find((p) => p.week === week)
  const usedTeams = useMemo(() => new Set(myPicks.map((p) => p.team)), [myPicks])
  const eliminated = !!profile?.eliminated_week

  function lockReason(teamId, game) {
    if (!session) return 'Log in to pick'
    if (eliminated) return 'You are eliminated'
    if (usedTeams.has(teamId)) return 'Already used'
    if (new Date(game.kickoff) <= new Date()) return 'Kicked off'
    return null
  }

  async function makePick(teamId, gameId) {
    setError('')
    const { error } = await supabase.rpc('make_pick', {
      p_season: SEASON,
      p_week: week,
      p_team: teamId,
      p_game: gameId,
    })
    if (error) {
      setError(error.message)
      return
    }
    setMyPicks((prev) => [
      ...prev.filter((p) => p.week !== week),
      {
        user_id: session.user.id,
        season: SEASON,
        week,
        team: teamId,
        game_id: gameId,
        result: 'pending',
      },
    ])
    setSavedTeam(teamId)
    setTimeout(() => setSavedTeam(null), 2000)
  }

  if (loading) return <p className="text-gray-400">Loading schedule…</p>
  if (!games.length)
    return (
      <div className="rounded-2xl border border-white/10 bg-field-900 p-8">
        <h1 className="text-2xl font-bold">No schedule yet</h1>
        <p className="mt-2 text-gray-400">
          Games appear here once the first daily sync runs. Add the GitHub secrets and run the
          <span className="font-mono"> Daily NFL Sync </span>workflow manually to populate now.
        </p>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black uppercase tracking-wide">
          Week {week} Picks
        </h1>
        {myPickThisWeek ? (
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-full bg-turf-500/20 px-4 py-1.5 font-bold text-turf-500"
          >
            Picked: {teamMap[myPickThisWeek.team]?.display ?? myPickThisWeek.team}
          </motion.span>
        ) : (
          !eliminated && (
            <span className="rounded-full bg-accent-500/15 px-4 py-1.5 font-bold text-accent-500 animate-pulse">
              No pick yet!
            </span>
          )
        )}
      </div>

      {eliminated && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          You were knocked out in week {profile.eliminated_week}. Thanks for playing!
        </p>
      )}
      {error && (
        <motion.p
          initial={{ x: -8 }}
          animate={{ x: [0, -6, 6, -4, 4, 0] }}
          transition={{ duration: 0.4 }}
          className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </motion.p>
      )}

      <AnimatePresence initial={false}>
        {games.map((g) => {
          const home = teamMap[g.home_team]
          const away = teamMap[g.away_team]
          if (!home || !away) return null
          const kickoff = new Date(g.kickoff)
          const lockedGame = g.status !== 'scheduled' || kickoff <= new Date()

          return (
            <motion.div
              key={g.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-2xl border bg-field-900 p-5 transition-colors ${
                myPickThisWeek &&
                [g.home_team, g.away_team].includes(myPickThisWeek.team)
                  ? 'border-turf-500/60'
                  : lockedGame
                    ? 'border-white/5 opacity-60'
                    : 'border-white/10'
              }`}
            >
              <div className="mb-3 flex items-center justify-between text-xs text-gray-400">
                <span>
                  {kickoff.toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  ·{' '}
                  {kickoff.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                {lockedGame ? (
                  <span className="uppercase tracking-wider">{g.status}</span>
                ) : (
                  <span className="text-accent-500">Open</span>
                )}
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {[away, home].map((t, i) => {
                  const reason = lockReason(t.id, g)
                  const selected = myPickThisWeek?.team === t.id
                  const record = `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''}`
                  const isFav = g.favorite === t.id
                  const favLabel = isFav && g.spread != null
                    ? `−${Math.abs(parseFloat(g.spread))}`
                    : null
                  return (
                    <>
                      {i === 1 && (
                        <div key="vs" className="text-center text-xs font-bold text-gray-500">
                          VS
                        </div>
                      )}
                      <motion.button
                        key={t.id}
                        whileTap={reason ? {} : { scale: 0.95 }}
                        disabled={!!reason}
                        onClick={() => makePick(t.id, g.id)}
                        title={reason ?? undefined}
                        className={`relative flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-3 transition-colors ${
                          selected
                            ? 'border-turf-500 bg-turf-500/10'
                            : reason
                              ? 'cursor-not-allowed border-transparent bg-white/[0.03]'
                              : 'border-white/10 hover:border-white/40'
                        } ${i === 0 ? '' : ''}`}
                        style={
                          selected && t.color
                            ? { boxShadow: `0 0 24px ${t.color}44` }
                            : undefined
                        }
                      >
                        {isFav && (
                          <span className="absolute -top-2 right-2 rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-black text-field-950">
                            FAV {favLabel}
                          </span>
                        )}
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white"
                          style={{ backgroundColor: t.color }}
                        >
                          {t.id}
                        </span>
                        <span className="text-sm font-semibold">{t.name}</span>
                        <span className="text-xs text-gray-400">{record}</span>
                        {selected && (
                          <motion.span
                            initial={{ y: 8, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="absolute -bottom-2 rounded-full bg-turf-500 px-2 py-0.5 text-[10px] font-black text-field-950"
                          >
                            {savedTeam === t.id ? 'SAVED ✓' : 'YOUR PICK'}
                          </motion.span>
                        )}
                      </motion.button>
                    </>
                  )
                })}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
