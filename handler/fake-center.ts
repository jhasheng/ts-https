import * as fs from 'fs'
import * as https from 'https'
import * as path from 'path'
import { SecureContext, createSecureContext, TLSSocket } from 'tls'
import { createCertificate, CertificateCreationResult } from 'pem'

type CertificatePair = { cert: Buffer, key: Buffer }

export class FakeCenter {

  private max: number = 100

  private queue: [] = []

  private root: CertificatePair = {
    key: fs.readFileSync(path.resolve('./root.key')),
    cert: fs.readFileSync(path.resolve('./root.crt'))
  }

  async generate(servername): Promise<CertificateCreationResult> {
    return new Promise((resolve, reject) => {
      createCertificate({
        altNames: [servername],
        commonName: servername,
        days: 365,
        serviceCertificate: this.root.cert,
        serviceKey: this.root.key.toString()
      }, (error, result: CertificateCreationResult) => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      })
    })
  }

  invoke() {
    const fake = https.createServer({
      ...this.root,
      SNICallback: async(servername: string, cb: (error: Error, context: SecureContext) => void) => {
        console.log('fake center: ', servername)
        const { serviceKey, certificate } = await this.generate(servername)
        cb(null, createSecureContext({ key: serviceKey, cert: certificate }))
      }
    })

    fake.on('tlsClientError', (error: Error, socket: TLSSocket) => {
      console.log('tls client error: ', error)
    })

    fake.on('error', (e) => {
      console.error(e);
    })

    fake.on('listen', () => {
      console.log('fake server listen: ', fake.address())
    })

    fake.listen(443)
  }
}