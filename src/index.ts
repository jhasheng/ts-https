import * as net from 'net'
import * as http from 'http'
import * as fs from 'fs'
import * as WebSocket from 'ws'
import * as path from 'path'
import { createLogger } from './logger'
import { HackTLS } from './constans'
import { localRequest, forward, isLocalIP } from './utils'
import { fakeServer } from './fake-server'
import { EventEmitter } from 'events'

const logger = createLogger('demo')
const root = path.resolve('.')
export class Purple extends EventEmitter {

  // 代理服务器
  private server: http.Server
  // 监控服务器
  private monitor: WebSocket.Server
  // 监控端
  private client: WebSocket

  constructor(private port: number = 9000) {
    super()
  }

  send(uuid: string, data: any, response: any) {
    if (this.client && this.client.OPEN === WebSocket.OPEN) {
      data.response = response
      data.uuid = uuid
      this.client.send(JSON.stringify(data))
    }
  }

  start() {
    this.server = http.createServer()

    this.monitor = new WebSocket.Server({ server: this.server })

    this.monitor.on('connection', (client: WebSocket, request: http.IncomingMessage) => {
      this.client = client
    })

    this.monitor.on('error', err => {
      logger.error('monitor error: %j', err)
    })

    this.server.listen(this.port, () => logger.verbose(`proxy server start at ${this.port}`))
    // 错误
    this.server.on('error', (err: Error) => {
      logger.error(`proxy error: ${err}`)
    })

    // http 请求代理
    this.server.on('request', (request: http.IncomingMessage, response: http.ServerResponse) => {
      let [host, port] = request.headers.host.split(':')
      if (+port === this.port && isLocalIP(host)) {
        logger.info('local request %s', path.join(root, 'src/index.html'))
        const rs = fs.createReadStream(path.join(root, 'src/index.html'))
        rs.pipe(response)
        response.writeHead(200, { 'Content-Type': 'text/html' })
        rs.on('close', () => response.end())
      } else {
        localRequest(request, response, this)
      }
    })

    // https 代理，https 代理前会前发送 connect 请求
    this.server.on('connect', (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
      const [host, port] = request.url.split(':')
      logger.verbose('connect: %s ', request.url)
      // HackTLS 启用中间人代理
      if (HackTLS) {
        fakeServer(host, this, ({ port }) => forward(socket, port, head))
      } else {
        forward(socket, +port, head, host)
      }
    })

    // this.server.on('upgrade', (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    //   console.log(request.url, 'upgrade...................')
    //   this.monitor.handleUpgrade(request, socket, head, client => this.monitor.emit('connection', client, request))
    // })
  }
}

const purple = new Purple

purple.start()