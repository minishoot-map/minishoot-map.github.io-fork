// See for generating the atlas: https://free-tex-packer.com/app/

import { join } from 'node:path';
import * as fs from 'node:fs'

const root = join(import.meta.dirname, '..')

var data = fs.readFileSync(join(root, './data-raw/markers/markers.json'))
data = JSON.parse(data).frames

var res = {}
for(const name in data) {
    const m = data[name]
    res[name] = [m.frame.x, m.frame.y, m.frame.w, m.frame.h]
    if(m.pivot.x != 0.5 || m.pivot.y != 0.5) throw 'Not implemented'
    if(m.trimmed) throw 'Trim not supported'
}

const proc = join(root, 'data-processed')
fs.mkdirSync(proc, { recursive: true })
fs.writeFileSync(join(proc, '/markers.json'), JSON.stringify(res), 'utf-8')
console.log('Done!')
