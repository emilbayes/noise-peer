var utp = require('utp-native')
var pump = require('pump')
var peer = require('..')

// This example uses UTP as the transport protocol, which is a popular choise
// for data heavy applications and p2p. Otherwise this example is equivalent to
// `tcp.js`

// This is the most basic handshake pattern, yielding a "perfect forward secure"
// connection, but with no authentication (in the cryptographic sense) of either
// peer end.
var server = utp.createServer(function onconnection (rawStream) {
  var sec = peer(rawStream, false)

  pump(sec, sec, function (err) {
    if (err) throw err
  })
})

server.listen(function () {
  var port = server.address().port

  var clientRawStream = utp.connect(port)
  var clientSec = peer(clientRawStream, true)

  clientSec.on('data', function (data) {
    console.log(data.toString())
  })

  clientSec.on('end', function () {
    server.close()
  })

  clientSec.write('Hello world')
  clientSec.end()
})
