import * as http from 'http'
import * as https from 'https'
import * as fs from 'fs'
import { SecureContext, createSecureContext, SecureContextOptions, TLSSocket } from 'tls'
import { CertificateCreationResult, createCertificate } from 'pem'
import { callbackify } from 'util';

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

type CertificatePair = { key: string, crt: string }

class Certificate implements CertInterface {
  async getCertForHost(servername: string): Promise<SecureContextOptions> {
    const cert = await this.generate(servername)
    if (fs.existsSync(`${servername}.crt`)) {
      Promise.reject('cert not exist')
    } else {
      await this.store(`${servername}.crt`, cert.crt)
    }
    if (fs.existsSync(`${servername}.key`)) {
      Promise.reject('cert not exist')
    } else {
      await this.store(`${servername}.key`, cert.key)
    }
    return cert
  }

  private async store(domain: string, content: string) {
    return new Promise((resolve, reject) => {
      fs.writeFile(`./${domain}`, content, err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  private async generate(domain): Promise<CertificatePair> {
    const ca = await this.getRootCA()
    return new Promise((resolve, reject) => {
      createCertificate({
        altNames: [domain],
        commonName: domain,
        days: 365,
        serviceCertificate: ca.crt,
        serviceKey: ca.key
      }, (error, keys: CertificateCreationResult) => {
        if (error) {
          reject(error)
        } else {
          resolve({ key: keys.serviceKey, crt: keys.certificate })
        }
      })
    })
  }

  private async getRootCA(): Promise<CertificatePair> {
    return new Promise((resolve, reject) => {
      if (fs.existsSync('./root.key') && fs.existsSync('./root.crt')) {
        resolve({
          key: fs.readFileSync('./root.key', { encoding: 'utf8' }).toString(),
          crt: fs.readFileSync('./root.crt', { encoding: 'utf8' }).toString()
        })
      } else {
        reject('root ca not exists')
      }
      // createCertificate({
      //   commonName: 'Jhasheng CA', emailAddress: 'jhasheng@hotmail.com', organization: 'Jhasheng Purple', organizationUnit: 'Jhasheng Purple CA'
      // }, (error, keys: CertificateCreationResult) => {
      //   if (error) {
      //     reject(error)
      //   } else {
      //     fs.writeFileSync('./root.key', keys.serviceKey)
      //     fs.writeFileSync('./root.crt', keys.certificate)
      //     resolve(keys)
      //   }
      // })
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
  try {
    const proxy = await ProxyServer.create()
    await proxy.init()
    await proxy.listen(8999)
  } catch (e) {
    console.error(e, 'error')
  }
}

bootstrap()