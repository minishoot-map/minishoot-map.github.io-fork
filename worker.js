import * as Load from '/load.js'
import { getAsSchema, parsedSchema } from './schema.js'

// NOTE: DO NOT send 30mb of objects w/ postMessage() :)

async function load(path) {
    const res = await fetch(path)
    const ab = await res.arrayBuffer()
    return new Uint8Array(ab)
}

const objectsP = load('./data/objects.bp')
const polygonsP = load('./data/polygons.bp')

var deg2rad = (Math.PI / 180)
// Note: rotation is counter-clockwise in both Unity and css (right?)
function construct(t) {
    var sin = Math.sin(t.rotation * deg2rad)
    var cos = Math.cos(t.rotation * deg2rad)
    var matrix = new Float32Array(6)
    matrix[0] = cos * t.scale[0]
    matrix[1] = -sin * t.scale[1]
    matrix[2] = t.position[0]
    matrix[3] = sin * t.scale[0]
    matrix[4] = cos * t.scale[1]
    matrix[5] = t.position[1]
    return matrix
}

var scenes
var objects = []
function prepareObjects(parentMatrix, parentI, obj) {
    var transform
    for(let i = 0; i < obj.components.length && transform == null; i++) {
        transform = getAsSchema(obj.components[i], parsedSchema.typeSchemaI.Transform)
    }
    if(transform == null) throw "Unreachable"
    obj.transform = transform
    obj.parentI = parentI

    const index = objects.length
    objects.push(obj)

    var matrix = construct(transform)
    if(parentMatrix) multiply(matrix, parentMatrix)
    obj.matrix = matrix
    obj.pos = [matrix[2], matrix[5]]

    obj.children.forEach(c => prepareObjects(matrix, index, c))
}

function multiply(n, m) {
    var a = m[0] * n[0] + m[1] * n[3]
    var b = m[0] * n[1] + m[1] * n[4]
    var c = m[0] * n[2] + m[1] * n[5] + m[2]
    var d = m[3] * n[0] + m[4] * n[3]
    var e = m[3] * n[1] + m[4] * n[4]
    var f = m[3] * n[2] + m[4] * n[5] + m[5]

    n[0] = a
    n[1] = b
    n[2] = c
    n[3] = d
    n[4] = e
    n[5] = f

    return n
}

const objectsLoadedP = objectsP.then(objectsA => {
    scenes = Load.parse(parsedSchema, objectsA)

    for(let i = 0; i < scenes.length; i++) {
        const roots = scenes[i].roots
        for(let j = 0; j < roots.length; j++) {
            prepareObjects(null, -1 - i, roots[j])
        }
    }

    return objects
})

var polygons
Promise.all([objectsLoadedP, polygonsP]).then(([objects, polygonsA]) => {
    polygons = Load.parse(parsedSchema, polygonsA)

    const taken = {}

    var totalPointsC = 0, totalIndicesC = 0
    const polyDrawDataByLayer = Array(32)
    for(let i = 0; i < objects.length; i++) {
        const obj = objects[i]
        const cs = obj.components
        let composite, tilemap
        for(let j = 0; j < cs.length && (composite == null || tilemap == null); j++) {
            if(composite == null) composite = getAsSchema(cs[j], parsedSchema.typeSchemaI['CompositeCollider2D'])
            if(tilemap == null) tilemap = getAsSchema(cs[j], parsedSchema.typeSchemaI['TilemapCollider2D'])
        }
        if(composite == null || tilemap == null) continue

        const polygon = polygons[composite.polygons]
        if(polygon.indices.length == 0) continue

        if(taken[composite.polygons] != null) {
            console.log('taken!', taken[polygon], obj)
            continue
        }
        taken[composite.polygons] = obj

        const data = [obj.matrix, polygon]

        var datas = polyDrawDataByLayer[obj.layer]
        if(datas == null) polyDrawDataByLayer[obj.layer] = [data]
        else datas.push(data)

        totalPointsC += polygon.points.length * 2
        totalIndicesC += polygon.indices.length
    }

    const verts = new Float32Array(totalPointsC)
    const indices = new Uint32Array(totalIndicesC)
    let vertI = 0, indexI = 0
    const polyDrawData = []
    for(let i = 0; i < polyDrawDataByLayer.length; i++) {
        const datas = polyDrawDataByLayer[i]
        if(datas == null) continue
        const startIndexI = indexI

        for(let j = 0; j < datas.length; j++) {
            const data = datas[j]
            const m = data[0]
            const poly = data[1]
            const startVertexI = vertI
            for(let k = 0; k < poly.points.length; k++) {
                const x = poly.points[k][0]
                const y = poly.points[k][1]
                verts[vertI*2    ] = x * m[0] + y * m[1] + m[2]
                verts[vertI*2 + 1] = x * m[3] + y * m[4] + m[5]
                vertI++
            }
            for(let k = 0; k < poly.indices.length; k++) {
                indices[indexI++] = startVertexI + poly.indices[k]
            }
        }

        polyDrawData.push({ startIndexI, length: indexI - startIndexI, layer: i })
    }

    postMessage({ type: 'colliders-done', verts, indices, polyDrawData }, [verts.buffer, indices.buffer])
})
