const topNavigation = [
  { to: '/', label: 'Home' },
  { to: '/pick', label: 'Make a Pick' },
  { to: '/standings', label: 'Standings' },
  { to: '/schedule', label: 'Schedule' },
]

export function getTopNavigation(isSignedIn) {
  return topNavigation.map((item) => {
    if (isSignedIn || item.to === '/') return { ...item, locked: false }

    return {
      ...item,
      to: '/login',
      locked: true,
      loginHint: `Log in to view ${item.label}`,
    }
  })
}

export async function logOutToHome(signOut, navigate) {
  await signOut()
  navigate('/')
}
