import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldShowSideCharacters } from '../src/sideCharacters.js'

test('shows side characters only on the signed-in Home screen', () => {
  assert.equal(shouldShowSideCharacters(true, '/'), true)
})

test('keeps side characters off public Home and every other page', () => {
  assert.equal(shouldShowSideCharacters(false, '/pick'), false)
  assert.equal(shouldShowSideCharacters(false, '/'), false)
  assert.equal(shouldShowSideCharacters(true, '/pick'), false)
  assert.equal(shouldShowSideCharacters(true, '/standings'), false)
  assert.equal(shouldShowSideCharacters(true, '/schedule'), false)
  assert.equal(shouldShowSideCharacters(true, '/admin'), false)
  assert.equal(shouldShowSideCharacters(false, '/login'), false)
})
