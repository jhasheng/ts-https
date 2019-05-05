import { Extension } from './extension'

export function detectExtension(buffer: Buffer) {
  let pos = 0, extensions = []
  while (pos < buffer.length) {
    let extension = {
      type: buffer.slice(pos, pos += 2).toString('hex'),
      length: buffer.slice(pos, pos += 2).toString('hex')
    }
    const index = parseInt(extension.type, 16)
    if (index >= 65282) {
      extension['name'] = Extension[65535]
    } else if (!Extension[index]) {
      extension['name'] = 'Unassigned'
    } else {
      extension['name'] = Extension[index]
    }
    extension['content'] = buffer.slice(pos, pos += parseInt(extension.length, 16)).toString('hex')
    extensions.push(extension)
  }
  return extensions
}