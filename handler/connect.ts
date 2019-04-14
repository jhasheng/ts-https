import * as http from 'http'
import * as https from 'https'
import { Socket, connect } from 'net'
import { FakeCenter } from './fake-center';

export class Connect {
  constructor(private fake: FakeCenter) {}

  invoke(request: http.IncomingMessage, socket: Socket, header: Buffer) {
    this.fake.invoke()
    const [hostname, port] = request.headers.host.split(':')
    const forward = connect(+port, hostname, () => {
      forward.write(header)
      forward.pipe(socket)
      socket.write(`HTTP/1.1 200 Connection Established\r\nProxy-agent: test-mitmproxy\r\n\r\n`)
      socket.pipe(forward)
    })

    forward.on('error', error => {
      console.error(error)
    })
    
  }
}