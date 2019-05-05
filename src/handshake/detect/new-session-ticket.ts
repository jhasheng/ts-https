import { detectExtension } from './../helper'
import { HandshakeType } from './../constans'
import { CipherSuites } from './../cipher-suite'

export function detect(buf: Buffer) {
  let pos = 0
  let handshake = {
    type: parseInt(buf.slice(pos, pos += 1).toString('hex'), 16),
    length: buf.slice(pos, pos += 3).toString('hex'),
    name: 'NewSessionTicket',
    info: {
      life: parseInt(buf.slice(pos, pos += 4).toString('hex'), 16),
      length: parseInt(buf.slice(pos, pos += 2).toString('hex'), 16),
      ticket: buf.slice(pos).toString('hex')
    }
  }

  return handshake
}
