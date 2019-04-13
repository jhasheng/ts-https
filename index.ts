import * as http from 'http'
import * as https from 'https'
import * as fs from 'fs'
import { SecureContext, createSecureContext, SecureContextOptions, TLSSocket } from 'tls'
import { CertificateCreationResult, createCertificate } from 'pem'

class HttpServer {
  private server: http.Server
  constructor() {
    this.server = http.createServer()
    this.server.on('listening', () => {
      console.log(this.server.address(), 'server start')
    })
  }

  listen(port: number) {
    this.server.listen(port, '0.0.0.0')
  }
}

interface CertInterface {
  getCertForHost(servername: string): Promise<SecureContextOptions>
}

class Certificate implements CertInterface {
  async getCertForHost(servername: string): Promise<SecureContextOptions> {
    const cert = await this.generate(servername)
    return { key: cert.clientKey, cert: cert.certificate }
  }

  private async generate(domain): Promise<CertificateCreationResult> {
    const root = await this.getRoot()
    return new Promise((resolve, reject) => {
      createCertificate({
        altNames: [domain],
        commonName: domain,
        days: 365,
        serviceCertificate: root.certificate,
        serviceKey: root.serviceKey
      }, (error, keys: CertificateCreationResult) => {
        if (error) {
          reject(error)
        } else {
          resolve(keys)
        }
      })
    })
  }

  private async getRoot(): Promise<CertificateCreationResult> {
    return new Promise((resolve, reject) => {
      createCertificate((error, keys: CertificateCreationResult) => {
        console.log(keys)
        if (error) {
          reject(error)
        } else {
          fs.writeFileSync('./root.key', keys.serviceKey)
          fs.writeFileSync('./root.cert', keys.certificate)
          resolve(keys)
        }
      })
    })
  }
}

class HttpsServer {

  private server: https.Server

  constructor(private cert: CertInterface) {}

  static async create(cert: CertInterface) {
    const server = new HttpsServer(cert)
    await server.init()
    return server
  }

  async listen(port: number) {
    this.server.listen(port, '0.0.0.0', () => {
      console.log(this.server.address(), 'https start')
    })
  }

  private async init() {
    const cert = await this.cert.getCertForHost('internal_https_server')
    this.server = https.createServer({
      SNICallback: async (servername: string, cb: (err: Error, context: SecureContext) => void) => {
        const crt = await this.cert.getCertForHost(servername)
        cb(null, createSecureContext(crt))
      },
      ...cert
    })

    this.server.on('newSession', (err: Error, socket: TLSSocket) => {
      console.error('new session: ', err)
    })

    this.server.on('tlsClientError', (err: Error, socket: TLSSocket) => {
      console.error('tls client error: ', err)
    })
  }
}



class ProxyServer {

  private http: HttpServer

  private https: HttpsServer

  static async create(): Promise<ProxyServer> {
    const server = new ProxyServer
    await server.init()
    return server
  }

  async init() {
    // this.http = new HttpServer
    const cert = new Certificate
    this.https = await HttpsServer.create(cert)
  }

  async listen(port: number) {
    // this.http.listen(port)
    this.https.listen(port + 1)
  }

}

async function bootstrap() {
  const proxy = await ProxyServer.create()
  await proxy.init()
  await proxy.listen(8999)
}

bootstrap()