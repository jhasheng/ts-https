import * as request from 'request'

const http = request.defaults({
  baseUrl: 'https://baidu.com',
  proxy: 'http://127.0.0.1:9000'
})

http.get('/', (error, response, body) => {
  if (error) {
    console.error(error)
  } else {
    console.log(response.statusCode)
  }
});