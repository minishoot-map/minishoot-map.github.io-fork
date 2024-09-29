import { loadShader, checkProg } from './render_util.js'
import colliderColorsS from './colliderColors.js'

const vsSource = `#version 300 es
precision highp float;

layout(std140) uniform Camera {
    vec2 add;
    vec2 multiply;
} cam;

in vec2 coord;

void main(void) {
    vec2 pos = coord * cam.multiply + cam.add;
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

function checkOk(context) {
    const m = context?.polygons
    if(m && m.buffersOk && m.filtersOk) {
        m.ok = true
        context.requestRender(1)
    }
}

export function setup(gl, context, collidersDataP) {
    const renderData = {}
    context.polygons = renderData

    if(!__setup_colliders) return

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource, 'polygons v')
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource, 'polygons f')

    const prog = gl.createProgram()
    gl.attachShader(prog, vertexShader)
    gl.attachShader(prog, fragmentShader)
    gl.linkProgram(prog)

    if(!checkProg(gl, prog)) return

    gl.useProgram(prog)

    gl.uniformBlockBinding(prog, gl.getUniformBlockIndex(prog, "Camera"), 0)

    const layer = gl.getUniformLocation(prog, 'layer')
    renderData.u = { layer }
    renderData.prog = prog

    const verticesB = gl.createBuffer()
    const indicesB = gl.createBuffer()

    const vao = gl.createVertexArray()
    renderData.vao = vao
    gl.bindVertexArray(vao)

    gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)
    const coordIn = gl.getAttribLocation(renderData.prog, 'coord')
    gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
    gl.enableVertexAttribArray(coordIn)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)

    collidersDataP.then(collidersData => {
        gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)
        gl.bufferData(gl.ARRAY_BUFFER, collidersData.verts, gl.STATIC_DRAW)

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, collidersData.indices, gl.STATIC_DRAW)

        renderData.drawData = Array(32).fill(null)
        const pd = collidersData.polyDrawData
        for(let i = 0; i < pd.length; i++) {
            renderData.drawData[pd[i].layer] = pd[i]
        }

        renderData.buffersOk = true
        checkOk(context)
    })
}

export function setFiltered(context, layers) {
    const renderData = context?.polygons
    if(!renderData) return console.error('renderData where?')

    renderData.layers = layers
    renderData.filtersOk = true
    checkOk(context)
}

export function render(context) {
    const rd = context.polygons
    if(rd?.ok !== true) return
    const { gl } = context

    gl.useProgram(rd.prog)
    gl.bindVertexArray(rd.vao)
    for(let i = 0; i < rd.layers.length; i++) {
        const layerI = rd.layers[i]
        const it = rd.drawData[layerI]
        if(!it) continue
        gl.uniform1i(rd.u.layer, it.layer)
        gl.drawElements(gl.TRIANGLES, it.length, gl.UNSIGNED_INT, it.startIndexI * 4)
    }
}
