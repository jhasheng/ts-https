import * as http from 'http'
import * as https from 'https'

export class Request {
  constructor(private reqInterceptor, private resIntercepter) {}

  invoke(request: http.IncomingMessage, response: http.ServerResponse, ssl: boolean) {
    if (request.headers.connection === 'close') {
      request.socket.setKeepAlive(false)
    } else if (request.socket.connecting !== null) {
      request.socket.setKeepAlive(true, 3600 * 1000)
    } else {
      request.socket.setKeepAlive(true, 30000)
    }
    // request 拦截器
    // requestInterceptorPromise

    if (ssl) {
    }
  }
}