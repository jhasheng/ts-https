import * as http from 'http'

export function headers(header: http.ServerResponse) {
  header.setHeader('X-Vary-Server', 'mitm server')
}

export function body() {

}