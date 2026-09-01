import assert from 'node:assert/strict'
import test from 'node:test'

import { formatLocalKickoff } from '../src/kickoffTime.js'

test('formats a kickoff in the visitor time zone', () => {
  assert.equal(
    formatLocalKickoff('2026-09-13T17:00:00Z', { locale: 'en-US', timeZone: 'America/New_York' }),
    'Kickoff on Sunday, Sep 13 @ 1:00 PM EDT',
  )
})

test('converts the same kickoff for another visitor time zone', () => {
  assert.equal(
    formatLocalKickoff('2026-09-13T17:00:00Z', { locale: 'en-US', timeZone: 'America/Los_Angeles' }),
    'Kickoff on Sunday, Sep 13 @ 10:00 AM PDT',
  )
})
