import { loadShader, checkProg } from './render_util.js'
import markersMeta from './data-processed/markers-meta.json'

const vsSource = `#version 300 es
precision highp float;

uniform vec2 translate;
uniform float scale;
uniform float aspect;

uniform float bannerScale;

struct MarkerData {
    uint xy, wh;
    float aspect;
};

layout(std140) uniform MarkersData {
    MarkerData markersData[${markersMeta[0]}];
};

in vec2 coord;
in uint index;
in float size;

out vec2 uv;

const vec2 coords[4] = vec2[4](
    vec2(-1.0, -1.0),
    vec2(1.0, -1.0),
    vec2(-1.0, 1.0),
    vec2(1.0, 1.0)
);
const float intToFloat = ${1 / 65535};

void main(void) {
    MarkerData md = markersData[index];
    float texAspect = md.aspect;
    uint xy = md.xy;
    uint wh = md.wh;

    vec2 offset = coords[gl_VertexID] * bannerScale;
    if(texAspect < 0.0) offset.y *= -texAspect;
    else offset.x *= texAspect;

    vec2 pos = (translate + coord) * scale + offset;
    gl_Position = vec4(pos.x * aspect, pos.y, 1.0, 1.0);

    vec2 uvOff = vec2(wh & 65535u, wh >> 16u) * vec2(gl_VertexID & 1, 1 - (gl_VertexID >> 1));
    uv = (vec2(xy & 65535u, xy >> 16u) + uvOff) * intToFloat;
}
`
const fsSource = `#version 300 es
precision mediump float;

uniform sampler2D tex;
in vec2 uv;

out vec4 color;

void main(void) {
    color = texture(tex, uv);
}
`

function checkOk(context) {
    if(context.markers.texOk && context.markers.bufOk) {
        context.markers.ok = true
        context.requestRender(1)
    }
}

export function setup(gl, context, markersDataP) {
    const renderData = {}
    context.markers = renderData

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource, 'markers v')
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource, 'markers f')

    const prog = gl.createProgram()
    gl.attachShader(prog, vertexShader)
    gl.attachShader(prog, fragmentShader)
    gl.linkProgram(prog)

    if(!checkProg(gl, prog)) return

    gl.useProgram(prog)

    const texture = gl.createTexture()
    renderData.texture = texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texStorage2D(gl.TEXTURE_2D, 6, gl.RGBA8, markersMeta[1], markersMeta[2])
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.activeTexture(gl.TEXTURE0 + 1)
    gl.bindTexture(gl.TEXTURE_2D, texture)

    const img = new Image()
    img.src = './data/markers.png'
    img.addEventListener('load', _ => {
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, img.width, img.height, gl.RGBA, gl.UNSIGNED_BYTE, img)
        gl.generateMipmap(gl.TEXTURE_2D)

        renderData.texOk = true
        checkOk(context)
    })

    const translate = gl.getUniformLocation(prog, 'translate')
    const scale = gl.getUniformLocation(prog, 'scale')
    const aspect = gl.getUniformLocation(prog, 'aspect')
    const bannerScale = gl.getUniformLocation(prog, 'bannerScale')
    const tex = gl.getUniformLocation(prog, 'tex')
    gl.uniform1i(tex, 1)

    renderData.u = { translate, scale, aspect, bannerScale }
    renderData.prog = prog

    const dataB = gl.createBuffer()

    const vao = gl.createVertexArray()
    renderData.vao = vao
    gl.bindVertexArray(vao)

    gl.bindBuffer(gl.ARRAY_BUFFER, dataB)
    const coordIn = gl.getAttribLocation(renderData.prog, 'coord')
    if(coordIn != -1) {
        gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 12, 0)
        gl.enableVertexAttribArray(coordIn)
        gl.vertexAttribDivisor(coordIn, 1)
    }

    const indexIn = gl.getAttribLocation(renderData.prog, 'index')
    if(indexIn != -1) {
        gl.vertexAttribIPointer(indexIn, 1, gl.UNSIGNED_SHORT, 12, 8)
        gl.enableVertexAttribArray(indexIn)
        gl.vertexAttribDivisor(indexIn, 1)
    }

    const sizeIn = gl.getAttribLocation(renderData.prog, 'size')
    if(sizeIn != -1) {
        gl.vertexAttribPointer(sizeIn, 1, gl.HALF_FLOAT, false, 12, 10)
        gl.enableVertexAttribArray(sizeIn)
        gl.vertexAttribDivisor(sizeIn, 1)
    }

    gl.bindVertexArray(null)

    const blockIndex = gl.getUniformBlockIndex(prog, "MarkersData")
    gl.uniformBlockBinding(prog, blockIndex, 0)

    const ubo = gl.createBuffer()
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo)

    markersDataP.then(data => {
        gl.bindBuffer(gl.UNIFORM_BUFFER, ubo)
        gl.bufferData(gl.UNIFORM_BUFFER, data.markersData, gl.STATIC_DRAW)

        gl.bindBuffer(gl.ARRAY_BUFFER, dataB)
        gl.bufferData(gl.ARRAY_BUFFER, data.markers, gl.STATIC_DRAW)

        renderData.count = data.count
        renderData.bufOk = true
        checkOk(context)
    })
}

export function render(context) {
    const rd = context.markers
    if(rd?.ok !== true) return
    const { gl, camera, canvasSize } = context

    gl.useProgram(rd.prog)
    gl.uniform2f(rd.u.translate, -camera.posX, -camera.posY)
    gl.uniform1f(rd.u.scale, 1 / camera.scale)
    gl.uniform1f(rd.u.aspect, canvasSize[1] / canvasSize[0])
    gl.uniform1f(rd.u.bannerScale, 10 / Math.max(camera.scale, 500))

    gl.bindVertexArray(rd.vao)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rd.count)
}