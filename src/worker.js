import * as Load from '/load.js'
import markersData from '$/markers.json'
import markersMeta from '$/markers-meta.json'
import { meta, getAsSchema, parsedSchema } from '/schema.js'

import objectUrl from '$/objects.bp'
import polygonsUrl from '$/polygons.bp'
import backgroundsUrl from '$/backgrounds.pak'

const ti = parsedSchema.typeSchemaI

// NOTE: DO NOT send 30mb of objects w/ postMessage() :)

onmessage = (e) => {
    const d = e.data
    console.log('received from client', d.type)
    if(d.type === 'click') {
        onClick(d.x, d.y)
    }
    else if(d.type === 'getInfo') {
        getInfo(d.index)
    }
}

function shouldLoad(is, load, message) {
    if(is) return load()

    console.warn(message)
    return new Promise(() => {})
}

async function load(path) {
    const res = await fetch(path)
    const ab = await res.arrayBuffer()
    return new Uint8Array(ab)
}


const backgroundsP = shouldLoad(
    __worker_backgrounds && __worker_objects,
    () => fetch(backgroundsUrl).then(r => r.body).then(r => r.getReader()),
    'skipping backgrounds'
)
const objectsP = shouldLoad(
    __worker_objects,
    () => load(objectUrl),
    'skipping objects'
)
const polygonsP = shouldLoad(
    __worker_colliders && __worker_objects,
    () => load(polygonsUrl),
    'skipping colliders'
)

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
    obj._parentI = parentI

    const index = objects.length
    objects.push(obj)
    obj._index = index

    var matrix = construct(transform)
    if(parentMatrix) premultiplyBy(matrix, parentMatrix)
    obj.matrix = matrix
    obj.pos = [matrix[2], matrix[5]]

    obj.children.forEach(c => prepareObjects(matrix, index, c))
}

function premultiplyBy(n, m) {
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

backgroundsP.then(async(reader) => {
    var tmp = new Uint8Array()

    function tryRead(length) {
        if(tmp.length < length) return
        const res = new Uint8Array(length)
        res.set(tmp.subarray(0, length))
        tmp = tmp.subarray(length)
        return res.buffer
    }
    async function read(length) {
        const chunks = []
        var totalLength = tmp.length
        var last = tmp
        while(totalLength < length) {
            const { done, value } = await reader.read()
            if(done) throw new Error('Trying to read ' + length + ' but reached EOF')

            chunks.push(last)
            last = value
            totalLength += value.length
        }

        const res = new Uint8Array(length)
        var off = 0
        for(let i = 0; i < chunks.length; i++) {
            res.set(chunks[i], off)
            off += chunks[i].length
        }

        res.set(last.subarray(0, length - off), off)
        tmp = last.subarray(length - off)

        return res.buffer
    }

    const headerLenB = await read(4)
    const headerLen = new DataView(headerLenB).getUint32(headerLenB, true)
    const header = new Uint8Array(await read(headerLen))

    var index = 0

    // duplicate from load.js
    function parseCompressedInt() {
        var res = 0
        var i = 0
        do {
            var cur = header[index++]
            res = res | ((cur & 0b0111_1111) << (i * 7))
            i++
        } while((cur & 0b1000_0000) == 0)
        return res
    }

    const len = parseCompressedInt()
    const imageDatas = []
    for(let i = 0; i < len; i++) {
        const size = parseCompressedInt()
        const ti = parseCompressedInt()
        imageDatas.push({ size, index: ti })
    }

    var backgrounds = []
    var buffers = []
    for(let i = 0; i < imageDatas.length; i++) {
        const id = imageDatas[i]
        var buffer = tryRead(id.size)
        if(buffer == null) {
            postMessage({ type: 'backgrounds-done', backgrounds }, buffers)
            backgrounds = []
            buffers = []
            buffer = await read(id.size)
        }

        backgrounds.push({ index: id.index, buffer: buffer })
        buffers.push(buffer)
    }

    if(backgrounds.length != 0) {
        postMessage({ type: 'backgrounds-done', backgrounds }, buffers)
    }

    console.log('backgrounds done')
}).catch(e => {
    console.error('Error processing backgrounds', e)
})

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
    const colliderObjects = []
    const markerObjects = []
    const allMarkers = []

    const s = performance.now()
    for(var i = 0; i < objects.length; i++) {
        var obj = objects[i]
        var cs = obj.components

        var display = null
        for(var j = 0; j < cs.length; j++) {
            var comp = cs[j]

            var enemy = getAsSchema(comp, ti.Enemy)
            if(enemy != null) {
                const size = comp._schema === ti.Boss ? 3 : 1 + 0.33 * enemy.size
                display = [obj, enemy.spriteI, size]
            }

            var jar = getAsSchema(comp, ti.Jar)
            if(jar != null) {
                display = createOneTex(obj, jar)
            }

            var crDes = getAsSchema(comp, ti.CrystalDestroyable)
            if(crDes != null) {
                const ti = meta.crystalDestroyableTextures[crDes.dropXp ? 1 : 0]
                display = [obj, ti, 1 + 0.5 * crDes.size]
            }

            var scarab = getAsSchema(comp, ti.ScarabPickup)
            if(scarab != null) {
                display = createOneTex(obj, scarab)
            }

            var coll = getAsSchema(comp, ti.Collider2D)
            if(coll != null) {
                if(coll._schema !== ti.TilemapCollider2D) {
                    colliderObjects.push([obj, comp])
                }
            }
        }

        if(display != null) {
            allMarkers.push({ index: i, object: obj, displayI: markerObjects.length })
            markerObjects.push(display)
        }
    }
    const e = performance.now()
    console.log('objects done in', e - s)

    return { colliderObjects, markerObjects, allMarkers }
}).catch(e => {
    console.error('Error processing objects', e)
    throw e
})

objectsProcessedP.then(pObjects => {
    if(!__worker_markers) return void console.warn('skipping markers')

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

    const markersB = new ArrayBuffer(markerObjects.length * 16)
    const dv = new DataView(markersB)
    for(var i = 0; i < markerObjects.length; i++) {
        const [obj, texI, size0] = markerObjects[i]
        const size = size0 > 0 ? size0 : 1.0
        const pos = obj.pos

        dv.setFloat32(i * 16     , pos[0], true)
        dv.setFloat32(i * 16 + 4 , pos[1], true)
        dv.setUint32(i * 16 + 8 , texI, true)
        dv.setFloat32(i * 16 + 12, size, true)
    }

    postMessage({
        type: 'markers-done',
        markers: markersB,
        markersData: markerDataB,
        count: markerObjects.length
    }, [markersB, markerDataB])
}).catch(e => {
    console.error('Error processing markers', e)
})

const boxPoints = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]

var polygons
Promise.all([objectsProcessedP, polygonsP]).then(([pObjects, polygonsA]) => {
    polygons = Load.parse(parsedSchema, polygonsA)

    const { colliderObjects } = pObjects

    var totalPointsC = 0, totalIndicesC = 0
    var totalCircularC = 0
    const polyDrawDataByLayer = Array(32)
    const circularDrawDataByLayer = Array(32)

    for(var i = 0; i < 32; i++) {
        polyDrawDataByLayer[i] = []
        circularDrawDataByLayer[i] = []
    }

    for(var i = 0; i < colliderObjects.length; i++) {
        const pobj = colliderObjects[i]
        const layer = pobj[0].layer, coll = pobj[1], s = pobj[1]._schema

        if(s === ti.CompositeCollider2D) {
            const polygon = polygons[coll.polygons]
            if(polygon.indices.length == 0) continue

            polyDrawDataByLayer[layer].push(pobj)

            totalPointsC += polygon.points.length
            totalIndicesC += polygon.indices.length
        }
        else if(s === ti.PolygonCollider2D) {
            const polygon = polygons[coll.points]
            if(polygon.indices.length == 0) continue

            polyDrawDataByLayer[layer].push(pobj)

            totalPointsC += polygon.points.length
            totalIndicesC += polygon.indices.length
        }
        else if(s === ti.BoxCollider2D) {
            polyDrawDataByLayer[layer].push(pobj)

            totalPointsC += 4
            totalIndicesC += 6
        }
        else if(s === ti.CircleCollider2D) {
            circularDrawDataByLayer[layer].push(pobj)
            totalCircularC++
        }
        else if(s === ti.CapsuleCollider2D) {
            circularDrawDataByLayer[layer].push(pobj)
            totalCircularC++
        }
    }

    const verts = new Float32Array(totalPointsC * 2)
    const indices = new Uint32Array(totalIndicesC)
    let vertI = 0, indexI = 0
    const polyDrawData = []
    for(let i = 0; i < polyDrawDataByLayer.length; i++) {
        const startIndexI = indexI

        const datas = polyDrawDataByLayer[i]
        if(datas.length == 0) continue
        for(let j = 0; j < datas.length; j++) {
            const startVertexI = vertI

            const data = datas[j]
            const m = data[0].matrix
            const coll = data[1]
            const off = getAsSchema(coll, ti.Collider2D).offset

            if(coll._schema === ti.CompositeCollider2D) {
                const poly = polygons[coll.polygons]
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
                const size = coll.size
                for(let k = 0; k < boxPoints.length; k++) {
                    const x = boxPoints[k][0] * size[0] + off[0]
                    const y = boxPoints[k][1] * size[1] + off[1]
                    verts[vertI*2    ] = x * m[0] + y * m[1] + m[2]
                    verts[vertI*2 + 1] = x * m[3] + y * m[4] + m[5]
                    vertI++
                }
                indices[indexI++] = startVertexI + 0
                indices[indexI++] = startVertexI + 1
                indices[indexI++] = startVertexI + 2
                indices[indexI++] = startVertexI + 1
                indices[indexI++] = startVertexI + 2
                indices[indexI++] = startVertexI + 3
            }
        }

        polyDrawData.push({ startIndexI, length: indexI - startIndexI, layer: i })
    }

    // we need to send the whole 2x3 matrix + the bigger size of the capsule collider
    const cirSize = 28
    const circularData = new ArrayBuffer(cirSize * totalCircularC)
    const cirdv = new DataView(circularData)
    const circularDrawData = []
    var circI = 0
    for(let i = 0; i < circularDrawDataByLayer.length; i++) {
        const startCircI = circI

        const cdd = circularDrawDataByLayer[i]
        if(cdd.length === 0) continue
        for(let j = 0; j < cdd.length; j++) {
            const data = cdd[j]
            const m = data[0].matrix
            const coll = data[1]
            const off = getAsSchema(coll, ti.Collider2D).offset

            if(coll._schema === ti.CircleCollider2D) {
                const newM = new Float32Array(circularData, circI * cirSize, 6)
                newM[0] = coll.radius * 2
                newM[2] = off[0]
                newM[4] = coll.radius * 2
                newM[5] = off[1]
                cirdv.setFloat32(circI * cirSize + 24, 1, true)
                premultiplyBy(newM, m)
                circI++
            }
            else if(coll._schema === ti.CapsuleCollider2D) {
                const size = coll.size
                const newM = new Float32Array(circularData, circI * cirSize, 6)
                if(coll.size[0] > coll.size[1]) {
                    newM[0] = coll.size[0]
                    newM[2] = off[0]
                    newM[4] = coll.size[1]
                    newM[5] = off[1]
                    cirdv.setFloat32(circI * cirSize + 24, size[0] / size[1], true)
                }
                else { // rotate 90 degrees because the shader expects width > height
                    newM[1] = -coll.size[0]
                    newM[2] = off[0]
                    newM[3] = coll.size[1]
                    newM[5] = off[1]
                    cirdv.setFloat32(circI * cirSize + 24, size[1] / size[0], true)
                }
                premultiplyBy(newM, m)
                circI++
            }
        }

        circularDrawData.push({ startIndexI: startCircI, length: circI - startCircI, layer: i })
    }

    postMessage({
        type: 'colliders-done',
        verts, indices, polyDrawData,
        circularData, circularDrawData,
    }, [verts.buffer, indices.buffer, circularData])
}).catch(e => {
    console.error('Error processing colliders', e)
})

var lastX, lastY, allMarkers
objectsProcessedP.then(d => {
    allMarkers = d.allMarkers
    if(lastX != null) onClick(lastX, lastY)
})

function serializeObject(obj) {
    const referenceNames = {}

    const children = Array(obj.children.length)
    for(let i = 0; i < obj.children.length; i++) {
        const child = obj.children[i]
        if(child) {
            children[i] = child._index
            const name = child.name
            if(name) {
                referenceNames[child._index] = name
            }
        }
        else {
            children[i] = null
        }
    }

    for(let i = 0; i < obj.components.length; i++) {
        const cc = obj.components[i]
        const s = getAsSchema(cc, ti.ScarabPickup)
        if(s) {
            const name = objects[s.container]?.name
            if(name) referenceNames[s.container] = name;
        }

        const t = getAsSchema(cc, ti.Transition)
        if(t) {
            const name = objects[t.destI]?.name
            if(name) referenceNames[t.destI] = name
        }
    }

    var parentI = obj._parentI
    if(parentI < 0) {
        const name = scenes[-parentI - 1]?.name
        if(name) referenceNames[parentI] = name
    }
    else {
        const parent = objects[parentI]
        if(parent != null) {
            const name = parent.name
            if(name) referenceNames[parentI] = name
        }
    }

    return {
        name: obj.name,
        pos: obj.pos,
        components: obj.components,
        referenceNames,
        children,
        parent: parentI,
    }
}

function onClick(x, y) {
    lastX = x
    lastY = y
    if(allMarkers == null) return

    const closest = Array(5)
    for(let i = 0; i < closest.length; i++) {
        closest[i] = [1/0, -1]
    }

    for(let i = 0; i < allMarkers.length; i++) {
        const obj = allMarkers[i].object
        const pos = obj.pos
        const dx = pos[0] - x
        const dy = pos[1] - y
        const sqDist = dx*dx + dy*dy

        var insertI = 0
        while(insertI < closest.length && closest[insertI][0] < sqDist) insertI++

        if(insertI < closest.length) {
            closest.splice(insertI, 1, [sqDist, i])
        }
    }

    let endI = 0
    while(endI < closest.length && closest[endI][1] !== -1) endI++
    closest.length = endI

    if(closest.length !== 0) {
        const c = closest[0]
        const obj = allMarkers[c[1]].object
        const first = serializeObject(obj)
        first.markerI = c[1]

        const nearby = Array(closest.length - 1)
        for(let i = 1; i < closest.length; i++) {
            const c = closest[i]
            nearby.push({
                name: allMarkers[c[1]].object.name,
                distance: Math.sqrt(c[0]),
                markerIndex: c[1],
            })
        }

        postMessage({
            type: 'click',
            first, nearby: closest
        })
    }
    else {
        postMessage({ type: 'click' })
    }
}

function getInfo(index) {
    console.log(index)
    const object = objects[index]
    if(object) postMessage({ type: 'getInfo', object: serializeObject(object) })
}
