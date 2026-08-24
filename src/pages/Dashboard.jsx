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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-field-900 p-10 text-center"
      >
        <div className="text-6xl">🏈</div>
        <h1 className="mt-4 text-3xl font-black uppercase">
          DWS <span className="text-turf-500">Knockout</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-gray-400">
          Pick one NFL team to win each week. Win and you survive. Lose — or forget to
          pick — and you're knocked out. Last one standing takes the crown.
        </p>
        <Link to="/login">
          <button className="mt-6 rounded-xl bg-turf-500 px-8 py-3 font-bold text-field-950 transition-transform hover:scale-105 active:scale-95">
            Join the League
          </button>
        </Link>
      </motion.div>
    )

  if (loading) return <p className="text-gray-400">Loading your league…</p>

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black uppercase tracking-wide">
        Welcome back, {profile?.display_name}
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
            accent={myPick ? 'text-turf-500' : 'text-accent-500 animate-pulse'}
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
        <p className="rounded-xl border border-white/10 bg-field-900 p-6 text-gray-400">
          The season schedule hasn't synced yet. Once the daily sync runs, this page comes
          alive with the weekly slate.
        </p>
      )}
    </div>
  )
}

function StatCard({ title, value, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-field-900 p-5"
    >
      <p className="text-xs uppercase tracking-wider text-gray-400">{title}</p>
      <p className={`mt-1 text-lg font-bold ${accent}`}>{value}</p>
    </motion.div>
  )
}
