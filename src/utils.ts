import * as http from 'http'
import * as https from 'https'
import * as URL from 'url'
import * as net from 'net'
import { createLogger } from './logger'
import { CertificateCreationResult, createCertificate } from 'pem'
import { lruCache, CA, FakeHandler, Email, Expired, Middleware } from './constans'
import { createSecureContext, SecureContext } from 'tls';
import { headers as requsetHeaderInterceptor } from './interceptor/request'
import { Purple } from '.'
import * as uuid from 'uuid/v4'

const logger = createLogger('utils')

/**
 * 本地真实请求
 * @param  {http.IncomingMessage} request
 * @param  {http.ServerResponse} response
 * @param  {boolean} secure
 */
export async function localRequest(request: http.IncomingMessage, response: http.ServerResponse, server: Purple): Promise<void>
export async function localRequest(request: http.IncomingMessage, response: http.ServerResponse, server: Purple, secure: boolean): Promise<void>
export async function localRequest(request: http.IncomingMessage, response: http.ServerResponse, server: Purple, secure?: boolean): Promise<void> {
  logger.silly('local %s request: %j', secure ? 'https' : 'http', request.headers)
  // server.emit('request', request, response)
  const { url, headers, method, httpVersion } = request
  requsetHeaderInterceptor(headers)
  const { host } = headers
  const { path } = URL.parse(url)
  // 从 host 中分析出域名和端口
  let [domain, port] = host.split(':')
  if (secure) {
    port = '443'
  } else if (!port) {
    port = '80'
  }
  // https 与 http 请求的模块不同
  const handler: FakeHandler = (+port === 443) ? https.request : http.request

  // const body = await requestBody(request)
  const options = { host: domain, headers, method: method.trim(), port, path }
  logger.verbose('request options %j', options)

  const remote = handler(options, incoming => {
    const { statusCode, headers, socket: { remoteAddress, remotePort } } = incoming
    logger.info('remote info %j', incoming.socket.remoteAddress)
    // const body = await requestBody(incoming)
    server.send(uuid(), options, { headers, code: incoming.statusCode, ssl: secure, ip: remoteAddress, port: remotePort, protocol: httpVersion })
    // logger.verbose('response body %s', body)
    // responseHeaderInterceptor(response)
    response.writeHead(statusCode, headers)
    incoming.pipe(response)
  })

  remote.on('error', err => logger.error('local request error: %j', err))

  request.pipe(remote)
}

/**
 * @param  {net.Socket} socket
 * @param  {number} port
 * @param  {string} host?
 * @returns void
 */
export function forward(socket: net.Socket, port: number, head: Buffer): void
export function forward(socket: net.Socket, port: number, head: Buffer, host: string): void
export function forward(socket: net.Socket, port: number, head: Buffer, host?: string): void {
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

/**
 * 获取 request 请求内容
 * @param  {http.IncomingMessage} request
 * @returns Promise<string>
 */
export async function requestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data: string = ''
    request.on('data', chunk => data += chunk)
    request.on('end', () => resolve(data))
  })
}

/**
 * 自签证书，有缓存则从缓存中获取
 * @param  {string} domain
 * @returns Promise<CertificateCreationResult>
 */
export async function fakeCertificate(domain: string): Promise<CertificateCreationResult> {
  if (lruCache.has(domain)) {
    logger.verbose('fake certificate cache hit: %s', domain)
    return lruCache.get(domain)
  } else {
    logger.verbose('fake certificate cache miss: %s', domain)
  }
  return new Promise((resolve, reject) => {
    createCertificate({
      days: Expired,
      selfSigned: true,
      altNames: [domain],
      commonName: domain,
      emailAddress: Email,
      serviceKey: CA.key,
      serviceCertificate: CA.cert,
    }, (error: Error, result: CertificateCreationResult) => {
      if (error) {
        reject(error)
      } else {
        lruCache.set(domain, result)
        resolve(result)
      }
    })
  })
}

export async function SNICallback(hostname: string, done: (error: Error, context: SecureContext) => void) {
  try {
    const { clientKey, certificate } = await fakeCertificate(hostname)
    const context = createSecureContext({ key: clientKey, cert: certificate })
    logger.verbose('SNICallback success: %s', hostname)
    done(null, context)
  } catch (e) {
    logger.error('SNICallback error: %j', e)
    done(new Error(e), null)
  }
}

export function pipeline() {
  let handlers: Middleware[] = []
  const app = (request: http.IncomingMessage, response: http.ServerResponse) => {
    let i = 0
    const next = () => {
      const handler = handlers[i++]
      handler(request, response, next)
    }
    next()
  }

  app.use = (task: Middleware) => handlers.push(task)
  return app
}