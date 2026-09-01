import assert from 'node:assert/strict'
import test from 'node:test'

import { getTopNavigation, logOutToHome } from '../src/navigation.js'

test('keeps only Home available to signed-out visitors', () => {
  const navigation = getTopNavigation(false)

  assert.deepEqual(
    navigation.map(({ label, to, locked, loginHint }) => ({ label, to, locked, loginHint })),
    [
      { label: 'Home', to: '/', locked: false, loginHint: undefined },
      { label: 'Make a Pick', to: '/login', locked: true, loginHint: 'Log in to view Make a Pick' },
      { label: 'Standings', to: '/login', locked: true, loginHint: 'Log in to view Standings' },
      { label: 'Schedule', to: '/login', locked: true, loginHint: 'Log in to view Schedule' },
    ],
  )
})

test('keeps every top navigation destination available to signed-in members', () => {
  const navigation = getTopNavigation(true)

  assert.deepEqual(
    navigation.map(({ label, to, locked }) => ({ label, to, locked })),
    [
      { label: 'Home', to: '/', locked: false },
      { label: 'Make a Pick', to: '/pick', locked: false },
      { label: 'Standings', to: '/standings', locked: false },
      { label: 'Schedule', to: '/schedule', locked: false },
    ],
  )
})

test('signs out before returning a member to Home', async () => {
  const events = []

  await logOutToHome(
    async () => {
      events.push('signed out')
    },
    (destination) => {
      events.push(`navigate:${destination}`)
    },
  )

  assert.deepEqual(events, ['signed out', 'navigate:/'])
})
