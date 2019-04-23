import * as http from 'http'

export function headerInterceptor(headers: http.IncomingHttpHeaders) {
  headers['user-agent'] = 'IE8'
}

export function body() {

}