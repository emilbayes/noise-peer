var test = require('tape')
var peer = require('..')
var choppedTransport = require('./helpers/chopped-stream')
var ptTransport = require('./helpers/passthrough-stream')

test('simple destroy', function (assert) {
  assert.plan(3)
  var t = choppedTransport()

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

test('destroy on data', function (assert) {
  assert.plan(1)
  var t = ptTransport()

  const a = peer(t.a, true)
  const b = peer(t.b, false)
  var data = Buffer.alloc(32, 'random data')

  b.on('data', function (data) {
    b.destroy()
  })

  a.write(data)

  a.on('error', function (err) {
    assert.ok(err.message.includes('MITM')) // good enough for now
  })
})

test('destroy on rekey') // TODO
