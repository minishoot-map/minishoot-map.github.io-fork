import * as load from './load.js'
import markerData from './data-processed/markers.json'
import meta from './data-processed/meta.json'

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

const fsSource = `#version 300 es
precision highp float;

out vec4 color;

void main(void) {
    color = vec4(1, 0, 0, 1);
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

const parsedSchema = load.parseSchema(meta.schemas)
polygonsP.then(polygons => {
    const res = load.parse(parsedSchema, polygons)
    const { points, indices } = res[1]

    const verts = new Float32Array(points.length * 2)
    for(let i = 0; i < points.length; i++) {
        const p = points[i]
        verts[i * 2    ] = p[0]
        verts[i * 2 + 1] = p[1]
    }
    const verticesB = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)

    const ind = new Uint16Array(indices)

    const indicesB = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ind, gl.STATIC_DRAW)

    const coordIn = gl.getAttribLocation(shaderProgram, 'coord')

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)
    gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
    gl.enableVertexAttribArray(coordIn)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    number = indices.length
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

var number
function render() {
    if(window.__stop) return
    const rect = canvas.getBoundingClientRect()
    const invSize = Math.max(rect.right - rect.left, rect.bottom - rect.top)
    gl.uniform2f(translateU, -posX, -posY)
    gl.uniform1f(scaleU, 1 / scale)

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, number, gl.UNSIGNED_SHORT, 0)
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
