import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { getTopNavigation, logOutToHome } from '../navigation.js'
import Logo from './Logo.jsx'

export default function Layout() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col">
      <div className="app-backdrop" />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-field-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-2xl font-extrabold uppercase tracking-wide leading-none">
              <span className="text-turf-500">DWS</span>{' '}
              <span className="text-white">Survivor Pool</span>
            </span>
          </NavLink>

          <nav className="hidden sm:flex items-center gap-1 text-sm font-semibold">
            {getTopNavigation(Boolean(session)).map((l) => (
              <NavLink
                key={l.label}
                to={l.to}
                end={l.to === '/'}
                title={l.loginHint}
                className={({ isActive }) =>
                  `relative rounded-lg px-3 py-1.5 transition-colors ${
                    l.locked
                      ? 'cursor-pointer text-gray-600 hover:bg-white/5 hover:text-gray-300'
                      : isActive
                        ? 'text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {l.label}
                    {l.locked && <span className="ml-1 text-xs" aria-hidden="true">🔒</span>}
                    {!l.locked && isActive && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute inset-x-2 -bottom-[5px] h-0.5 rounded-full bg-gradient-to-r from-turf-500 to-brand-blue"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
            {profile?.is_admin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                    isActive
                      ? 'bg-accent-500/20 text-accent-400'
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
                  className={`hidden sm:inline font-semibold ${
                    profile?.eliminated_week ? 'text-red-400' : 'text-turf-400'
                  }`}
                >
                  {profile?.display_name ?? session.user.email}
                </motion.span>
                <button
                  onClick={async () => {
                    await logOutToHome(signOut, navigate)
                  }}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-gray-300 transition-colors hover:border-white/30 hover:text-white"
                >
                  Log out
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className="rounded-lg bg-gradient-to-r from-turf-500 to-turf-400 px-4 py-1.5 font-bold text-field-950 transition-transform hover:scale-105"
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
        <span className="inline-flex items-center gap-1.5">
          <Logo size={14} /> DWS Survivor Pool · Dale Workforce Solutions · One loss and you're eliminated.
        </span>
      </footer>
    </div>
  )
}
