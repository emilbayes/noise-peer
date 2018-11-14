var duplexify = require('duplexify')
var PassThrough = require('stream').PassThrough

module.exports = function rawStream (n) {
  var a = new PassThrough()
  var b = new PassThrough()

  return {
    a: duplexify(a, b),
    b: duplexify(b, a)
  }
}
