import { loadShader, checkProg } from './render_util.js'

const vsSource = `#version 300 es
precision highp float;

uniform vec2 translate;
uniform float scale;
uniform float aspect;

uniform float bannerScale;

in vec2 coord;
in uint xy;
in uint wh;
in float bannerAspect;

out vec2 uv;

const vec2 coords[4] = vec2[4](
    vec2(-1.0, -1.0),
    vec2(1.0, -1.0),
    vec2(-1.0, 1.0),
    vec2(1.0, 1.0)
);

void main(void) {

    vec2 bannerFac = vec2(bannerAspect, 1);
    if(bannerAspect < 0.0) bannerFac = vec2(1, -bannerAspect);

    vec2 pos = (translate + coord) * scale + coords[gl_VertexID] * bannerScale * bannerFac;
    pos.x *= aspect;
    gl_Position = vec4(pos, 1.0, 1.0);

    float fac = 1.0 / 65535.0;
    vec2 off = mix(vec2(0, 0), vec2(wh & 65535u, wh >> 16u), vec2(gl_VertexID & 1, 1 - (gl_VertexID >> 1)));
    uv = (vec2(xy & 65535u, xy >> 16u) + off) * fac;
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

export function setup(gl, context, markersData) {
    const renderData = {}
    context.markers = renderData

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource)
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource)

    const prog = gl.createProgram()
    gl.attachShader(prog, vertexShader, 'markers v')
    gl.attachShader(prog, fragmentShader, 'markers f')
    gl.linkProgram(prog)

    if(!checkProg(gl, prog)) return

    gl.useProgram(prog)

    const texture = gl.createTexture()
    renderData.texture = texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texStorage2D(gl.TEXTURE_2D, 6, gl.RGBA8, markersData.size[0], markersData.size[1])
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

        renderData.ok = true
        context.requestRender(1)
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
    gl.bindBuffer(gl.ARRAY_BUFFER, dataB)
    gl.bufferData(gl.ARRAY_BUFFER, markersData.data, gl.STATIC_DRAW)

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    gl.bindBuffer(gl.ARRAY_BUFFER, dataB)
    const coordIn = gl.getAttribLocation(renderData.prog, 'coord')
    gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 20, 0)
    gl.enableVertexAttribArray(coordIn)
    gl.vertexAttribDivisor(coordIn, 1)

    const xyIn = gl.getAttribLocation(renderData.prog, 'xy')
    gl.vertexAttribIPointer(xyIn, 1, gl.UNSIGNED_INT, 20, 8)
    gl.enableVertexAttribArray(xyIn)
    gl.vertexAttribDivisor(xyIn, 1)

    const whIn = gl.getAttribLocation(renderData.prog, 'wh')
    gl.vertexAttribIPointer(whIn, 1, gl.UNSIGNED_INT, 20, 12)
    gl.enableVertexAttribArray(whIn)
    gl.vertexAttribDivisor(whIn, 1)

    const asIn = gl.getAttribLocation(renderData.prog, 'bannerAspect')
    gl.vertexAttribPointer(asIn, 1, gl.FLOAT, false, 20, 16)
    gl.enableVertexAttribArray(asIn)
    gl.vertexAttribDivisor(asIn, 1)

    renderData.vao = vao
    renderData.count = markersData.count
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
