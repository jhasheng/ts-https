import { detectExtension } from '../helper'
import { HandshakeType } from '../constans'
import { CipherSuites } from '../cipher-suite'
import { permuteDomain } from 'tough-cookie'
import * as pem from 'pem'
import * as fs from 'fs'

export function detect(buf: Buffer) {
  let pos = 0
  let handshake = {
    type: parseInt(buf.slice(pos, pos += 1).toString('hex'), 16),
    length: buf.slice(pos, pos += 3).toString('hex'),
    name: 'Certificate',
    chains: []
  }

  while(pos < buf.length) {
    const len = parseInt(buf.slice(pos, pos += 3).toString('hex'), 16)
    fs.writeFileSync(`./data/${pos}.cert`, buf.slice(pos, pos += len))
  }

  

  return handshake
}
