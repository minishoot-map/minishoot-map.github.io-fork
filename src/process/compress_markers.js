// See for generating the atlas: https://free-tex-packer.com/app/

import { join } from 'node:path'
import * as fs from 'node:fs'
import { texturesCount } from '../data-raw/objects/schemas.js'

const root = join(import.meta.dirname, '..')

var data = fs.readFileSync(join(root, './data-raw/markers/markers.json'))
data = JSON.parse(data)

if(texturesCount !== Object.keys(data.frames).length) {
    throw new Error("Texture counts don't match", texturesCount, Object.keys(data.frames).length)
}

var res = Array(texturesCount)
for(const name in data.frames) {
    const i = parseInt(name.substring(0, name.length - 4))
    const m = data.frames[name]
    res[i] = [m.frame.x, m.frame.y, m.frame.w, m.frame.h]
    if(m.pivot.x != 0.5 || m.pivot.y != 0.5) throw 'Not implemented'
    if(m.trimmed) throw 'Trim not supported'
}
const meta = [texturesCount, data.meta.size.w, data.meta.size.h]

const proc = join(root, 'data-processed')
fs.mkdirSync(proc, { recursive: true })
fs.writeFileSync(join(proc, '/markers.json'), JSON.stringify(res), 'utf-8')
fs.writeFileSync(join(proc, '/markers-meta.json'), JSON.stringify(meta), 'utf-8')
console.log('Done!')
