import { Server, IncomingMessage, ServerResponse } from 'http'
import { Socket, connect } from 'net'
import { FakeCenter } from './handler/fake-center'
import { Connect } from './handler/connect'

const proxy = new Server

proxy.on('error', (err: Error) => {
  console.log('error: ', err)
})

proxy.on('request', (request: IncomingMessage, response: ServerResponse) => {
  console.log('request', '....................', request.headers)
})

proxy.on('connect', (request: IncomingMessage, socket: Socket, header: Buffer) => {
  console.log('connect', header.toString())
  new Connect(new FakeCenter).invoke(request, socket, header)
})

proxy.on('listening', () => {
  console.log('proxy server start at: ', proxy.address())
})

proxy.listen(9000, '0.0.0.0')
