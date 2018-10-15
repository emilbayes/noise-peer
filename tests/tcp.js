var test = require('tape')
var net = require('net')
var pump = require('pump')
var peer = require('..')

test('simple tcp', function (assert) {
  var server = net.createServer(function onconnection (rawStream) {
    var sec = peer(rawStream, false)

    pump(sec, sec, err => assert.error(err, 'server ended'))
  })

  server.listen(function () {
    var port = server.address().port

    var clientRawStream = net.connect(port)
    var clientSec = peer(clientRawStream, true)

    var chunks = []
    clientSec.on('data', function (data) {
      chunks.push(data)
    })

    clientSec.on('error', assert.error)

    var expected = Buffer.from('Hello world')
    clientSec.on('end', function () {
      server.close()
      assert.same(Buffer.concat(chunks), expected, 'should receive sent message')
      assert.end()
    })

    clientSec.write(expected)
    clientSec.end()
  })
})
