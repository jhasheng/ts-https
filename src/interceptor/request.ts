import * as http from 'http'

export function headers(headers: http.IncomingHttpHeaders) {
  headers['user-agent'] = 'IE8'
}

export function body(body: string): string {
  return body
}