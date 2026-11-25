import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { flowPath } from '../src/export/index.js'

const login = readFileSync(new URL('./fixtures/login.wiredown', import.meta.url), 'utf8')
const ids = (body, info = 'wiredown') => flowPath(body, info).steps.map((s) => s.screenId)

test('links lead first, then variants, then storyboard order; via names the tapped element', () => {
  const r = flowPath(login, 'wiredown')
  assert.equal(r.ok, true)
  assert.deepEqual(r.steps, [
    { screenId: 'login', label: 'Sign in', via: null },
    { screenId: 'reset', label: 'Reset password', via: 'link-forgot-password' },
    { screenId: 'login-error', label: 'Sign in · Wrong password', via: null },
  ])
})

test('no links: the screen\'s variants in source order, then the next screen', () => {
  const body = 'screen a\n  text "a" #t\nvariant a-x of a\n  #t hide\nvariant a-y of a\n  #t disabled\nscreen b\n  text "b"'
  assert.deepEqual(ids(body), ['a', 'a-x', 'a-y', 'b'])
})

test('the first link in document order whose target is unvisited wins', () => {
  const body = 'screen a\n  button "To b" -> b\n  button "To c" -> c\nscreen b\n  button "Home" -> a\n  button "C" -> c\nscreen c\n  text "c"'
  const r = flowPath(body, 'wiredown')
  assert.deepEqual(r.steps.map((s) => [s.screenId, s.via]), [['a', null], ['b', 'button-to-b'], ['c', 'button-c']])
})

test('a link inside a link is not tappable; the outer one is taken', () => {
  const body = 'screen a\n  card "Card" -> c\n    button "Inner" -> b\nscreen b\n  text "b"\nscreen c\n  text "c"'
  assert.deepEqual(ids(body), ['a', 'c', 'b'])
})

test('cycles stop once every screen is visited', () => {
  assert.deepEqual(ids('screen a\n  button "B" -> b\nscreen b\n  button "A" -> a'), ['a', 'b'])
})

test('back links are never followed', () => {
  const body = 'screen a\n  button "B" -> b\nscreen b\n  navbar "B" back -> back\n  button "Back" -> back\nscreen c\n  text "c"'
  const r = flowPath(body, 'wiredown')
  assert.deepEqual(r.steps.map((s) => [s.screenId, s.via]), [['a', null], ['b', 'button-b'], ['c', null]])
})

test('@flow sets the order (repeats kept); via is the first link to the next step', () => {
  const body = '@flow c a b a\nscreen a\n  button "B" -> b\nscreen b\n  text "b"\nscreen c\n  text "c"'
  const r = flowPath(body, 'wiredown')
  assert.deepEqual(r.steps.map((s) => [s.screenId, s.via]), [['c', null], ['a', null], ['b', 'button-b'], ['a', null]])
})

test('@flow: a step reached through back gets that back link as via', () => {
  const body = '@flow a b a\nscreen a\n  button "B" -> b\nscreen b\n  navbar "B" back -> back\n  text "b"'
  const r = flowPath(body, 'wiredown')
  assert.deepEqual(r.steps.map((s) => [s.screenId, s.via]), [['a', null], ['b', 'button-b'], ['a', 'navbar-b']])
})

test('@flow naming a missing screen does not parse', () => {
  assert.equal(flowPath('@flow a nope\nscreen a\n  text "a"', 'wiredown').ok, false)
})

test('@flow starts the prototype too: without @flow the start is the first screen', () => {
  assert.deepEqual(ids('screen a\n  text "a"\nscreen b\n  text "b"'), ['a', 'b'])
  assert.deepEqual(ids('@flow b\nscreen a\n  text "a"\nscreen b\n  text "b"'), ['b'])
})

test('at most 24 steps', () => {
  let body = ''
  for (let i = 0; i < 24; i++) body += `screen s${i}\n  text "${i}" #t${i}\nvariant s${i}-v of s${i}\n  #t${i} hide\n`
  const r = flowPath(body, 'wiredown')
  assert.equal(r.ok, true)
  assert.equal(r.steps.length, 24)
  assert.deepEqual(r.steps.slice(0, 4).map((s) => s.screenId), ['s0', 's0-v', 's1', 's1-v'])
})

test('a block that does not parse gives ok: false; never throws', () => {
  assert.deepEqual(flowPath('@device nope', 'wiredown'), { ok: false, steps: [] })
  for (const v of [null, undefined, 42, {}, '']) assert.doesNotThrow(() => flowPath(v, v))
})

test('deterministic', () => {
  assert.deepEqual(flowPath(login, 'wiredown'), flowPath(login, 'wiredown'))
})
