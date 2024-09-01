import * as Load from '/load.js'
import markersData from './data-processed/markers.json'
import markersMeta from './data-processed/markers-meta.json'
import { meta, getAsSchema, parsedSchema } from './schema.js'

const ti = parsedSchema.typeSchemaI
const ss = parsedSchema.schema

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

function createOneTex(obj, comp) {
    return [obj, parsedSchema.schema[comp._schema].textureI]
}

const objectsProcessedP = objectsLoadedP.then(objects => {

    const polygonObjects = []
    const markerObjects = []

    const filterSchemas = [
        ti.Enemy,
        ti.Jar,
        ti.CrystalDestroyable,
        ti.Transition,
        ti.ScarabPickup,
        ti.Collider2D,
    ]
    const resultComponents = Array(filterSchemas.length)
    for(var i = 0; i < resultComponents.length; i++) resultComponents[i] = [null, null]

    const s = performance.now()
    for(var i = 0; i < objects.length; i++) {
        var obj = objects[i]
        var cs = obj.components

        for(var j = 0; j < filterSchemas.length; j++) {
            var fi = filterSchemas[j]
            var it = null
            for(var k = 0; k < cs.length && it != null; k++) {
                it = getAsSchema(cs[k], fi)
            }
            if(it != null) {
                resultComponents[j][0] = it
                resultComponents[j][1] = cs[k]
            }
            else {
                resultComponents[j][0] = resultComponents[j][1] = null
            }
        }

        var ci = 0
        var [enemy, enemyA]       = resultComponents[ci++]
        var [jar, jarA]           = resultComponents[ci++]
        var [crDes, crDesA]       = resultComponents[ci++]
        var [transit, transitA]   = resultComponents[ci++]
        var [scarab, scarabA]     = resultComponents[ci++]
        var [collider, colliderA] = resultComponents[ci++]

        if(enemy != null) {
            const size = enemyA._schema === ti.Boss ? 3 : 1 + 0.33 * enemy.size
            markerObjects.push([obj, enemy.spriteI, size])
        }
        else if(jar != null) markerObjects.push(createOneTex(obj, jar))
        else if(crDes != null) {
            const ti = meta.crystalDestroyableTextures[crDes.dropXp ? 1 : 0]
            markerObjects.push([obj, ti, 1 + 0.5 * crDes.size])
        }
        else if(scarab != null) markerObjects.push(createOneTex(obj, scarab))
        else if(collider != null) {
            colliderObjects.push([obj, colliderA])
        }
    }
    const e = performance.now()
    console.log(e - s)

    return { polygonObjects, markerObjects }
})

if(false)
objectsProcessedP.then(pObjects => {
    const { markerObjects } = pObjects
    const [markerDataC, texW, texH] = markersMeta

    // note: 4 bytes of padding for std140
    const markerDataB = new ArrayBuffer(markerDataC * 16)
    const mddv = new DataView(markerDataB)
    for(var i = 0; i < markerDataC; i++) {
        const td = markersData[i]

        var aspect = td[2] / td[3]
        if(aspect > 1) aspect = -td[3] / td[2]

        mddv.setUint16 (i * 16    , Math.floor(td[0] * 0x10000 / texW), true)
        mddv.setUint16 (i * 16 + 2, Math.floor(td[1] * 0x10000 / texH), true)
        mddv.setUint16 (i * 16 + 4, Math.floor(td[2] * 0x10000 / texW), true)
        mddv.setUint16 (i * 16 + 6, Math.floor(td[3] * 0x10000 / texH), true)
        mddv.setFloat32(i * 16 + 8, aspect, true)
    }

    const markersB = new ArrayBuffer(markerObjects.length * 12)
    const dv = new DataView(markersB)
    for(var i = 0; i < markerObjects.length; i++) {
        const [obj, texI, size0] = markerObjects[i]
        const size = size0 > 0 ? size0 : 1.0
        const pos = obj.pos

        dv.setFloat32(i * 12     , pos[0], true)
        dv.setFloat32(i * 12 + 4 , pos[1], true)
        dv.setUint16 (i * 12 + 8 , texI, true)
        dv.setFloat16(i * 12 + 10, size, true)
    }

    postMessage({
        type: 'markers-done',
        markers: markersB,
        markersData: markerDataB,
        count: markerObjects.length
    }, [markersB, markerDataB])
})

const boxPoints = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]

var polygons
Promise.all([objectsProcessedP, polygonsP]).then(([pObjects, polygonsA]) => {
    polygons = Load.parse(parsedSchema, polygonsA)

    const { polygonObjects } = pObjects

    var totalPointsC = 0, totalIndicesC = 0
    const polyDrawDataByLayer = Array(32)
    const circularDrawDataByLayer = Array(32)
    for(var i = 0; i < 32; i++) {
        polyDrawDataByLayer[i] = []
        circularDrawDataByLayer[i] = []
    }

    debugger
    for(var i = 0; i < polygonObjects.length; i++) {
        const pobj = polygonObjects[i]
        const layer = pobj[0].layer, s = pobj[1]._schema
        console.log(s)

        if(s === ti.CompositeCollider2D) {
            const polygon = polygons[composite.polygons]
            if(polygon.indices.length == 0) continue

            polyDrawDataByLayer[layer].push(pobj)

            totalPointsC += polygon.points.length
            totalIndicesC += polygon.indices.length
        }
        else if(s === ti.PolygonCollider2D) {
            const polygon = polygons[composite.points]
            if(polygon.indices.length == 0) continue

            polyDrawDataByLayer[layer].push(pobj)

            totalPointsC += polygon.points.length
            totalIndicesC += polygon.indices.length
        }
        else if(s === ti.BoxCollider2D) {
            polyDrawDataByLayer[layer].push(pobj)

            totalPointsC += 4
            totalPointsC += 4
        }
        else if(s === ti.CircleCollider2D) {
            circularDrawDataByLayer[layer].push(pobj)
        }
        else if(s === ti.CapsuleCollider2D) {
            circularDrawDataByLayer[layer].push(pobj)
        }
    }

            // const data = [obj.matrix, polygon]
    console.log(totalPointsC, totalIndicesC)

    const verts = new Float32Array(totalPointsC * 2)
    const indices = new Uint32Array(totalIndicesC)
    let vertI = 0, indexI = 0
    const polyDrawData = []
    for(let i = 0; i < polyDrawDataByLayer.length; i++) {
        const datas = polyDrawDataByLayer[i]
        if(datas.length == 0) continue
        const startIndexI = indexI

        for(let j = 0; j < datas.length; j++) {
            const startVertexI = vertI

            const data = datas[j]
            const m = data[0].matrix
            const coll = data[1]
            if(coll._schema === ti.CompositeCollider2D) {
                const poly = polygons[coll.polygons]
                const off = coll._base.offset
                console.log('composite w/', poly.points.length, poly.indices.length)
                for(let k = 0; k < poly.points.length; k++) {
                    const x = poly.points[k][0] + off[0]
                    const y = poly.points[k][1] + off[1]
                    verts[vertI*2    ] = x * m[0] + y * m[1] + m[2]
                    verts[vertI*2 + 1] = x * m[3] + y * m[4] + m[5]
                    vertI++
                }
                for(let k = 0; k < poly.indices.length; k++) {
                    indices[indexI++] = startVertexI + poly.indices[k]
                }
            }
            else if(coll._schema === ti.PolygonCollider2D) {
                const poly = polygons[coll.points]
                const off = coll._base.offset
                console.log('polygon w/', poly.points.length, poly.indices.length)
                for(let k = 0; k < poly.points.length; k++) {
                    const x = poly.points[k][0] + off[0]
                    const y = poly.points[k][1] + off[1]
                    verts[vertI*2    ] = x * m[0] + y * m[1] + m[2]
                    verts[vertI*2 + 1] = x * m[3] + y * m[4] + m[5]
                    vertI++
                }
                for(let k = 0; k < poly.indices.length; k++) {
                    indices[indexI++] = startVertexI + poly.indices[k]
                }
            }
            else if(coll._schema === ti.BoxCollider2D) {
                console.log('box')
                const size = coll.size
                const off = coll._base.offset
                for(let k = 0; k < 4; k++) {
                    const x = boxPoints[k] * size[0] + off[0]
                    const y = boxPoints[k] * size[1] + off[1]
                    verts[vertI*2    ] = x * m[0] + y * m[1] + m[2]
                    verts[vertI*2 + 1] = x * m[3] + y * m[4] + m[5]
                    indices[indexI++] = startVertexI + k
                }
            }
        }

        polyDrawData.push({ startIndexI, length: indexI - startIndexI, layer: i })
    }

    postMessage({ type: 'colliders-done', verts, indices, polyDrawData }, [verts.buffer, indices.buffer])
})
