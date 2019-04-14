import * as http from 'http'
import * as https from 'https'
import * as net from 'net'
import * as fs from 'fs'
import * as path from 'path'
import { createCertificate, CertificateCreationResult } from 'pem'
import { SecureContext, createSecureContext, TLSSocket } from 'tls'

type CertificatePair = { key: string, cert: string }

let tunnel = new http.Server
let port = 9000

tunnel.listen(port, () => {
  console.log(`简易HTTPS中间人代理启动成功，端口：${port}`)
})

tunnel.on('error', (err: Error) => {
  console.error(`error: ${err}`)
})

tunnel.on('connect', (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  const [host, port] = request.headers.host.split(':')
  
  fakeServer(host, ({ port }) => {
    const tmp = net.connect(port, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: MITM-proxy\r\n\r\n')
      tmp.write(head)
      tmp.pipe(socket)
      socket.pipe(tmp)
    })

    tmp.on('error', err => {
      console.log('connect error:', err)
    })
  })
})

const ca = {
  key: fs.readFileSync(path.resolve('./root.key')).toString(),
  cert: fs.readFileSync(path.resolve('./root.crt')).toString()
}

async function fakeServer(host: string, forward: Function) {
  try {
    const { serviceKey, certificate } = await fakeCertificate(ca, host)
    console.log(serviceKey, certificate, '...................')
    const fake = new https.Server({
      key: serviceKey, cert: certificate,
      SNICallback: async(hostname: string, done: (error: Error, context: SecureContext) => void) => {
        console.log(`sni callback ${hostname}`)
        const { serviceKey, certificate } = await fakeCertificate(ca, hostname)

        done(null, createSecureContext({ key: serviceKey, cert: certificate }))
      }
    })
  
    fake.listen(0, () => {
      const address = fake.address()
      console.log('fake listen: ', address)
      forward(address)
    })
  
    fake.on('request', (request: http.IncomingMessage, reqponse: http.ServerResponse) => {
      console.log(`request info ................`)
    })
  
    fake.on('tlsClientError', (err: Error, socket: TLSSocket) => {
      console.error('tls client error: ', err)
    })
  
    fake.on('error', err => {
      console.error('fake server error: ', err)
    })

  } catch (e) {
    console.error('fake error: ', e)
  }
  
}

async function fakeCertificate(root: CertificatePair, domain: string): Promise<CertificateCreationResult> {
  return new Promise((resolve, reject) => {
    console.log(`ready to generate certificate pairs:`, domain)
    createCertificate({
      altNames: [domain],
      commonName: domain,
      days: 365,
      serviceCertificate: root.cert,
      serviceKey: root.key
    }, (error: Error, result: CertificateCreationResult) => {
      if (error) {
        reject(error)
      } else {
        resolve(result)
      }
    })
  })
}