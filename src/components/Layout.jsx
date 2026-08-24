import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/pick', label: 'Make a Pick' },
  { to: '/standings', label: 'Standings' },
  { to: '/schedule', label: 'Schedule' },
]

export default function Layout() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-field-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="text-2xl">🏈</span>
            <span className="text-lg font-black tracking-wide uppercase">
              DWS <span className="text-turf-500">Knockout</span>
            </span>
          </NavLink>
          <nav className="flex items-center gap-1 text-sm font-semibold">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            {profile?.is_admin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 transition-colors ${
                    isActive
                      ? 'bg-accent-500/20 text-accent-500'
                      : 'text-accent-500 hover:bg-accent-500/10'
                  }`
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {session ? (
              <>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`font-semibold ${
                    profile?.eliminated_week ? 'text-red-400' : 'text-turf-500'
                  }`}
                >
                  {profile?.display_name ?? session.user.email}
                </motion.span>
                <button
                  onClick={async () => {
                    await signOut()
                    navigate('/login')
                  }}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-gray-300 transition-colors hover:border-white/30 hover:text-white"
                >
                  Log out
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className="rounded-lg bg-turf-500 px-4 py-1.5 font-bold text-field-950 transition-transform hover:scale-105"
              >
                Log in
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8"
      >
        <Outlet />
      </motion.main>

      <footer className="border-t border-white/10 py-4 text-center text-xs text-gray-500">
        DWS Knockout · One loss and you're out.
      </footer>
    </div>
  )
}
