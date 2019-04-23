import * as http from 'http'
import * as net from 'net'
import { createLogger } from './logger';
import { HackTLS } from './constans'
import { localRequest, forward } from './utils';
import { fakeServer } from './fake-server';

const logger = createLogger('demo')

let proxy = new http.Server
let port = 9000

proxy.listen(port, () => logger.verbose(`proxy server start at ${port}`))
// 错误
proxy.on('error', (err: Error) => logger.error(`proxy error: ${err}`))
// http 请求代理
proxy.on('request', localRequest)
// https 代理，https 代理前会前发送 connect 请求
proxy.on('connect', (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  const [host, port] = request.url.split(':')
  logger.verbose('connect: %s ', request.url)
  // HackTLS 启用中间人代理
  if (HackTLS) {
    fakeServer(host, ({ port }) => forward('127.0.0.1', port, socket))
  } else {
    forward(host, +port, socket)
  }
})
