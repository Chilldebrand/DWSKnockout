import assert from 'node:assert/strict'
import test from 'node:test'

import { getCountdownGame } from '../src/countdownGame.js'

const games = [
  { id: 'wednesday-game', home_team: 'patriots', away_team: 'seahawks' },
  { id: 'sunday-game', home_team: 'ravens', away_team: 'bengals' },
]

test('uses the selected team game instead of the first game of the week', () => {
  assert.equal(getCountdownGame(games, { team: 'ravens' })?.id, 'sunday-game')
})

test('uses the recorded game id when it is available', () => {
  assert.equal(getCountdownGame(games, { game_id: 'sunday-game', team: 'ravens' })?.id, 'sunday-game')
})

test('returns no countdown game before a pick is made', () => {
  assert.equal(getCountdownGame(games, null), null)
})
