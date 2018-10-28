var net = require('net')
var pump = require('pump')
var peer = require('..')

// This is the most basic handshake pattern, yielding a "perfect forward secure"
// connection, but with no authentication (in the cryptographic sense) of either
// peer end.
var server = net.createServer(function onconnection (rawStream) {
  var sec = peer(rawStream, false)

  // Server simply echos, but also implicitly calls .end() causing a "FINISH"
  // message to be sent, letting the other party know the stream ended nicely,
  // and was not servered by an adversary
  pump(sec, sec, function (err) {
    if (err) throw err
  })
})

server.listen(function () {
  var port = server.address().port

  // Connect to the server. Discovery depends on application, but could be DNS,
  // DHT or ip:port directly
  var clientRawStream = net.connect(port)
  var clientSec = peer(clientRawStream, true)

  clientSec.on('data', function (data) {
    console.log(data.toString())
  })

  clientSec.on('end', function () {
    server.close()
  })

  clientSec.write('Hello world')
  // End the stream nicely, so the other party receives a "FINISH" message
  clientSec.end()
})
