import * as http from 'http'
import * as https from 'https'
import * as net from 'net'
import * as fs from 'fs'
import * as path from 'path'
import * as URL from 'url'
import * as LRU from 'lru-cache'
import { createCertificate, CertificateCreationResult } from 'pem'
import { SecureContext, createSecureContext, TLSSocket } from 'tls'

const ca = {
  key: fs.readFileSync(path.resolve('./root.key')).toString(),
  cert: fs.readFileSync(path.resolve('./root.crt')).toString()
}

const lruCache = new LRU<string, CertificateCreationResult>({
  max: 100, maxAge: 60 * 60 * 1000
})
const lruFS = new LRU<string, https.Server>({
  max: 100, maxAge: 2 * 60 * 1000
})

type CertificatePair = { key: string, cert: string }

let tunnel = new http.Server
let port = 9000

tunnel.listen(port, () => console.log(`简易HTTPS中间人代理启动成功，端口：${port}`))

tunnel.on('error', (err: Error) => console.error(`tunnel error: ${err}`))

tunnel.on('connect', (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  const [host] = request.url.split(':')
  console.log('new tunnel ................', request.url)

  fakeServer(host, ({ port }) => {
    console.log('create fake server success ................')
    const tmp = net.connect(port, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: MITM-proxy\r\n\r\n')
      tmp.pipe(socket)
      socket.pipe(tmp)
    })

    tmp.on('error', err => console.log('tmp error:', err))
    socket.on('error', err => console.log('socket error:', err))
  })
})

async function fakeServer(host: string, forward: (address: any) => void) {
  if (lruFS.has(host)) {
    console.log('hit cache fake server ...................')
    forward(lruFS.get(host).address())
    // return lruFS.get(host)
    return
  }
  console.log('ready to create fake server ...................')
  const { clientKey, certificate } = await fakeCertificate(ca, host)
  const fake = https.createServer({
    key: clientKey, cert: certificate,
    // SNICallback: async (hostname: string, done: (error: Error, context: SecureContext) => void) => {
    //   try {
    //     const { clientKey, certificate } = await fakeCertificate(ca, hostname)
    //     const context = createSecureContext({ key: clientKey, cert: certificate })
    //     console.log('SNICallback success: ', hostname)
    //     done(null, context)
    //   } catch (e) {
    //     console.error('SNICallback error: ', e)
    //     done(new Error(e), null)
    //   }
    // }
  })

  let address: net.AddressInfo | string

  fake.listen(0, '127.0.0.1', () => address = fake.address())

  fake.on('listening', () => {
    console.log('fake listen success: ', address)
    forward(address)
  })

  fake.on('request', async (fakeRequest: http.IncomingMessage, fakeResponse: http.ServerResponse) => {
    // const body = await requestBody(fakeRequest)
    const { url, headers, method } = fakeRequest
    const { host } = headers
    const { path } = URL.parse(url)

    console.log('fake request body', host)

    const remote = https.request({
      method, port: 443, hostname: host, headers, path
    }, remoteRequest => {
      fakeResponse.writeHead(remoteRequest.statusCode, remoteRequest.headers)
      remoteRequest.pipe(fakeResponse)
    })

    fakeRequest.pipe(remote)
  })

  fake.on('tlsClientError', (err: Error, socket: TLSSocket) => {
    console.error('tls client error: ', err)
  })

  fake.on('error', err => {
    console.error('fake server error: ', err)
  })

  fake.on('close', () => {
    console.error('fake server closed ... ')
    lruFS.del(host)
  })

  lruFS.set(host, fake)
}

async function requestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data: string = ''
    request.on('data', chunk => data += chunk)
    request.on('end', () => {
      resolve(data)
    })
  })
}

async function fakeCertificate(ca: CertificatePair, domain: string): Promise<CertificateCreationResult> {
  if (lruCache.has(domain)) {
    console.log('fake certificate cache hit: ', domain)
    return lruCache.get(domain)
  }
  return new Promise((resolve, reject) => {
    console.log(`ready to generate certificate pairs: `, domain)
    createCertificate({
      days: 30,
      selfSigned: true,
      altNames: [domain],
      commonName: domain,
      emailAddress: 'jhasheng@hotmail.com',
      serviceKey: ca.key,
      serviceCertificate: ca.cert,
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