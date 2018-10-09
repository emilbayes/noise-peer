var peer = require('.')
var through = require('through2')
var pump = require('pump')

var net = require('net')
var server = net.createServer(function (rawStream) {
  var sec = peer(rawStream, false)

  pump(sec, through(function (buf, _, cb) {
    cb(null, buf.toString().toUpperCase())
  }), sec, err => console.error('server', err))
})

server.listen(5000, function () {
  var rawStream = net.connect(5000)

  var sec = peer(rawStream, true)

  pump(sec, process.stdout, err => console.error('client', err))
  sec.end('beep boop\n')
})
