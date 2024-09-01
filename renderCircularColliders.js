import { loadShader, checkProg } from './render_util.js'
import colliderColorsS from './collirderColors.js'

const vsSource = `#version 300 es
precision highp float;

uniform vec2 translate;
uniform float scale;
uniform float aspect;

in vec3 transform1;
in vec3 transform2;
in vec2 size;

const vec2 coords[4] = vec2[4](
    vec2(-0.5, -0.5),
    vec2(0.5, -0.5),
    vec2(-0.5, 0.5),
    vec2(0.5, 0.5)
);

flat out float collWidth;
out vec2 collCoord;

void main(void) {
    vec2 coord = coords[gl_VertexID];
    coord = vec2(dot(coord, transform1.xy) + transform1.z, dot(coord, transform2.xy) + transform2.z);

    vec2 pos = (translate + coord) * scale;
    pos.x *= aspect;
    gl_Position = vec4(pos, 1.0, 1.0);

    if(size.x > size.y) {
        collWidth = size.x / size.y;
        collCoord = vec2(coords[gl_VertexID].x * (size.x / size.y), coords[gl_VertexID].y) * 2.0;
    }
    else {
        collWidth = size.y / size.x;
        collCoord = vec2(coords[gl_VertexID].y * (size.y / size.x), coords[gl_VertexID].x) * 2.0;
    }
}
`

const fsSource = `#version 300 es
precision mediump float;

uniform int layer;

flat in float collWidth;
in vec2 collCoord;

out vec4 color;

${colliderColorsS}

void main(void) {
    vec4 col = layerColors[layer];

    float maxOff = collWidth - 1.0;
    if(collCoord.x < -maxOff) {
        vec2 off = vec2(-maxOff - collCoord.x, collCoord.y);
        float dist2 = dot(off, off);
        if(dist2 > 1.0) col = vec4(0, 0, 0, 0);
    }
    else if(collCoord.x > maxOff) {
        vec2 off = vec2(collCoord.x - maxOff, collCoord.y);
        float dist2 = dot(off, off);
        if(dist2 > 1.0) col = vec4(0, 0, 0, 0);
    }

    color = col;
}
`

export function setup(gl, context, collidersData) {
    const renderData = {}
    context.circular = renderData

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource, 'circular colliders v')
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource, 'circular colliders f')

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

    const dataB = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, dataB)
    gl.bufferData(gl.ARRAY_BUFFER, collidersData.circularData, gl.STATIC_DRAW)

    const vao = gl.createVertexArray()
    renderData.vao = vao
    gl.bindVertexArray(vao)

    gl.bindBuffer(gl.ARRAY_BUFFER, dataB)
    const t1In = gl.getAttribLocation(renderData.prog, 'transform1')
    gl.enableVertexAttribArray(t1In)
    gl.vertexAttribDivisor(t1In, 1)

    const t2In = gl.getAttribLocation(renderData.prog, 'transform2')
    gl.enableVertexAttribArray(t2In)
    gl.vertexAttribDivisor(t2In, 1)

    const sizeIn = gl.getAttribLocation(renderData.prog, 'size')
    gl.enableVertexAttribArray(sizeIn)
    gl.vertexAttribDivisor(sizeIn, 1)

    renderData.inputs = { t1In, t2In, sizeIn }

    renderData.drawData = collidersData.circularDrawData
    renderData.__cd = collidersData.circularData
    renderData.ok = true
    context.requestRender(1)
}

export function render(context) {
    const rd = context.circular
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

        // webgl2 does not suck
        // https://stackoverflow.com/questions/69510570/drawing-specific-instances-in-gl-drawarraysinstanced
        const offset = it.startIndexI * 32
        const { t1In, t2In, sizeIn } = rd.inputs
        gl.vertexAttribPointer(t1In  , 3, gl.FLOAT, false, 32, offset + 0)
        gl.vertexAttribPointer(t2In  , 3, gl.FLOAT, false, 32, offset + 12)
        gl.vertexAttribPointer(sizeIn, 2, gl.FLOAT, false, 32, offset + 24)

        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, it.length)
    }
}
