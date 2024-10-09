import * as fs from 'node:fs'
import { join } from 'node:path';

import { parseSchema, parse } from '../load.js'

const root = join(import.meta.dirname, '..')

const meta = JSON.parse(fs.readFileSync(join(root, 'processed', 'meta.json'), 'utf8'))
const collidersData = fs.readFileSync(join(root, 'processed', 'polygons.bp'))

const parsedSchema = parseSchema(meta.schemas)
const allPolygons = parse(parsedSchema, collidersData)
console.log(allPolygons)
