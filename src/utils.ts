import * as http from 'http'
import * as os from 'os'
import * as net from 'net'
import * as fs from 'fs'
import * as WebSocket from 'ws'
import * as path from 'path'
import { createLogger } from './logger'
import { CertificateCreationResult, createCertificate } from 'pem'
import { lruCache, CA, Email, Expired, Middleware, documentRoot } from './constans'
import { createSecureContext, SecureContext } from 'tls'

const logger = createLogger('utils')

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

export function isLocalIP(ip: string): boolean {
  const interfaces = os.networkInterfaces()
  let pass: boolean = false
  for (let name in interfaces) {
    for (let inter of interfaces[name]) {
      if (inter.address === ip) {
        pass = true
        break;
      }
    }
  }
  if (!pass) {
    return ip === 'localhost'
  }
  return pass;
}

export function readResource(filename: string): fs.ReadStream {
  return fs.createReadStream(path.join(documentRoot, filename))
}