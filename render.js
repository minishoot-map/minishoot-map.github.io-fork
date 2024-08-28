import * as load from './load.js'
import markerData from './data-processed/markers.json'
import meta from './data-processed/meta.json'

const parsedSchema = load.parseSchema(meta.schemas)

const objectsP = fetch('./data/objects.bp').then(it => it.arrayBuffer()).then(it => new Uint8Array(it))
const polygonsP = fetch('./data/polygons.bp').then(it => it.arrayBuffer()).then(it => new Uint8Array(it))

const canvas = document.getElementById('glCanvas')
const gl = canvas.getContext('webgl2')

if (!gl) { throw 'WebGL 2 is not supported.' }

const vsSource = `#version 300 es
precision highp float;

uniform vec2 translate;
uniform float scale;

in vec2 coord;

void main(void) {
    gl_Position = vec4((translate + coord) * scale, 1.0, 1.0);
}
`
const colliderColors = {
    0 : "0a590360", // destroyable
    4 : "6a97dd20", // water
    6 : "35009920", // deep water
    12: "f9000060", // enemy
    13: "f9000060", // enemy
    14: "c14a0320", // wall
    16: "00000020", // hole
    17: "ff00ff40", // trigger?
    23: "11656360", // static
    25: "4f3c0140", // bridge
    26: "f9005060", // enemy (stationary)
    31: "11656360", // static
    fallback: "9400f920"
}
let colliderColorsS = 'const vec4 layerColors[32] = vec4[32]('
for(let i = 0; i < 32; i++) {
    const c = colliderColors[i] ?? colliderColors.fallback
    let a = parseInt(c.slice(6, 8), 16) / 255
    let r = a * parseInt(c.slice(0, 2), 16) / 255
    let g = a * parseInt(c.slice(2, 4), 16) / 255
    let b = a * parseInt(c.slice(4, 6), 16) / 255
    if(i != 0) colliderColorsS += ',\n'
    colliderColorsS += `vec4(${r}, ${g}, ${b}, ${a})`
}
colliderColorsS += ');'

const fsSource = `#version 300 es
precision highp float;

uniform int layer;

out vec4 color;

${colliderColorsS}

void main(void) {
    color = layerColors[layer];
}
`


// Compile shader program
function loadShader(type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`An error occurred compiling the ${type == gl.VERTEX_SHADER ? 'v' : 'f'} shader: ${gl.getShaderInfoLog(shader)}`)
        gl.deleteShader(shader)
        return null
    }
    return shader
}

const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource)
const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource)

const shaderProgram = gl.createProgram()
gl.attachShader(shaderProgram, vertexShader)
gl.attachShader(shaderProgram, fragmentShader)
gl.linkProgram(shaderProgram)

if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram))
}

gl.useProgram(shaderProgram)

const translateU = gl.getUniformLocation(shaderProgram, 'translate')
const scaleU = gl.getUniformLocation(shaderProgram, 'scale')
const layerU = gl.getUniformLocation(shaderProgram, 'layer')

const positionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
const vertexData = new ArrayBuffer(20 * 5)
const v = new DataView(vertexData)

var count = 0
for(const name in markerData) {
    if(count >= 5) break
    const m = markerData[name]

    v.setFloat32(0 + count*20, (m[0] + m[2]*0.5) / 2048 * 2 - 1, true)
    v.setFloat32(4 + count*20, 1 - (m[1] + m[3]*0.5) / 4096 * 2, true)
    v.setFloat32(8 + count*20, m[2] > m[3] ? m[2] / 2048 / 2 : m[3] / 4096 / 2, true)
    v.setUint16(12 + count*20, m[0], true)
    v.setUint16(14 + count*20, m[1], true)
    v.setUint16(16 + count*20, m[2], true)
    v.setUint16(18 + count*20, m[3], true)

    count++
}
gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW)


/* const m = markerData['Overworld 410 Miniboss Busher T1 S3.png']

const textureCoordBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer)
const textureCoordinates = [
    m[0] / 2048, m[1] / 4096,
    m[0] / 2048, m[3] / 4096,
    m[2] / 2048, m[1] / 4096,
    m[2] / 2048, m[3] / 4096,
]
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);*/

const texture = gl.createTexture()
gl.bindTexture(gl.TEXTURE_2D, texture)


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


// class itself is also in the list!
const schemaSubclasses = Array(meta.schemas.length)
for(let i = 0; i < schemaSubclasses.length; i++) schemaSubclasses[i] = {}

for(let i = 0; i < meta.schemas.length; i++) {
    let classI = i
    let baseC = 0
    while(classI != null) {
        schemaSubclasses[classI][i] = baseC
        classI = meta.schemas[classI][2]?.base
        baseC++
    }
}

function getAsSchema(it, schemaI) {
    var baseC = schemaSubclasses[schemaI][it._schema]
    if(baseC == null) return
    for(; baseC > 0; baseC--) it = it._base
    return it
}

const objects = []
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

/*const image = new Image()
image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.generateMipmap(gl.TEXTURE_2D)

    render()
}
image.src = './data/markers.png';*/

var renderData = {}

Promise.all([objectsP, polygonsP]).then(([objectsA, polygonsA]) => {
    const scenes = load.parse(parsedSchema, objectsA)
    const polygons = load.parse(parsedSchema, polygonsA)

    for(let i = 0; i < scenes.length; i++) {
        const roots = scenes[i].roots
        for(let j = 0; j < roots.length; j++) {
            prepareObjects(null, -1 - i, roots[j])
        }
    }

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

    const verticesB = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)

    const indicesB = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)


    const polygonsVao = gl.createVertexArray()
    gl.bindVertexArray(polygonsVao)

    gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)

    const coordIn = gl.getAttribLocation(shaderProgram, 'coord')
    gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
    gl.enableVertexAttribArray(coordIn)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)


    renderData.polygonsVao = polygonsVao
    renderData.polygons = polyDrawData

    const centerVao = gl.createVertexArray()
    gl.bindVertexArray(centerVao)

    const centerB = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, centerB)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 1, 1, -1]), gl.STATIC_DRAW)
    gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
    gl.enableVertexAttribArray(coordIn)

    renderData.centerVao = centerVao

    render()
})

var minScale = 0.1, maxScale = 1000
function clampedScale(scale, old) {
    if(scale != scale) {
        return [false, old]
    }
    if(scale <= maxScale) {
        if(scale >= minScale) return [true, scale]
        else return [false, minScale]
    }
    else return [false, maxScale]
}
function clampScale(scale, old) {
    return clampedScale(scale, old)[1]
}

var posX = 0, posY = 0, scale = 100

function prepInfo() {
    const rect = canvas.getBoundingClientRect()
    const cx = (rect.right + rect.left) * 0.5
    const cy = (rect.bottom + rect.top) * 0.5
    return { cx, cy, scale: 2 / Math.max(rect.right - rect.left, rect.bottom - rect.top) }
}
function xScreenToWorld(it, info) {
    return (it - info.cx) * info.scale * scale + posX
}
function yScreenToWorld(it, info) {
    return -(it - info.cy) * info.scale * scale + posY
}

canvas.addEventListener('wheel', (e) => {
    e.preventDefault()

    const info = prepInfo()

    const offsetX = xScreenToWorld(e.clientX, info)
    const offsetY = yScreenToWorld(e.clientY, info)

    const zoomFactor = 0.004
    var delta = 1 + Math.abs(e.deltaY) * -zoomFactor
    if(e.deltaY > 0) delta = 1 / delta

    const newScale = clampScale(scale * delta, scale)

    const tx = offsetX - (offsetX - posX) * (newScale / scale)
    const ty = offsetY - (offsetY - posY) * (newScale / scale)

    scale = newScale
    posX = tx
    posY = ty
});

var panning = { is: false, prevX: undefined, prevY: undefined }

canvas.addEventListener('mousedown', (e) => {
    const info = prepInfo()
    panning.is = true
    panning.prevX = xScreenToWorld(e.clientX, info)
    panning.prevY = yScreenToWorld(e.clientY, info)
});

canvas.addEventListener('mouseup', () => {
    panning.is = false
});

canvas.addEventListener('mousemove', (e) => {
    if(!panning.is) return
    const info = prepInfo()

    const curX = xScreenToWorld(e.clientX, info)
    const curY = yScreenToWorld(e.clientY, info)

    posX -= curX - panning.prevX
    posY -= curY - panning.prevY
});


gl.enable(gl.BLEND);
// note: premultiplied alpha. Straight alpha looks completely wrong
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
// gl.clearColor(1, 1, 1, 1);

function render() {
    if(window.__stop) return
    gl.uniform2f(translateU, -posX, -posY)
    gl.uniform1f(scaleU, 1 / scale)

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindVertexArray(renderData.polygonsVao)
    for(let i = 0; i < renderData.polygons.length; i++) {
        const it = renderData.polygons[i]
        gl.uniform1i(layerU, it.layer)
        gl.drawElements(gl.TRIANGLES, it.length, gl.UNSIGNED_INT, it.startIndexI * 4)
    }

    // gl.bindVertexArray(renderData.centerVao)
    // gl.uniformMatrix2x3fv(transformU, false, new Float32Array([100, 0, 0, 0, 100, 0]))
    // gl.drawArrays(gl.TRIANGLES, 0, 3)

    requestAnimationFrame(render)
}

/*
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

gl.vertexAttribPointer(attrs.position, 2, gl.FLOAT, false, 20, 0)
gl.enableVertexAttribArray(attrs.position)
gl.vertexAttribDivisor(attrs.position, 1)

gl.vertexAttribPointer(attrs.scale, 1, gl.FLOAT, false, 20, 8)
gl.enableVertexAttribArray(attrs.scale)
gl.vertexAttribDivisor(attrs.scale, 1)

gl.vertexAttribIPointer(attrs.texture_data, 2, gl.UNSIGNED_INT, 20, 12)
gl.enableVertexAttribArray(attrs.texture_data)
gl.vertexAttribDivisor(attrs.texture_data, 1)
*/
