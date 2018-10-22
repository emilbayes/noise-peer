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

// choppa seems to slow this one immensely
test('very large message (slow)', function (assert) {
  assert.plan(1)
  var t = transport()

  var client = peer(t.a, true)
  var server = peer(t.b, false)

  var body = []
  server.on('data', function (ch) {
    body.push(ch)
  })

  var largeMsg = Buffer.alloc(512000, 'hello world')

  server.on('end', function () {
    assert.same(Buffer.concat(body), largeMsg, 'Should be same string')
    assert.end()
  })

  client.write(largeMsg.slice(0, 256000))

  process.nextTick(function () {
    client.write(largeMsg.slice(256000))
    client.end()
  })
})
