import * as net from 'net'
import * as http from 'http'
import * as WebSocket from 'ws'
import { createLogger } from './logger'
import { HackTLS, Monitor } from './constans'
import { FakeServer } from './fake-server'
import { isLocalIP, readResource } from './utils'

const logger = createLogger('index')

export default class MITM extends FakeServer {
  // 代理服务器
  private server: http.Server
  // 监控服务器
  private monitor: WebSocket.Server
  // 监控端
  private client: WebSocket

  private constructor(private port: number = 9000) {
    super()
  }

  send(data: Monitor) {
    // if (this.client && this.client.OPEN === WebSocket.OPEN) {
    //   data.response = response
    //   data.uuid = uuid
    //   this.client.send(JSON.stringify(data))
    // }
  }

  static createServer() {
    new MITM().start()
  }

  start() {
    const server = http.createServer()
    this.server = server
    // 服务启动
    server.on('listening', () => logger.verbose('proxy server start at: %j', server.address()))
    server.on('error', (err: Error) => logger.error('proxy error: %j', err))
    // http 请求代理
    server.on('request', this.onRequest.bind(this))
    // https 代理前会前发送 connect 请求
    server.on('connect', this.onConnect.bind(this))
    server.listen(this.port)

    // this.monitor = new WebSocket.Server({ server })
    // this.monitor.on('connection', (client: WebSocket, request: http.IncomingMessage) => {
    //   this.client = client
    // })

    // this.monitor.on('error', err => logger.error('monitor error: %j', err))
    // server.on('upgrade', this.onUpgrade.bind(this))
  }

  private onUpgrade(request: http.IncomingMessage, socket: net.Socket, head: Buffer) {
    this.monitor.handleUpgrade(request, socket, head, client => this.monitor.emit('connection', client, request))
  }

  private onConnect(request: http.IncomingMessage, socket: net.Socket, head: Buffer) {
    const [host, port] = request.url.split(':')
    logger.verbose('connect: %s ', request.url)
    // HackTLS 启用中间人代理
    if (HackTLS) {
      this.createFakeServer(host).then(({ port }) => this.forward(socket, port, head))
    } else {
      this.forward(socket, +port, head, host)
    }
  }

  private onRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    let [host, port] = request.headers.host.split(':')
    if (+port === this.port && isLocalIP(host)) {
      logger.info('local request')
      response.writeHead(200, { 'Content-Type': 'text/html' })
      readResource('src/index.html').pipe(response).on('close', () => response.end())
    } else {
      this.localRequest(request, response, false)
    }
  }

  private forward(socket: net.Socket, port: number, head: Buffer, host: string = '127.0.0.1'): void {
    logger.verbose('connect forward %s %s', port, host)
    const tmp = net.connect(port, host, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: MITM-proxy\r\n\r\n')
      tmp.write(head)
      tmp.pipe(socket)
      socket.pipe(tmp)
    })
    // tmp.setTimeout(0)
    tmp.on('error', err => logger.error('tmp error:', err))
    socket.on('error', err => logger.error('socket error: %j', err))
  }
}

MITM.createServer()