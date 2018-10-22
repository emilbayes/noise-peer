var duplexify = require('duplexify')
var through = require('through2')

module.exports = function rawStream (n) {
  var a = through(function (data, _, cb) {
    if (--n) return cb(null, data)
    this.destroy()
  })
  var b = through(function (data, _, cb) {
    if (--n) return cb(null, data)
    this.destroy()
  })

  return {
    a: duplexify(a, b),
    b: duplexify(b, a)
  }
}
