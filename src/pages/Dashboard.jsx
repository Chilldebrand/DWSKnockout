import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
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

  const firstKickoff = games[0] ? new Date(games[0].kickoff).getTime() : null
  const countdown = useCountdown(firstKickoff ?? Date.now())

  if (!session)
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-10 text-center"
        >
          <div className="text-6xl">🏈</div>
          <h1 className="font-display mt-4 text-4xl font-extrabold uppercase">
            DWS <span className="text-gradient">Knockout</span>
          </h1>
          <p className="mx-auto mt-2 max-w-md text-gray-400">
            Pick one NFL team to win each week. Win and you survive. Lose and you're
            knocked out. Last one standing takes the crown.
          </p>
          <Link to="/login">
            <button className="mt-6 rounded-xl bg-gradient-to-r from-turf-500 to-turf-400 px-8 py-3 font-bold text-field-950 shadow-lg glow-green transition-transform hover:scale-105 active:scale-95">
              Join the League
            </button>
          </Link>
        </motion.div>
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
            💀 Knocked out in week {profile.eliminated_week}
          </h2>
          <p className="mt-1 text-sm text-red-300/80">Better luck next season.</p>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title={`Week ${week ?? '—'}`}
            value={myPick ? 'Pick locked in' : 'Pick needed!'}
            accent={myPick ? 'text-turf-400' : 'text-accent-400 animate-pulse'}
            to="/pick"
            hint="Click to go to picks →"
          />
          <StatCard
            title="Kickoff countdown"
            value={
              firstKickoff
                ? `${countdown.days}d ${countdown.hours}h ${countdown.mins}m ${countdown.secs}s`
                : 'TBD'
            }
            accent="text-white"
          />
          <StatCard title="Games this week" value={String(games.length)} accent="text-white" />
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
    icon: '⏰',
    title: 'Picks lock at kickoff',
    text: 'Each game locks individually when it starts. Pick a Sunday afternoon team even after the early games have kicked off.',
  },
  {
    icon: '🎲',
    title: 'Forget = random pick',
    text: 'Miss the deadline? The site assigns you a random team you haven\'t used from a game that hasn\'t started. You can still swap it yourself before kickoff.',
  },
  {
    icon: '🤝',
    title: 'Ties are your friend',
    text: 'If your game ends in a tie, you survive. No harm done.',
  },
  {
    icon: '🚫',
    title: 'No team reuse',
    text: 'Each NFL team can only be picked once by you — all season. Choose wisely.',
  },
  {
    icon: '🏆',
    title: 'Playoff extension',
    text: 'If multiple players survive the full regular season, we continue into the NFL playoffs until one person remains.',
  },
  {
    icon: '1️⃣',
    title: 'One entry per person',
    text: 'Single entry, no buybacks. When you\'re out, you\'re out — see everyone at next year\'s draft.',
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
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RULES.map((r, i) => (
          <motion.div
            key={r.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-turf-500/40"
          >
            <div className="text-xl">{r.icon}</div>
            <h3 className="mt-1.5 text-sm font-bold text-turf-400">{r.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">{r.text}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function StatCard({ title, value, accent, to, hint }) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-wider text-gray-400">{title}</p>
      <p className={`mt-1 text-lg font-bold ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
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
