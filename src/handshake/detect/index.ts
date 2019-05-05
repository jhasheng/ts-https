import { detect as ClientHello } from './client-hello'
import { detect as ServerHello } from './server-hello'
import { detect as NewSessionTicket } from './new-session-ticket'
import { detect as Certificate } from './certificate'

export function detect(buffer: Buffer) {
  let pos = 0
  const type = parseInt(buffer.slice(pos, pos += 1).toString('hex'), 16)
  console.log('>>>>>>>>>>>>>>> %s', type)
  switch (type) {
    case 1:
      // return ClientHello(buffer)
      break
    case 2:
      return ServerHello(buffer)
    case 4:
      return NewSessionTicket(buffer)
    case 11:
      return Certificate(buffer)
  }
}