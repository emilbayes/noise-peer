var test = require('tape')
var peer = require('../..')
var transport = require('../helpers/chopped-stream')

// this test is still work in progress
test('N server write', function (assert) {
  assert.plan(1)
  var t = transport()

  var serverKeys = peer.keygen()
  var client = peer(t.a, true, {
    pattern: 'N',
    remoteStaticKey: serverKeys.publicKey
  })
  var server = peer(t.b, false, {
    pattern: 'N',
    staticKeyPair: serverKeys
  })

  server.write('Hello World')
  server.end()

  var body = ''
  client.on('data', function (ch) {
    body += ch
  })

  client.on('end', function () {
    assert.equal(body, 'Hello World', 'Should be same string')
    assert.end()
  })
})
