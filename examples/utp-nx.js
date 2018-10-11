// Example for NX pattern
// This is pattern means the client is anonymous, but the server sends its
// public key over a forward secret channel. This is kinda like SSL/TLS with
// HPKP

var utp = require('utp-native')
var pump = require('pump')
var peer = require('..')

var serverKeys = peer.keygen()
console.log('generated server key', serverKeys.publicKey)
var server = utp.createServer(function onconnection (rawStream) {
  var sec = peer(rawStream, false, {
    pattern: 'NX',
    // Normally these keys would be stored long-term
    staticKeyPair: serverKeys
  })

  pump(sec, sec, function (err) {
    if (err) throw err
  })
})

server.listen(function () {
  var port = server.address().port

  var clientRawStream = utp.connect(port)
  var clientSec = peer(clientRawStream, true, {
    pattern: 'NX',
    onstatickey: function (serverStaticKey, done) {
      // Here you can validate the server publicKey, eg. against a preexchanged
      // public key.
      console.log('received server key ', serverStaticKey)
      done() // Call with err to abort connection
    }
  })

  clientSec.on('data', function (data) {
    console.log(data.toString())
  })

  clientSec.on('end', function () {
    server.close()
  })

  clientSec.write('Hello world')
  clientSec.end()
})
