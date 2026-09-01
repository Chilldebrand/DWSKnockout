import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getCountdownGame } from '../countdownGame.js'
import { formatLocalKickoff } from '../kickoffTime.js'

const SEASON = 2026

function useCountdown(target) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const diff = Math.max(0, target - now)
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins: Math.floor((diff / 60000) % 60),
    secs: Math.floor((diff / 1000) % 60),
  }
}

export default function Dashboard() {
  const { session, profile } = useAuth()
  const [games, setGames] = useState([])
  const [myPick, setMyPick] = useState(null)
  const [week, setWeek] = useState(null)
  const [aliveCount, setAliveCount] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .is('eliminated_week', null)
      setAliveCount(count ?? 0)

      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('season', SEASON)
        .order('week')
        .order('kickoff')
      if (data?.length) {
        const now = Date.now()
        const current =
          data.find(
            (g) => g.status === 'scheduled' && new Date(g.kickoff) > new Date(now),
          )?.week ?? data[data.length - 1].week
        setWeek(current)
        setGames(data.filter((g) => g.week === current))
        if (session) {
          const { data: pickData } = await supabase
            .from('picks')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('season', SEASON)
            .eq('week', current)
            .maybeSingle()
          setMyPick(pickData)
        }
      }
      setLoading(false)
    }
    load()
  }, [session?.user?.id])

  const countdownGame = getCountdownGame(games, myPick)
  const pickKickoff = countdownGame ? new Date(countdownGame.kickoff).getTime() : null
  const countdown = useCountdown(pickKickoff ?? Date.now())

  if (!session)
    return (
      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-field-950 shadow-2xl"
        >
          <img
            src={`${import.meta.env.BASE_URL}hero-lineup-dws-survivor-pool.png`}
            alt="DWS Survivor Pool players in Giants, Eagles, and Ravens jerseys"
            className="min-h-[420px] w-full object-cover object-center"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-field-950 via-field-950/25 to-transparent px-6 pb-7 pt-24 sm:px-10 sm:pb-10">
            <h1 className="sr-only">DWS Survivor Pool</h1>
            <p className="max-w-sm text-sm text-gray-200 sm:text-base">
              Pick one NFL team each week. Win and you survive. Lose and you're eliminated.
              Last one standing takes the crown.
            </p>
            <Link to="/login" className="mt-5 inline-block">
              <span className="rounded-xl bg-gradient-to-r from-turf-500 to-turf-400 px-7 py-3 font-bold text-field-950 shadow-lg glow-green transition-transform hover:scale-105 active:scale-95">
                Join the Survivor Pool
              </span>
            </Link>
          </div>
        </motion.section>
        <RulesCard />
      </div>
    )

  if (loading) return <p className="text-gray-400">Loading your league…</p>

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">
        Welcome back, <span className="text-gradient">{profile?.display_name}</span>
      </h1>

      {profile?.eliminated_week ? (
        <motion.div
          initial={{ scale: 0.97 }}
          animate={{ scale: 1 }}
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6"
        >
          <h2 className="text-xl font-bold text-red-400">
            💀 Eliminated in week {profile.eliminated_week}
          </h2>
          <p className="mt-1 text-sm text-red-300/80">Better luck next season.</p>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title={`Week ${week ?? '—'}`}
            value={myPick ? 'Pick locked in' : 'Pick needed!'}
            accent={
              myPick
                ? 'text-green-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.9)]'
                : 'text-red-400 animate-pulse drop-shadow-[0_0_8px_rgba(248,113,113,0.85)]'
            }
            to="/pick"
            hint="Click to go to picks →"
          />
          <StatCard
            title="Kickoff countdown"
            value={
              !myPick
                ? '← Make a pick'
                : pickKickoff
                  ? `${countdown.days}d ${countdown.hours}h ${countdown.mins}m ${countdown.secs}s`
                  : 'Kickoff TBD'
            }
            accent="text-white"
            detail={pickKickoff ? formatLocalKickoff(pickKickoff) : undefined}
          />
          <StatCard
            title="Players still alive"
            value={aliveCount != null ? String(aliveCount) : '—'}
            accent="text-turf-400"
          />
        </div>
      )}

      {!games.length && !profile?.eliminated_week && (
        <p className="glass rounded-xl p-6 text-gray-400">
          The season schedule hasn't synced yet. Once the daily sync runs, this page comes
          alive with the weekly slate.
        </p>
      )}

      <RulesCard />
    </div>
  )
}

const RULES = [
  {
    icon: '🏈',
    title: 'Pick ONE team each week to win — and you can NEVER pick that team again',
    text: 'Win and you survive to next week. Each NFL team is a one-time pick for you all season, so spend your best teams carefully.',
  },
  {
    icon: '💀',
    title: 'If your pick loses, you\'re out. Better luck next year!',
    text: 'One loss and your season is over — you\'ll keep seeing the standings, but the crown is out of reach.',
  },
  {
    icon: '⏰',
    title: 'Picks lock at that game\'s kickoff',
    text: 'Every game locks individually when it starts. You can still pick a Sunday afternoon team even after the early games have kicked off.',
  },
  {
    icon: '🎲',
    title: 'Forget to pick? You get a random team',
    text: 'The site assigns you a random team you haven\'t used from a game that hasn\'t started. You can still swap it yourself before kickoff.',
  },
  {
    icon: '🤝',
    title: 'Tie games don\'t hurt you',
    text: 'If your game ends in a tie, you survive. No harm done.',
  },
  {
    icon: '🏆',
    title: 'Playoff extension',
    text: 'If multiple players survive the full regular season, we continue into the NFL playoffs until one person remains.',
  },
]

function RulesCard() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass rounded-2xl p-6"
    >
      <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
        League <span className="text-gradient">Rules</span>
      </h2>
      <ol className="mt-4 space-y-3">
        {RULES.map((r, i) => (
          <motion.li
            key={r.title}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-turf-500/40"
          >
            <span className="text-3xl leading-none">{r.icon}</span>
            <div>
              <h3 className="text-lg font-bold text-white sm:text-xl">
                <span className="mr-1.5 text-turf-400">{i + 1}.</span>
                {r.title}
              </h3>
              <p className="mt-1.5 text-base leading-relaxed text-gray-200">{r.text}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </motion.section>
  )
}

function StatCard({ title, value, accent, to, hint, detail }) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-wider text-gray-400">{title}</p>
      <p className={`mt-1 text-lg font-bold ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-white">{hint}</p>}
      {detail && <p className="mt-1 text-xs text-gray-300">{detail}</p>}
    </>
  )
  return to ? (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className="glass cursor-pointer rounded-2xl p-5 transition-shadow hover:glow-green"
    >
      <Link to={to} className="block">
        {body}
      </Link>
    </motion.div>
  ) : (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5"
    >
      {body}
    </motion.div>
  )
}
