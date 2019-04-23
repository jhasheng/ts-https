import * as http from 'http'
import * as https from 'https'
import * as URL from 'url'
import * as net from 'net'
import { createLogger } from './logger'
import { CertificateCreationResult, createCertificate } from 'pem'
import { lruCache, CA, FakeHandler, EMAIL } from './constans'

const logger = createLogger('utils')

/**
 * 本地真实请求
 * @param  {http.IncomingMessage} request
 * @param  {http.ServerResponse} response
 * @param  {boolean} secure
 */
export function localRequest(request: http.IncomingMessage, response: http.ServerResponse, secure: boolean = false) {
  logger.silly('local %s request: %j', secure ? 'https' : 'http', request.headers)
  const { url, headers, method } = request
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

  const remote = handler({ host: domain, headers, method, port, path }, incoming => {
    const { statusCode, headers } = incoming
    response.writeHead(statusCode, headers)
    incoming.pipe(response)
  })
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
 * @returns Promise
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
 * @returns Promise
 */
export async function fakeCertificate(domain: string): Promise<CertificateCreationResult> {
  if (lruCache.has(domain)) {
    logger.verbose('fake certificate cache hit: %s', domain)
    return lruCache.get(domain)
  }
  logger.verbose('fake certificate cache miss: %s, need generate', domain)
  return new Promise((resolve, reject) => {
    createCertificate({
      days: 30,
      selfSigned: true,
      altNames: [domain],
      commonName: domain,
      emailAddress: EMAIL,
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