// import * as request from 'request'

// const http = request.defaults({
//   baseUrl: 'https://baidu.com',
//   proxy: 'http://127.0.0.1:9000'
// })

// http.get('/', (error, response, body) => {
//   if (error) {
//     console.error(error, response)
//   } else {
//     console.log(response.statusCode)
//   }
// });
import * as path from 'path'
import * as https from 'https'
import * as pem from 'pem'
import * as fs from 'fs'
import { TLSSocket } from 'tls'
import { IncomingMessage, ServerResponse } from 'http'

const ca = {
  key: fs.readFileSync(path.resolve('./root.key')).toString(),
  cert: fs.readFileSync(path.resolve('./root.crt'))
}

pem.createCertificate({
  days: 30,
  selfSigned: true,
  altNames: ['localhost'],
  commonName: 'localhost',
  emailAddress: 'jhasheng@hotmail.com',
  serviceKey: ca.key,
  serviceCertificate: ca.cert
}, (err: Error, keys: pem.CertificateCreationResult) => {
  if (err) throw err
  const server = new https.Server({ cert: keys.certificate, key: keys.clientKey })

  server.on('listening', () => {
    console.log('server start: ', server.address())
  })

  server.on('request', (request: IncomingMessage, response: ServerResponse) => {
    const { url } = request
    if ('/' === url) {
      response.write('hello world')
    } else {
      response.write(fs.readFileSync(path.resolve('./favicon.ico')))
    }
    response.end()
  })

  server.on('error', err => {
    console.error('server error: ', err)
  })

  server.on('tlsClientError', (err: Error, socket: TLSSocket) => {
    console.error('tls client error: ', err)
  })

  server.on('close', () => {
    console.error('server closed')
  })

  server.listen(443, '127.0.0.1')
})