import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findFences } from '../src/fences.js'

test('finds wiredown and screens fences with their lines', () => {
  const md = '# T\n\n```wiredown v1 look=clean\nbutton "A"\n```\n\ntext\n~~~~screens\nh1 "B"\n~~~~\n'
  const f = findFences(md)
  assert.equal(f.length, 2)
  assert.deepEqual(f[0], { info: 'wiredown v1 look=clean', lang: 'wiredown', body: 'button "A"\n', openLine: 3, bodyLine: 4 })
  assert.equal(f[1].lang, 'screens'); assert.equal(f[1].bodyLine, 9)
})

test('ignores other fences, nested fence text and short closers', () => {
  const md = '````md\n```wiredown\nx\n```\n````\n```wiredown\na\n``\n```\n'
  const f = findFences(md)
  assert.equal(f.length, 1)
  assert.equal(f[0].body, 'a\n``\n')
})

test('indented opener strips its indent; unclosed runs to end; CRLF', () => {
  const f = findFences('  ```wiredown\r\n    button "x"\r\n')
  assert.equal(f[0].body, '  button "x"\n')
})

test('linear on hostile input', () => {
  const md = '```wiredown\n' + '```x\n'.repeat(20000)
  const t = performance.now(); findFences(md); assert.ok(performance.now() - t < 100)
})

test('a closing fence with trailing tabs or spaces closes; the next fence is found', () => {
  const md = '```wiredown\nbutton "A"\n```\t\n\ntext\n\n```wiredown\nbutton "B"\n``` \t \n'
  const f = findFences(md)
  assert.equal(f.length, 2)
  assert.equal(f[0].body, 'button "A"\n')
  assert.equal(f[1].body, 'button "B"\n')
})
