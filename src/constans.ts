import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import * as LRU from 'lru-cache'
import { CertificateCreationResult } from 'pem'

export const CA: CertificatePair = {
  key: fs.readFileSync(path.resolve(__dirname + '/cert/root.key')).toString(),
  cert: fs.readFileSync(path.resolve(__dirname + '/cert/root.crt')).toString()
}

export const lruCache = new LRU<string, CertificateCreationResult>({ max: 100, maxAge: 60 * 60 * 1000 })
export const lruFSC = new LRU<string, https.Server>({ max: 100, maxAge: 2 * 60 * 1000 })

export const HackTLS = true
export const Email = 'jhasheng@hotmail.com'
export const Expired = 30

export type CertificatePair = { key: string, cert: string }
export type FakeHandler = (options: http.RequestOptions, callback?: (res: http.IncomingMessage) => void) => http.ClientRequest
export type Middleware = (request: http.IncomingMessage, response: http.ServerResponse, next: () => void) => void
export type RequestBase = { code: number, ssl: boolean, ip: string, port: number, protocol: string }
export type Monitor = { uuid: string, base: RequestBase, request: http.IncomingMessage, response: http.ServerResponse }

export const documentRoot = path.resolve('.')