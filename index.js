var secretstream = require('secretstream-stream')
var simpleHandshake = require('simple-handshake')
var stream = require('readable-stream')

class NoisePeer extends stream.Duplex {
  constructor (rawStream, isInitiator, opts) {
    super()

    this._rawStream = rawStream
    this._handshake = simpleHandshake(isInitiator, opts)
    this._transport = null

    this._missing = 0
    this._paused = false
    this._draincb = null
    this._writePending = null

    // If client, start the handshaking
    if (isInitiator === true) this._sendhandshake()

    this._rawStream.on('readable', this._onreadable.bind(this))
    this._rawStream.on('drain', this._ondrain.bind(this))
    // kick the onreadable loop
    this._onreadable()
  }

  _recvhandshake (data) {
    // pause while reading. Will be cleared by the two return paths inside the
    // callback by invoking _read
    this._paused = true
    this._handshake.recv(data, (err, msg) => {
      if (err) return this.destroy(err)

      if (this._handshake.finished) return this._onhandshake()

      this._sendhandshake()
    })
  }

  _sendhandshake () {
    this._handshake.send(null, (err, buf) => {
      if (err) return this.destroy(err)

      this._rawStream.write(this._frame(buf)) // @mafintosh
      if (this._handshake.finished) return this._onhandshake()

      this._read()
    })
  }

  _onhandshake () {
    this.emit('handshake')

    var header = Buffer.alloc(secretstream.HEADERBYTES)

    this._transport = {
      tx: secretstream.encrypt(header, this._handshake.split.tx),
      rx: null
    }

    this._rawStream.write(this._frame(header)) // @mafintosh

    if (this._writePending) {
      this._write(this._writePending.data, null, this._writePending.cb)
      this._writePending = null
    }

    this._read()
  }

  _onheader (header) {
    this._transport.rx = secretstream.decrypt(header, this._handshake.split.rx)
  }

  _write (data, enc, cb) {
    if (this._handshake.finished === false) {
      // buffer {data, cb} and wait for handshake to finish succesful
      this._writePending = { data, cb }
      return
    }

    // fully handshook
    var canContinue = true
    while (data.byteLength > 0) {
      var frameData = data.subarray(0, 0xffff - secretstream.ABYTES)
      canContinue = this._rawStream.write(this._frame(this._transport.tx.encrypt(secretstream.TAG_MESSAGE, frameData)))
      data = data.subarray(frameData.byteLength)
    }

    if (canContinue === false) {
      this._draincb = cb
      return
    }

    cb(null)
  }

  _final (cb) {
    this._rawStream.write(this._frame(this._transport.tx.encrypt(secretstream.TAG_FINAL, Buffer.alloc(0))))
    cb()
  }

  _frame (buf) {
    var frame = Buffer.alloc(2 + buf.byteLength)
    frame.writeUInt16BE(buf.byteLength, 0)
    frame.set(buf, 2)
    return frame
  }

  _readframeheader () {
    const lengthPrefix = this._rawStream.read(2)
    if (lengthPrefix === null) return false
    if (lengthPrefix.byteLength < 2) return this.destroy(new Error('Ended mid-length-prefix'))

    // set framing
    this._missing = lengthPrefix.readUInt16BE(0)
    return true
  }

  _readframebody () {
    const frame = this._rawStream.read(this._missing)
    if (frame === null) return false
    if (frame.byteLength < this._missing) return this.destroy(new Error('Ended mid-frame'))

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
    const plaintext = this._transport.rx.decrypt(frame)
    const shouldPause = this.push(plaintext) == null

    // handle special message types
    if (this._transport.rx.decrypt.tag.equals(secretstream.TAG_REKEY)) this.emit('rekey')
    if (this._transport.rx.decrypt.tag.equals(secretstream.TAG_FINAL)) {
      this.push(null)
    }

    if (shouldPause) this._paused = true

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

  _onreadable () {
    while (this._paused === false) {
      if (this._missing === 0) { // has no framing
        if (this._readframeheader() === false) break
      } else {
        if (this._readframebody() === false) break
      }
    }
  }

  _destroy (err, callback) {
    if (this._handshake.finished === false) this._handshake.destroy()
    if (this._transport) {
      if (this._transport.tx) this._transport.tx.destroy()
      if (this._transport.rx) this._transport.rx.destroy()
    }
    callback(err)
  }
}

NoisePeer.keygen = simpleHandshake.keygen

module.exports = (...args) => new NoisePeer(...args)
