 import { detectExtension } from './../helper'
import { HandshakeType } from './../constans'
import { CipherSuites } from './../cipher-suite'

export function detect(buf: Buffer) {
  let pos = 0
  let handshake = {
    type: parseInt(buf.slice(pos, pos += 1).toString('hex'), 16),
    length: buf.slice(pos, pos += 3).toString('hex'),
    version: buf.slice(pos, pos += 2).toString('hex'),
    name: 'ServerHello', random: {}, session: '', cipher_suite: {}, compression_method: '', extension: []
  }
  handshake.name = HandshakeType[handshake.type]

  handshake.random = {
    gmt_unix_time: new Date(parseInt(buf.slice(pos, pos += 4).toString('hex'), 16) * 1000).toISOString(),
    data: buf.slice(pos, pos += 28).toString('hex')
  }

  const session_len = parseInt(buf.slice(pos, ++pos).toString('hex'), 16)
  handshake.session = buf.slice(pos, pos += session_len).toString('hex')

  const cs = buf.slice(pos, pos += 2).toString('hex')
  handshake.cipher_suite = { [cs]: CipherSuites[parseInt(cs, 16)] ? CipherSuites[parseInt(cs, 16)] : 'UNKNOWN' }

  const cm_len = buf.slice(pos, ++pos).toString('hex')
  handshake.compression_method = buf.slice(pos, pos += parseInt(cm_len, 16)).toString('hex')

  const ext_len = parseInt(buf.slice(pos, pos += 2).toString('hex'), 16)
  // handshake.ext_len = ext_len
  handshake.extension = detectExtension(buf.slice(pos, pos += ext_len))
  // console.info('^^^^^^^^^^^^^%s %s', [pos, buf.length].join('/'), buf.toString('hex'))
  return handshake
}
