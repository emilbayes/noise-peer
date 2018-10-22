var test = require('tape')
var net = require('net')
var pump = require('pump')
var peer = require('..')

test('server timeout', function (assert) {
  var server = net.createServer(function onconnection (rawStream) {
    var sec = peer(rawStream, false)
    sec.on('timeout', function () {
      sec.end()
      assert.end()
    })

    sec.setTimeout(100, assert.pass)

    pump(sec, sec, err => assert.error(err, 'server ended'))
  })

  server.listen(function () {
    server.unref()
    var port = server.address().port

    var clientRawStream = net.connect(port)
    var clientSec = peer(clientRawStream, true)

    clientSec.on('error', assert.error)
    clientSec.on('end', function () {
      assert.error('closed nicely')
    })
  })
})

test('client timeout', function (assert) {
  var server = net.createServer(function onconnection (rawStream) {
    var sec = peer(rawStream, false)

    pump(sec, sec, err => assert.error(err, 'server ended'))
  })

  server.listen(function () {
    server.unref()
    var port = server.address().port

    var clientRawStream = net.connect(port)
    var clientSec = peer(clientRawStream, true)

    clientSec.on('timeout', function () {
      clientSec.end()
      assert.end()
    })

    clientSec.setTimeout(100, assert.pass)

    clientSec.on('error', assert.error)
    clientSec.on('end', function () {
      assert.error('closed nicely')
    })
  })
})
