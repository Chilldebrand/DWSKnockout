import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'register') {
        if (!displayName.trim()) throw new Error('Pick a display name')
        const { error } = await signUp(email, password, displayName.trim())
        if (error) throw error
        setMessage('Account created! Check your email to confirm, then log in.')
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass rounded-2xl p-8 shadow-2xl"
      >
        <div className="mb-6 text-center">
          <div className="text-5xl">🏈</div>
          <h1 className="font-display mt-2 text-3xl font-extrabold uppercase tracking-wide">
            {mode === 'login' ? (
              <>Welcome <span className="text-gradient">back</span></>
            ) : (
              <>Join the <span className="text-gradient">league</span></>
            )}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {mode === 'login'
              ? 'Log in to make your pick.'
              : 'One team each week. Lose and you are out.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="popLayout">
            {mode === 'register' && (
              <motion.div
                key="name-field"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-field-950 px-4 py-3 outline-none focus:border-turf-500"
                  autoComplete="nickname"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-white/10 bg-field-950 px-4 py-3 outline-none focus:border-turf-500"
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-white/10 bg-field-950 px-4 py-3 outline-none focus:border-turf-500"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

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
          {message && (
            <p className="rounded-lg bg-turf-500/15 px-3 py-2 text-sm text-turf-500">{message}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-r from-turf-500 to-turf-400 py-3 font-bold text-field-950 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? 'One moment…' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError('')
            setMessage('')
          }}
          className="mt-4 w-full text-center text-sm text-gray-400 hover:text-white"
        >
          {mode === 'login'
            ? "New here? Create an account →"
            : 'Already have an account? Log in →'}
        </button>
      </motion.div>
    </div>
  )
}
