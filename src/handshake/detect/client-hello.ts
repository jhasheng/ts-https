 import { detectExtension } from './../helper'
import { HandshakeType } from './../constans'
import { CipherSuites } from './../cipher-suite'

export function detect(buf: Buffer) {
  let pos = 0
  let handshake = {
    type: parseInt(buf.slice(pos, pos += 1).toString('hex'), 16),
    length: buf.slice(pos, pos += 3).toString('hex'),
    version: buf.slice(pos, pos += 2).toString('hex'),
    name: 'ClientHello', random: {}, session: '', cipher_suites: [], compression_method: '', extension: []
  }
  handshake.name = HandshakeType[handshake.type]

  handshake.random = {
    gmt_unix_time: new Date(parseInt(buf.slice(pos, pos += 4).toString('hex'), 16) * 1000).toISOString(),
    data: buf.slice(pos, pos += 28).toString('hex')
  }

  const session_len = parseInt(buf.slice(pos, ++pos).toString('hex'), 16)
  handshake.session = buf.slice(pos, pos += session_len).toString('hex')

  const cs_len = parseInt(buf.slice(pos, pos += 2).toString('hex'), 16)
  handshake.cipher_suites = []
  for (let i = 0; i < cs_len; i += 2) {
    const index = buf.slice(pos, pos += 2).toString('hex')
    if (CipherSuites[parseInt(index, 16)]) {
      handshake.cipher_suites.push({ [index]: CipherSuites[parseInt(index, 16)] })
    } else {
      handshake.cipher_suites.push({ [index]: 'UNKNOWN' })
    }
  }

  const cm_len = buf.slice(pos, ++pos).toString('hex')
  handshake.compression_method = buf.slice(pos, pos += parseInt(cm_len, 16)).toString('hex')

  const ext_len = parseInt(buf.slice(pos, pos += 2).toString('hex'), 16)
  handshake.extension = detectExtension(buf.slice(pos, pos += ext_len))

  return handshake
}
