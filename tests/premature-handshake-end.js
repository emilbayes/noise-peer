var test = require('tape')
var peer = require('..')
var rtStream = require('./helpers/rt-stream')

test('XX exchange ephemerals', function (assert) {
  assert.plan(2)
  var rt = rtStream(2)

  var client = peer(rt.a, true, {pattern: 'XX', staticKeyPair: peer.keygen()})
  var server = peer(rt.b, false, {pattern: 'XX', staticKeyPair: peer.keygen()})

  client.on('error', assert.pass)
  server.on('error', assert.pass)
})

test('XX exchange ephemerals', function (assert) {
  assert.plan(2)
  var rt = rtStream(3)

  var client = peer(rt.a, true, {pattern: 'XX', staticKeyPair: peer.keygen()})
  var server = peer(rt.b, false, {pattern: 'XX', staticKeyPair: peer.keygen()})

  server.on('error', assert.pass)
  client.on('error', assert.pass)
})

test('NN client sends ephemeral', function (assert) {
  assert.plan(2)
  var rt = rtStream(1)

  var client = peer(rt.a, true)
  var server = peer(rt.b, false)

  client.on('error', assert.pass)
  server.on('error', assert.pass)
})
