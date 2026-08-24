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
      <div className="glass rounded-2xl p-8">
        <h1 className="text-2xl font-bold">No schedule yet</h1>
        <p className="mt-2 text-gray-400">
          Games appear here once the daily sync runs its first pass.
        </p>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">
          Week <span className="text-gradient">{week}</span> Picks
        </h1>
        {myPickThisWeek ? (
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ring-1 ${
              myPickThisWeek.auto_assigned
                ? 'bg-accent-500/15 text-accent-400 ring-accent-500/40'
                : 'bg-turf-500/15 text-turf-400 ring-turf-500/40'
            }`}
          >
            {myPickThisWeek.auto_assigned
              ? `🎲 Random: ${teamMap[myPickThisWeek.team]?.name ?? myPickThisWeek.team} — tap any team to swap`
              : `✓ ${teamMap[myPickThisWeek.team]?.display ?? myPickThisWeek.team}`}
          </motion.span>
        ) : (
          !eliminated && (
            <span className="rounded-full bg-accent-500/15 px-4 py-1.5 text-sm font-bold text-accent-400 ring-1 ring-accent-500/40 animate-pulse">
              No pick yet!
            </span>
          )
        )}
      </div>

      {eliminated && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">
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
          const hasMyPick = myPickThisWeek && [g.home_team, g.away_team].includes(myPickThisWeek.team)

          return (
            <motion.div
              key={g.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`glass rounded-2xl p-5 transition-shadow ${
                hasMyPick ? 'ring-2 ring-turf-500/50' : lockedGame ? 'opacity-60' : ''
              }`}
            >
              <div className="mb-3 flex items-center justify-between text-xs text-gray-400">
                <span>
                  {kickoff.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' · '}
                  {kickoff.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
                {lockedGame ? (
                  <span className="uppercase tracking-widest">{g.status}</span>
                ) : (
                  <span className="font-bold uppercase tracking-widest text-turf-400">Open</span>
                )}
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                {[away, home].map((t, i) => {
                  const reason = lockReason(t.id, g)
                  const selected = myPickThisWeek?.team === t.id
                  const record = `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''}`
                  const isFav = g.favorite === t.id
                  const favLabel =
                    isFav && g.spread != null ? `−${Math.abs(parseFloat(g.spread))}` : null
                  return (
                    <FragmentWithDivider key={t.id} showDivider={i === 1}>
                      <motion.button
                        whileTap={reason ? {} : { scale: 0.96 }}
                        whileHover={reason ? {} : { y: -2 }}
                        disabled={!!reason}
                        onClick={() => makePick(t.id, g.id)}
                        title={reason ?? undefined}
                        className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl border px-3 py-4 transition-all sm:px-5 ${
                          selected
                            ? 'border-turf-500 bg-turf-500/10'
                            : reason
                              ? 'cursor-not-allowed border-white/5 bg-white/[0.02]'
                              : 'border-white/10 hover:border-white/35 hover:bg-white/[0.04]'
                        }`}
                        style={
                          selected && t.color
                            ? { boxShadow: `0 0 32px ${t.color}55, inset 0 0 20px ${t.color}18` }
                            : undefined
                        }
                      >
                        {isFav && (
                          <span className="absolute -top-2.5 right-3 rounded-full bg-gradient-to-r from-accent-500 to-accent-400 px-2.5 py-0.5 text-[10px] font-black uppercase text-field-950 shadow-lg">
                            Fav {favLabel}
                          </span>
                        )}
                        {t.logo ? (
                          <img
                            src={t.logo}
                            alt={t.display}
                            className="helmet h-14 w-14 object-contain sm:h-16 sm:w-16"
                            loading="lazy"
                          />
                        ) : (
                          <span
                            className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-black text-white"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.id}
                          </span>
                        )}
                        <span className="text-sm font-bold sm:text-base">{t.name}</span>
                        <span className="text-xs font-medium text-gray-400">{record}</span>
                        {reason && !selected && (
                          <span className="text-[10px] uppercase tracking-wide text-gray-600">
                            {reason}
                          </span>
                        )}
                        {selected && (
                          <motion.span
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="absolute -bottom-2.5 rounded-full bg-gradient-to-r from-turf-500 to-turf-400 px-3 py-0.5 text-[10px] font-black uppercase text-field-950 shadow-lg glow-green"
                          >
                            {savedTeam === t.id ? 'Saved ✓' : 'Your pick'}
                          </motion.span>
                        )}
                      </motion.button>
                    </FragmentWithDivider>
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

function FragmentWithDivider({ showDivider, children }) {
  return (
    <>
      {showDivider && (
        <div className="text-center text-xs font-black uppercase text-gray-600">vs</div>
      )}
      {children}
    </>
  )
}
