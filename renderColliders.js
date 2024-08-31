import { loadShader, checkProg } from './render_util.js'

const vsSource = `#version 300 es
precision highp float;

uniform vec2 translate;
uniform float scale;
uniform float aspect;

in vec2 coord;

void main(void) {
    vec2 pos = (translate + coord) * scale;
    pos.x *= aspect;
    gl_Position = vec4(pos, 1.0, 1.0);
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
    let r = parseInt(c.slice(0, 2), 16) / 255
    let g = parseInt(c.slice(2, 4), 16) / 255
    let b = parseInt(c.slice(4, 6), 16) / 255
    let a = parseInt(c.slice(6, 8), 16) / 255
    if(i != 0) colliderColorsS += ',\n'
    colliderColorsS += `vec4(${r}, ${g}, ${b}, ${a})`
}
colliderColorsS += ');'

const fsSource = `#version 300 es
precision mediump float;

uniform int layer;

out vec4 color;

${colliderColorsS}

void main(void) {
    color = layerColors[layer];
}
`

export function setup(gl, context, collidersData) {
    const renderData = {}
    context.polygons = renderData

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource)
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource)

    const prog = gl.createProgram()
    gl.attachShader(prog, vertexShader, 'polygons v')
    gl.attachShader(prog, fragmentShader, 'polygons f')
    gl.linkProgram(prog)

    if(!checkProg(gl, prog)) return

    gl.useProgram(prog)

    const translate = gl.getUniformLocation(prog, 'translate')
    const scale = gl.getUniformLocation(prog, 'scale')
    const aspect = gl.getUniformLocation(prog, 'aspect')
    const layer = gl.getUniformLocation(prog, 'layer')

    renderData.u = { translate, scale, aspect, layer }
    renderData.prog = prog

    const verticesB = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)
    gl.bufferData(gl.ARRAY_BUFFER, collidersData.verts, gl.STATIC_DRAW)

    const indicesB = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, collidersData.indices, gl.STATIC_DRAW)


    const polygonsVao = gl.createVertexArray()
    gl.bindVertexArray(polygonsVao)

    gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)
    const coordIn = gl.getAttribLocation(renderData.prog, 'coord')
    gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
    gl.enableVertexAttribArray(coordIn)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)

    renderData.vao = polygonsVao
    renderData.drawData = collidersData.polyDrawData
    renderData.ok = true
    context.requestRender(1)
}

export function render(context) {
    const rd = context.polygons
    if(rd?.ok !== true) return
    const { gl, camera, canvasSize } = context

    gl.useProgram(rd.prog)
    gl.uniform2f(rd.u.translate, -camera.posX, -camera.posY)
    gl.uniform1f(rd.u.scale, 1 / camera.scale)
    gl.uniform1f(rd.u.aspect,  canvasSize[1] / canvasSize[0])

    gl.bindVertexArray(rd.vao)
    for(let i = 0; i < rd.drawData.length; i++) {
        const it = rd.drawData[i]
        gl.uniform1i(rd.u.layer, it.layer)
        gl.drawElements(gl.TRIANGLES, it.length, gl.UNSIGNED_INT, it.startIndexI * 4)
    }
}
