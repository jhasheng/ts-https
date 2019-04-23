import * as http from 'http'
import * as https from 'https'
import * as net from 'net'
import { TLSSocket } from 'tls'
import { createLogger } from './logger'
import { lruFS } from './constans'
import { localRequest, fakeCertificate } from './utils'

const logger = createLogger('fake-server')

/**
 * https mitm 创建一个临时的 https 连接，使用自己签发的证书
 * @param  {string} host
 * @param  {Function} callback
 */
export async function fakeServer(host: string, callback: (address: any) => void) {
  if (lruFS.has(host)) {
    logger.verbose('cache fake server hit')
    callback(lruFS.get(host).address())
    return
  } else {
    logger.verbose('cache fake server miss')
  }
  const { clientKey, certificate } = await fakeCertificate(host)
  const fake = https.createServer({
    key: clientKey, cert: certificate,
    // SNICallback: async (hostname: string, done: (error: Error, context: SecureContext) => void) => {
    //   try {
    //     const { clientKey, certificate } = await fakeCertificate(ca, hostname)
    //     const context = createSecureContext({ key: clientKey, cert: certificate })
    //     logger.verbose('SNICallback success: ', hostname)
    //     done(null, context)
    //   } catch (e) {
    //     console.error('SNICallback error: ', e)
    //     done(new Error(e), null)
    //   }
    // }
  })

  lruFS.set(host, fake)

  let address: net.AddressInfo | string

  fake.listen(0, '127.0.0.1', () => address = fake.address())

  fake.on('listening', () => {
    logger.verbose('fake listen success: %j', address)
    callback(address)
  })

  fake.on('request', (fakeRequest: http.IncomingMessage, fakeResponse: http.ServerResponse) => localRequest(fakeRequest, fakeResponse, true))

  fake.on('tlsClientError', (err: Error, socket: TLSSocket) => logger.error('tls client error: %j', err))

  fake.on('error', err => logger.error('fake server error: %j', err))

  fake.on('close', () => {
    logger.error('fake server closed ... ')
    lruFS.del(host)
  })
}
