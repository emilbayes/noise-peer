var test = require('tape')
var peer = require('..')
var transport = require('./helpers/chopped-stream')

test('simple example', function (assert) {
  assert.plan(1)
  var t = transport()

  var client = peer(t.a, true)
  var server = peer(t.b, false)

  var body = ''
  server.on('data', function (ch) {
    body += ch
  })

  server.on('error', assert.error)
  client.on('error', assert.error)
  server.on('end', function () {
    assert.equal(body, 'Hello World', 'Should be same string')
    assert.end()
  })

  client.write('Hello ')
  client.end('World')
})

test('echo example', function (assert) {
  assert.plan(1)
  var t = transport()

  var client = peer(t.a, true)
  var server = peer(t.b, false)

  server.pipe(server)

  var body = ''
  client.on('data', function (ch) {
    body += ch
  })

  client.on('end', function () {
    assert.equal(body, 'Hello World', 'Should be same string')
    assert.end()
  })

  client.write('Hello ')
  client.end('World')
})

test('large message', function (assert) {
  assert.plan(1)
  var t = transport()

  var client = peer(t.a, true)
  var server = peer(t.b, false)

  var body = []
  server.on('data', function (ch) {
    body.push(ch)
  })

  var largeMsg = Buffer.alloc(70000, 'hello world')

  server.on('end', function () {
    assert.same(Buffer.concat(body), largeMsg, 'Should be same string')
    assert.end()
  })

  client.write(largeMsg)
  client.end()
})

test('chunk boundaries', function (assert) {
  var t = transport()

  var client = peer(t.a, true)
  var server = peer(t.b, false)

  server.on('data', function (ch) {
    // assert.equal(ch.byteLength, 0xffff - secretstream.ABYTES)
    assert.ok(ch.byteLength)
  })

  var smallMsg = Buffer.alloc(0xf0f, 'hello world')

  server.on('end', function () {
    assert.end()
  })

  for (var i = 0; i < 17; i++) {
    client.write(smallMsg)
  }
  client.end()
})
