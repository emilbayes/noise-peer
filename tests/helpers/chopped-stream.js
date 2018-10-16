var duplexify = require('duplexify')
var choppa = require('choppa')

module.exports = function rawStream (n) {
  var a = choppa(n)
  var b = choppa(n)

  return {
    a: duplexify(a, b),
    b: duplexify(b, a)
  }
}
