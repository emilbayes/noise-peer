# `noise-peer`

[![Build Status](https://travis-ci.org/emilbayes/noise-peer.svg?branch=master)](https://travis-ci.org/emilbayes/noise-peer)

> Simple end-to-end encrypted, secure channels using Noise Protocol Framework and libsodium secretstream

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

More examples are available in [examples](examples)

## API

### `var {publicKey, secretKey} = peer.keygen()`

Generate a new key pair for use with `noiseOpts`. See the Handshake Pattern
examples

### `var secureStream = peer(rawStream, isInitiator, [noiseOpts])`

Create a new peer, performing handshaking transparently. Note that all messages
are chunked to ~64kb size due to a 2 byte length header. By default the Noise
`NN` pattern is used, which simply creates a
[forward secret](https://en.wikipedia.org/wiki/Forward_secrecy) channel.
This does not authenticate either party. See below for other handshake pattern
exapmles.

### `secureStream.initiator`

Boolean indicating whether the stream is a client/initiator or a
server/responder, as given by the `isInitiator` constructor argument.

### `secureStream.rawStream`

Access to the `rawStream` passed in the constructor

### `secureStream.end([chunk][, encoding][, callback])`

Special mention, as this also sends a `FINISH` message to the other party, which
signals that the stream is to end and no more messages are to be expected. This
is important to know that an active adversary did not truncate the stream.

### `secureStream.setTimeout(timeout[, callback])`

Call `setTimeout` on the underlying `rawStream` if supported. This function will
be undefined if not supported

### `secureStream.on('timeout')`

Bubble `timeout` event from the underlying `rawStream` if supported. You should
call either `.end()` (which sends a `FINISH` message to the other peer) or
`.destroy()` the stream manually (like eg. `net` specifies).

### `secureStream.on('handshake', {remoteStaticKey, remoteEphemeralKey, handshakeHash})`

Emitted when the handshaking has succeeded. `remoteStaticKey` may be `null` if
you're using a `pattern` which does not use or receive a remote static key. All
will be Buffers, with keys be cleared immediately after the handshake event.
The `handshakeHash` can be used for channel binding as described in the
[Noise Specficiation](https://noiseprotocol.org/noise.html#channel-binding)

### `secureSteam.on('connected')`

Emitted when the secure connection is fully established

### Handshake Pattern examples

To have mutual authentication use the `XX` pattern, add a static keypair and
provide a `onstatickey` function on both sides:

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

To have have client authentication but use a preshared server public key use the
`XK` pattern, add a static keypair on both sides, a remote static key on the
client and provide a `onstatickey` function on the server:

```js
var serverKeys = peer.keygen()

var clientOpts = {
  pattern: 'XK',
  staticKeyPair: peer.keygen(),
  remoteStaticKey: serverKeys.publicKey
}

var serverOpts = {
  pattern: 'XK',
  staticKeyPair: serverKeys,
  onstatickey: function (remoteKey, done) {
    if (remoteKey.equals(someSavedClientKey)) return done()

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
