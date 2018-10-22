var test = require('tape')
var peer = require('..')
var transport = require('./helpers/chopped-stream')
var secretstream = require('secretstream-stream')
test('simple destroy', function (assert) {
  assert.plan(1)
  var t = transport()

  const a = peer(t.a, true)
  const b = peer(t.b, false)

  a._sendtransport(Buffer.from('Goodbye'), secretstream.TAG_FINAL)
  a._sendtransport(Buffer.from('Goodbye'), secretstream.TAG_FINAL)

  b.on('error', function (err) {
    assert.ok(err.message.includes('FINISH')) // good enough for now
  })
  a.on('error', () => {})

  b.resume()
})
