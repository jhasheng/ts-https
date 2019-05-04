import * as http from 'http'
import * as https from 'https'
import * as net from 'net'
import * as URL from 'url'
import * as uuid from 'uuid/v4'
import { TLSSocket } from 'tls'
import { createLogger } from './logger'
import { lruFSC, FakeHandler, Monitor, RequestBase } from './constans'
import { fakeCertificate } from './utils'
import { EventEmitter } from 'events'

const logger = createLogger('fake-server')

export abstract class FakeServer extends EventEmitter {

  constructor() {
    super()
  }

  abstract send(data: Monitor): void

  /**
   * 本地真实请求
   * @param  {http.IncomingMessage} request
   * @param  {http.ServerResponse} response
   * @param  {boolean} secure
   */
  localRequest(request: http.IncomingMessage, response: http.ServerResponse, secure: boolean) {
    const { url, headers, method, httpVersion } = request
    const { host } = headers
    const { path } = URL.parse(url)
    logger.info('%s HTTP/%s %s://%s%s', method, httpVersion, secure ? 'https' : 'http', host, path)
    // 从 host 中分析出域名和端口
    let [domain, port] = host.split(':')
    if (!port) {
      port = secure ? '443' : '80'
    }
    // https 与 http 请求的模块不同
    const semulator: FakeHandler = secure ? https.request : http.request
    // const body = await requestBody(request)
    const options: http.RequestOptions | https.RequestOptions = { host: domain, headers, method, port, path }

    const remote = semulator(options, localResponse => {
      const { statusCode, headers, socket: { remoteAddress, remotePort } } = localResponse
      logger.info('remote address %s:%s', remoteAddress, remotePort)
      // const body = await requestBody(localResponse)
      // const base: RequestBase = {
      //   code: localResponse.statusCode,
      //   ssl: secure,
      //   ip: remoteAddress,
      //   port: remotePort,
      //   protocol: httpVersion
      // }
      // this.send({ uuid: uuid(), base, request, response })
      // logger.verbose('response body %s', body)
      response.writeHead(statusCode, headers)
      localResponse.pipe(response)
    })

    remote.on('error', err => logger.error('local request error: %j', err))
    request.pipe(remote)
  }

  /**
   * https mitm 创建一个临时的 https 连接，使用自己签发的证书
   * @param  {string} host
   */
  async createFakeServer(host: string): Promise<net.AddressInfo> {
    return new Promise(async (resolve, reject) => {
      if (lruFSC.has(host)) {
        logger.verbose('fs cache hit')
        resolve(lruFSC.get(host).address() as net.AddressInfo)
      } else {
        logger.verbose('fs cache missing')
      }
      const { clientKey, certificate } = await fakeCertificate(host)
      const fake = https.createServer({ key: clientKey, cert: certificate })

      lruFSC.set(host, fake)
      fake.listen(0, '127.0.0.1')

      fake.on('request', (fakeRequest: http.IncomingMessage, fakeResponse: http.ServerResponse) => {
        this.localRequest(fakeRequest, fakeResponse, true)
      })
      fake.on('tlsClientError', (err: Error, socket: TLSSocket) => logger.error('tls client error: %j', err))
      fake.on('error', err => logger.error('fs error: %j', err))

      fake.on('close', () => {
        logger.error('fs closed ... ')
        lruFSC.del(host)
      })

      fake.on('listening', () => {
        logger.verbose('fs start: %j', fake.address())
        resolve(fake.address() as net.AddressInfo)
      })
    })
  }
}
