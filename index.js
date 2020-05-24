var secretstream = require('secretstream-stream')
var simpleHandshake = require('simple-handshake')
var stream = require('readable-stream')
var assert = require('nanoassert')
var sodium = require('sodium-native')

class NoisePeer extends stream.Duplex {
  constructor (rawStream, isInitiator, opts) {
    assert(rawStream != null, 'rawStream must be duplex stream')
    assert(typeof isInitiator === 'boolean', 'isInitiator must be boolean')
    super()

    this.initiator = isInitiator

    this.rawStream = rawStream
    this._handshake = simpleHandshake(isInitiator, opts)
    this._transport = null
    // flag to indicate whether transport got a finish message
    this._transportfinished = false
    this._endPending = false

    this._missing = 0
    this._paused = false
    this._draincb = null
    this._writePending = null

    // If client, start the handshaking
    if (isInitiator === true) this._sendhandshake()

    this.rawStream.on('readable', this._onreadable.bind(this))
    this.rawStream.on('drain', this._ondrain.bind(this))
    this.rawStream.on('error', this.destroy.bind(this))

    var ended = false
    var finished = false
    this.rawStream.on('end', () => {
      if (finished) return this._cleanup()
      ended = true
      this._cleanupReadable()
    })

    this.rawStream.on('finish', () => {
      if (ended) return this._cleanup()
      finished = true
      this._cleanupWritable()
    })

    this.rawStream.on('close', this._onclose.bind(this))

    this.on('finish', this.rawStream.end.bind(this.rawStream))

    // Timeout if supported by the underlying stream
    if (this.rawStream.setTimeout) this.setTimeout = this.rawStream.setTimeout.bind(this.rawStream)
    this.rawStream.on('timeout', this.emit.bind(this, 'timeout'))

    // kick the onreadable loop
    this._onreadable()
  }

  _recvhandshake (data) {
    // pause while reading. Will be cleared by the two return paths inside the
    // callback by invoking _read
    this._paused = true
    this._handshake.recv(data, (err, msg) => {
      if (this.destroyed) return
      if (err) return this.destroy(err)

      if (this._handshake.finished) return this._onhandshake()

      this._sendhandshake()
    })
  }

  _sendhandshake () {
    this._handshake.send(null, (err, buf) => {
      if (this.destroyed) return
      if (err) return this.destroy(err)

      this.rawStream.cork() // put buf and header in the same packet
      this.rawStream.write(this._frame(buf))
      if (this._handshake.finished) return this._onhandshake()
      this.rawStream.uncork()

      this._read()
    })
  }

  _onhandshake () {
    this.emit('handshake', {
      remoteStaticKey: this._handshake.state.rs,
      remoteEphemeralKey: this._handshake.state.re,
      handshakeHash: this._handshake.handshakeHash
    })
    if (this.destroyed) return

    var header = Buffer.alloc(secretstream.HEADERBYTES)

    this._transport = {
      tx: secretstream.encrypt(header, this._handshake.split.tx.subarray(0, 32)),
      rx: null
    }

    sodium.sodium_free(this._handshake.split.tx)
    this._handshake.split.tx = null
    this.rawStream.write(this._frame(header))
    this.rawStream.uncork()

    assert(!this._endPending || !this._writePending)
    if (this._endPending) {
      this._final(this._endPending)
    }

    if (this._writePending) this._drainpendingwrite()
    this._read()
  }

  _drainpendingwrite () {
    var self = this
    var chunks = self._writePending.chunks

    self._writev(chunks, onwrite)

    function onwrite (err) {
      var fn = self._writePending.cb
      self._writePending = null
      return fn(err)
    }
  }

  _onheader (header) {
    this._transport.rx = secretstream.decrypt(header, this._handshake.split.rx.subarray(0, 32))
    sodium.sodium_free(this._handshake.split.rx)
    this._handshake.split.rx = null
    this.emit('connected')
  }

  _write (chunk, encoding, cb) {
    return this._writev([{ chunk, encoding }], cb)
  }

  _writev (chunks, cb) {
    if (this._transport == null) {
      // buffer {data, cb} and wait for handshake to finish succesful
      this._writePending = { chunks, cb }
      return
    }

    var TRANSPORT_BYTES = 0xffff - secretstream.ABYTES - 2

    // fully handshook
    var canContinue = true
    var packet = []
    var packetBytes = 0

    for (var { chunk } of chunks) {
      if (packetBytes + chunk.byteLength < TRANSPORT_BYTES) {
        packet.push(chunk)
        packetBytes += chunk.byteLength
        continue
      }

      var remainingBytes = TRANSPORT_BYTES - packetBytes
      packet.push(chunk.subarray(0, remainingBytes))
      canContinue = this._sendtransport(Buffer.concat(packet, TRANSPORT_BYTES))

      packet = []
      packetBytes = 0
      chunk = chunk.subarray(remainingBytes)

      while (chunk.byteLength > TRANSPORT_BYTES) {
        canContinue = this._sendtransport(chunk.subarray(0, TRANSPORT_BYTES))
        chunk = chunk.subarray(TRANSPORT_BYTES)
      }

      if (chunk.byteLength > 0) {
        packet.push(chunk)
        packetBytes += chunk.byteLength
      }
    }

    if (packetBytes) canContinue = this._sendtransport(Buffer.concat(packet, packetBytes))

    if (canContinue === false) {
      this._draincb = cb
      return
    }

    cb(null)
  }

  _sendtransport (msgBuf, tag) {
    return this.rawStream.write(this._frame(this._encrypt(msgBuf, tag)))
  }

  _recvtransport (buf) {
    if (this._transportfinished === true) {
      this.destroy(new Error('Received message after FINISH tag (misbehaving remote)'))
      return false
    }

    return this._decrypt(buf)
  }

  _encrypt (plaintext, tag) {
    if (tag == null) tag = secretstream.TAG_MESSAGE
    return this._transport.tx.encrypt(tag, plaintext)
  }

  _decrypt (ciphertext) {
    var plaintext = this._transport.rx.decrypt(ciphertext)
    var didBackpressure = this.push(plaintext)
    if (this.destroyed) return

    if (this._transport.rx.decrypt.tag.equals(secretstream.TAG_REKEY)) {
      this.emit('rekey')
      if (this.destroyed) return
    }

    if (this._transport.rx.decrypt.tag.equals(secretstream.TAG_FINAL)) {
      this._transportfinished = true
      didBackpressure = this.push(null)
    }

    return didBackpressure
  }

  _final (cb) {
    this._endPending = null
    if (this._transport && this._transport.tx) {
      this._sendtransport(Buffer.alloc(0), secretstream.TAG_FINAL)
      cb()
    } else {
      this._endPending = cb
    }
  }

  _frame (buf) {
    var frame = Buffer.alloc(2 + buf.byteLength)
    frame.writeUInt16BE(buf.byteLength, 0)
    frame.set(buf, 2)
    return frame
  }

  _readframeheader () {
    const lengthPrefix = this.rawStream.read(2)
    if (lengthPrefix === null) return false
    if (lengthPrefix.byteLength < 2) {
      this.destroy(new Error('Ended mid-length-prefix'))
      return false
    }

    // set framing
    this._missing = lengthPrefix.readUInt16BE(0)
    return true
  }

  _readframebody () {
    const frame = this.rawStream.read(this._missing)
    if (frame === null) return false
    if (frame.byteLength < this._missing) {
      this.destroy(new Error('Ended mid-frame'))
      return false
    }

    // reset framing
    this._missing = 0

    if (this._handshake.finished === false) {
      this._recvhandshake(frame)
      return true
    }

    // handshaking is done and outgoing transport encryption is initialised
    // but incoming transport encryption is still not set
    if (this._transport && this._transport.rx == null) {
      this._onheader(frame)
      return true
    }

    // decrypt
    this._paused = this._recvtransport(frame)

    return true
  }

  _read (size) {
    if (this._paused === false) return

    this._paused = false
    this._onreadable()
  }

  _ondrain () {
    if (this._draincb == null) return

    const fn = this._draincb
    this._draincb = null
    fn()
  }

  _onclose () {
    if (this.destroyed) return
    if (this._handshake.finished === false) return this.destroy(new Error('Remote closed before handshake could complete (possible MITM vector)'))
    if (this._transportfinished === false) return this.destroy(new Error('Remote closed without sending a FINISH tag (possible MITM vector)'))
    this.destroy()
  }

  _onreadable () {
    while (this._paused === false && this.destroyed === false) {
      if (this._missing === 0) { // has no framing
        if (this._readframeheader() !== true) break
      } else {
        if (this._readframebody() !== true) break
      }
    }
  }

  _cleanupReadable () {
    if (this._handshake.finished === false) this._handshake.destroy()
    if (this._transport) {
      if (this._transport.rx) {
        this._transport.rx.destroy()
        this._transport.rx = null
      }
    }

    if (this._handshake.split && this._handshake.split.rx) {
      sodium.sodium_free(this._handshake.split.rx)
    }
  }

  _cleanupWritable () {
    if (this._handshake.finished === false) this._handshake.destroy()
    if (this._transport) {
      if (this._transport.tx) {
        this._transport.tx.destroy()
        this._transport.tx = null
      }
    }

    if (this._handshake.split && this._handshake.split.tx) {
      sodium.sodium_free(this._handshake.split.tx)
    }
  }

  _cleanup () {
    this._cleanupReadable()
    this._cleanupWritable()

    this._handshake.split = null
  }

  _destroy (err, callback) {
    this._paused = true

    this._cleanup()

    this.rawStream.destroy(err)
    callback(err)
  }
}

module.exports = (...args) => new NoisePeer(...args)
module.exports.keygen = simpleHandshake.keygen
module.exports.seedKeygen = simpleHandshake.seedKeygen
