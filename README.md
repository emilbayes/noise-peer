# `noise-peer`

> Simple one-to-one secure channels using Noise Protocol Framework and libsodium secretstream

## Usage

Below is an example of a secure UPPERCASE echo server.

Server:

```js
var peer = require('noise-peer')
var through = require('through2')
var pump = require('pump')
var net = require('net')

var server = net.createServer(function (rawStream) {
  var sec = peer(rawStream, false)

  pump(sec, through(function (buf, _, cb) {
    cb(null, buf.toString().toUpperCase())
  }), sec)
})

server.listen(5000)
```

Client:

```js
var peer = require('noise-peer')
var pump = require('pump')
var net = require('net')

var rawStream = net.connect(5000)

var sec = peer(rawStream, true)

pump(sec, process.stdout)
sec.end('beep boop\n')
```

## API

### `var secureStream = peer(rawStream, isInitiator, [noiseOpts])`

Create a new peer, performing handshaking transparently. Note that all messages
are chunked to ~64kb size due to a 2 byte length header. By default the Noise
`NN` pattern is used, which simply creates a [forward secret](https://en.wikipedia.org/wiki/Forward_secrecy)
channel. This does not authenticate either party. To have mutual authentication
use the `XX` pattern, add a static keypair and provide a `onstatickey` function:

```js
var opts = {
  pattern: 'XX',
  staticKeyPair: peer.keygen(),
  onstatickey: function (remoteKey, done) {
    if (remoteKey.equals(someSavedKey)) return done()

    return done(new Error('Unauthorized key'))
  }
}
```

## Install

```sh
npm install noise-peer
```

## License

[ISC](LICENSE)
