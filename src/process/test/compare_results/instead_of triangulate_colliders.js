// more line create_meta.js
import * as fs from 'node:fs'
import { join } from 'node:path'

import * as meta from '../data-raw/objects/schemas.js'

const root = join(import.meta.dirname, '..')
const proc = join(root, 'data-processed')
fs.mkdirSync(proc, { recursive: true })
fs.writeFileSync(join(proc, 'meta.json'), JSON.stringify(meta))

console.log('Done!')
