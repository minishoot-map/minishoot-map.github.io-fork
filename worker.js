import * as Load from '/load.js'
import markersData from './data-processed/markers.json'
import markersMeta from './data-processed/markers-meta.json'
import { meta, getAsSchema, parsedSchema } from './schema.js'

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
    const ti = parsedSchema.typeSchemaI
    const ss = parsedSchema.schema

    const polygonObjects = []
    const markerObjects = []

    for(let i = 0; i < objects.length; i++) {
        const obj = objects[i]
        const cs = obj.components

        let composite, tilemap
        let enemy, jar, crDes, transit, scarab
        for(let j = 0; j < cs.length; j++) {
            if(enemy == null) enemy = getAsSchema(cs[j], ti.Enemy)
            if(jar == null) jar = getAsSchema(cs[j], ti.Jar)
            if(crDes == null) crDes = getAsSchema(cs[j], ti.CrystalDestroyable)
            if(transit == null) transit = getAsSchema(cs[j], ti.Transition)
            if(scarab == null) scarab = getAsSchema(cs[j], ti.ScarabPickup)
            if(composite == null) composite = getAsSchema(cs[j], ti.CompositeCollider2D)
            if(tilemap == null) tilemap = getAsSchema(cs[j], ti.TilemapCollider2D)
        }

        if(enemy != null) markerObjects.push([obj, enemy.spriteI])
        else if(jar != null) markerObjects.push(createOneTex(obj, jar))
        else if(crDes != null) {
            const ti = meta.crystalDestroyableTextures[crDes.dropXp ? 1 : 0]
            markerObjects.push([obj, ti])
        }
        else if(scarab != null) markerObjects.push(createOneTex(obj, scarab))
        else if(composite != null && tilemap != null) {
            polygonObjects.push([obj, composite])
        }
    }

    return { polygonObjects, markerObjects }
})

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
        const [obj, texI] = markerObjects[i]
        const pos = obj.pos

        dv.setFloat32(i * 12     , pos[0], true)
        dv.setFloat32(i * 12 + 4 , pos[1], true)
        dv.setUint16 (i * 12 + 8 , texI, true)
        dv.setFloat16(i * 12 + 10, 1.0, true)
    }

    postMessage({
        type: 'markers-done',
        markers: markersB,
        markersData: markerDataB,
        count: markerObjects.length
    }, [markersB, markerDataB])
})

var polygons
Promise.all([objectsProcessedP, polygonsP]).then(([pObjects, polygonsA]) => {
    if(true) return
    polygons = Load.parse(parsedSchema, polygonsA)

    const { polygonObjects } = pObjects

    var totalPointsC = 0, totalIndicesC = 0
    const polyDrawDataByLayer = Array(32)
    for(var i = 0; i < polygonObjects.length; i++) {
        const [obj, composite] = polygonObjects[i]

        const polygon = polygons[composite.polygons]
        if(polygon.indices.length == 0) continue

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
