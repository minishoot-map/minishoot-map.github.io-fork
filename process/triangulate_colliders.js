import cdt2d from 'cdt2d' // great lib! Many thanks
import * as fs from 'node:fs/promises'
import { join } from 'node:path';

import { schemas } from '../raw/objects/schemas.js'
import { parseSchema, parse } from '../load.js'

const root = join(import.meta.dirname, '..')

const collidersData = await fs.readFile(join(root, 'raw', 'objects', 'polygons.bp'))
const parsedSchema = parseSchema(schemas)
const allPolygons = parse(parsedSchema, collidersData)

const points = []
const edges = []
function triangulate(i) {
    points.length = 0
    edges.length = 0

    const polygons = allPolygons[i]
    for(let j = 0; j < polygons.length; j++) {
        const polygon = polygons[j]
        if(polygon.length < 3) throw "What is this polygon length " + polygon.length

        var prevPointI = points.length + polygon.length-1 // last point
        for(let k = 0; k < polygon.length; k++) {
            const pointI = points.length
            points.push(polygon[k])
            edges.push([prevPointI, pointI])
            prevPointI = pointI
        }
    }

    return cdt2d(points, edges, { exterior: false })
}
//for(let i = 0; i < allPolygons.length; i++) {
//    triangulate(i)
//}

/* const res = triangulate(1)
const re = []
for(let i = 0; i < res.length; i++) {
    const r = res[i]
    re.push([points[r[0]], points[r[1]], points[r[2]]])
}
await fs.writeFile(join(root, 'tmp', 'result.json'), JSON.stringify(re)) */
