var test = require('tape')
var peer = require('..')
var transport = require('./helpers/chopped-stream')

test('simple destroy', function (assert) {
  assert.plan(3)
  var t = transport()

  const a = peer(t.a, true)
  const b = peer(t.b, false)

  a.write('hi')
  b.on('data', function (data) {
    assert.same(data, Buffer.from('hi'))
    b.destroy()
  })

  b.on('close', assert.pass)
  a.on('error', function (err) {
    assert.ok(err.message.includes('MITM')) // good enough for now
  })
})
