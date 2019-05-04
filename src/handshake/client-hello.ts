import { detectExtension } from './helper'
import { HandshakeType } from './constans';

export function detect(protocol: any, buf: Buffer) {
  let pos = 0
  protocol.handshake = {
    type: parseInt(buf.slice(pos, ++pos).toString('hex'), 16),
    length: buf.slice(pos, pos += 3).toString('hex'),
    version: buf.slice(pos, pos += 2).toString('hex'),
    name: ''
  }
  protocol.handshake.name = HandshakeType[protocol.handshake.type]

  protocol.handshake.random = {
    gmt_unix_time: buf.slice(pos, pos += 4).toString('hex'),
    data: buf.slice(pos, pos += 28).toString('hex')
  }

  const session_len = parseInt(buf.slice(pos, ++pos).toString('hex'), 16)
  protocol.handshake.session = buf.slice(pos, pos += session_len).toString('hex')

  const cs_len = parseInt(buf.slice(pos, pos += 2).toString('hex'), 16)
  protocol.handshake.cipher_suites = []
  for (let i = 0; i < cs_len; i += 2) {
    protocol.handshake.cipher_suites.push(buf.slice(pos, pos += 2).toString('hex'))
  }

  const cm_len = buf.slice(pos, ++pos).toString('hex')
  protocol.handshake.compression_method = buf.slice(pos, pos += parseInt(cm_len, 16)).toString('hex')

  const ext_len = parseInt(buf.slice(pos, pos += 2).toString('hex'), 16)
  protocol.handshake.extension = detectExtension(buf.slice(pos, pos += ext_len))
}
