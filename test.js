var test = require('tape')
var peer = require('.')
var duplexify = require('duplexify')
var choppa = require('choppa')

test('simple example', function (assert) {
  assert.plan(1)
  var t = transport()

  var client = peer(t.c, true)
  var server = peer(t.s, false)

  var body = ''
  server.on('data', function (ch) {
    body += ch
  })

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

  var client = peer(t.c, true)
  var server = peer(t.s, false)

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

  var client = peer(t.c, true)
  var server = peer(t.s, false)

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

function transport (n) {
  var a = choppa(n)
  var b = choppa(n)

  return {
    c: duplexify(a, b),
    s: duplexify(b, a)
  }
}
