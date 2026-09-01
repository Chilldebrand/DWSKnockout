import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldShowSideCharacters } from '../src/sideCharacters.js'

test('shows side characters only for signed-in members away from Home', () => {
  assert.equal(shouldShowSideCharacters(true, '/pick'), true)
  assert.equal(shouldShowSideCharacters(true, '/standings'), true)
  assert.equal(shouldShowSideCharacters(true, '/schedule'), true)
  assert.equal(shouldShowSideCharacters(true, '/admin'), true)
})

test('keeps side characters off the public and signed-in Home screens', () => {
  assert.equal(shouldShowSideCharacters(false, '/pick'), false)
  assert.equal(shouldShowSideCharacters(false, '/'), false)
  assert.equal(shouldShowSideCharacters(true, '/'), false)
  assert.equal(shouldShowSideCharacters(false, '/login'), false)
})
