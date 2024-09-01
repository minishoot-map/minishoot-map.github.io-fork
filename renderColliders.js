import { loadShader, checkProg } from './render_util.js'
import colliderColorsS from './collirderColors.js'

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

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource, 'polygons v')
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource, 'polygons f')

    const prog = gl.createProgram()
    gl.attachShader(prog, vertexShader)
    gl.attachShader(prog, fragmentShader)
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


    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)
    const coordIn = gl.getAttribLocation(renderData.prog, 'coord')
    gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
    gl.enableVertexAttribArray(coordIn)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)

    renderData.vao = vao
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
