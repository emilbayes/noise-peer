var test = require('tape')
var peer = require('..')
var transport = require('./helpers/chopped-stream')

test('simple example', function (assert) {
  var t = transport()

  const a = peer(t.a, true)
  const b = peer(t.b, false)

  a.write('hi')
  b.on('data', function (data) {
    assert.same(data, Buffer.from('hi'))
    b.destroy()
  })

  b.on('close', assert.end)
})
