import * as bkg from './data-raw/backgrounds/backgrounds.js'
import { loadShader, checkProg } from './render_util.js'

const actualResolution = bkg.backgroundResolution * 0.25 // downscaled by script
const texturesC = bkg.backgrounds.length

// THIS LANGUAGE... IMAGINE TOT BEING ABLE TO PRINT A NUMBER WITH DECIMAL POINT
// NO, toFixed() ALSO ROUNDS THE NUMBER OR ADDS A MILLION ZEROS
// NO, toString() PRINTS INTEGERS WITHOUT DECIMAL POINT
const bgSize2 = bkg.backgroundSize * 0.5 + '.0'

const vsSource = `#version 300 es
precision highp float;

uniform vec2 translate;
uniform float scale;
uniform float aspect;

in vec2 coord;
in int index;

const vec2 coords[4] = vec2[4](
    vec2(-1.0, -1.0),
    vec2(1.0, -1.0),
    vec2(-1.0, 1.0),
    vec2(1.0, 1.0)
);

out vec2 uv;
flat out int tIndex;

void main(void) {
    vec2 pos = (translate + coord + coords[gl_VertexID] * ${bgSize2}) * scale;
    pos.x *= aspect;
    gl_Position = vec4(pos, 1.0, 1.0);
    vec2 uv0 = (coords[gl_VertexID] + 1.0) * 0.5;
    uv = vec2(uv0.x, 1.0 - uv0.y);
    tIndex = index;
}
`
const fsSource = `#version 300 es
precision mediump float;

uniform mediump sampler2DArray textures;
in vec2 uv;
flat in int tIndex;
out vec4 color;

void main(void) {
    color = texture(textures, vec3(uv, tIndex));
}
`

export function setup(context) {
    const { gl } = context

    const renderData = {}
    context.backgrounds = renderData

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource)
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource)

    const prog = gl.createProgram()
    renderData.prog = prog
    gl.attachShader(prog, vertexShader, 'backgrounds v')
    gl.attachShader(prog, fragmentShader, 'backgrounds f')
    gl.linkProgram(prog)

    if(!checkProg(gl, prog)) return

    gl.useProgram(prog)

    const bgTextures = gl.createTexture()
    renderData.bgTextures = bgTextures

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, bgTextures)
    // optimally you would paletize straight to rgb565 but I have no idea how to do it
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 6, gl.RGB565, actualResolution, actualResolution, texturesC)

    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST) // for now
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const images = Array(texturesC)
    renderData.images = images

    for(let i = 0; i < bkg.backgrounds.length; i++) {
        const b = bkg.backgrounds[i]

        const imgData = { ok: false, done: false }
        images[i] = imgData

        const img = new Image()
        imgData.img = img

        img.src = './data/backgrounds/' + b[0] + '_' + b[1] + '.png'
        img.addEventListener('error', _ => {
            // note: don't redender just because a texture errored.
            // Technically can be the last texture, so this will make
            // mimpaps not appear. But only until the user moves the screen
            // or something else triggers a rerender, so shouldn't be a big deal
            renderData.changed.push(i)
            imgData.done = true
        })
        img.addEventListener('load', _ => {
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, bgTextures)
            gl.texSubImage3D(
                gl.TEXTURE_2D_ARRAY, 0,
                0, 0, i,
                actualResolution, actualResolution, 1,
                gl.RGB, gl.UNSIGNED_BYTE,
                img
            )

            renderData.changed.push(i)
            imgData.ok = true
            imgData.done = true

            context.requestRender(2)
        })
    }

    const buf = gl.createBuffer()
    renderData.buf = buf
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, texturesC * 12, gl.DYNAMIC_DRAW)

    const coords = new ArrayBuffer(texturesC * 12)
    const coordsDv = new DataView(coords)
    renderData.dataView = coordsDv

    const vao = gl.createVertexArray()
    renderData.vao = vao
    gl.bindVertexArray(vao)

    const indexIn = gl.getAttribLocation(renderData.prog, 'index')
    const coordIn = gl.getAttribLocation(renderData.prog, 'coord')

    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 12, 0)
    gl.vertexAttribIPointer(indexIn, 1, gl.INT, 12, 8)

    gl.enableVertexAttribArray(coordIn)
    gl.vertexAttribDivisor(coordIn, 1)
    gl.enableVertexAttribArray(indexIn)
    gl.vertexAttribDivisor(indexIn, 1)

    const translate = gl.getUniformLocation(prog, 'translate')
    const scale = gl.getUniformLocation(prog, 'scale')
    const aspect = gl.getUniformLocation(prog, 'aspect')
    renderData.u = { translate, scale, aspect }

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, bgTextures)
    const texturesU = gl.getUniformLocation(prog, 'textures')
    gl.uniform1i(texturesU, 0)

    const c = bkg.backgroundColor
    // round background color to RGB565.
    // Not sure if rounding is officially specified anywhere
    // but this looks correct
    const r = (parseInt(c.slice(0, 2), 16) >> 3 << 3) / 255
    const g = (parseInt(c.slice(2, 4), 16) >> 2 << 2) / 255
    const b = (parseInt(c.slice(4, 6), 16) >> 3 << 3) / 255

    gl.clearColor(r, g, b, 1)

    renderData.changed = []
    renderData.curCount = 0
    renderData.ok = true
}

export function render(context) {
    const { gl, camera, canvasSize } = context
    const rd = context.backgrounds
    if(rd?.ok !== true) {
        gl.clearColor(1, 1, 1, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return
    }

    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(rd.prog)
    gl.uniform2f(rd.u.translate, -camera.posX, -camera.posY)
    gl.uniform1f(rd.u.scale, 1 / camera.scale)
    gl.uniform1f(rd.u.aspect,  canvasSize[1] / canvasSize[0])

    if(rd.changed.length != 0) {
        const dv = rd.dataView

        var coordsCount = 0
        var done = true
        for(let i = 0; i < texturesC; i++) {
            done = done & rd.images[i].done
            if(!rd.images[i].ok) continue
            const bg = bkg.backgrounds[i]

            const x = bkg.backgroundStart[0] + bg[0] * bkg.backgroundSize
            const y = bkg.backgroundStart[1] + bg[1] * bkg.backgroundSize
            dv.setFloat32(coordsCount * 12    , x, true)
            dv.setFloat32(coordsCount * 12 + 4, y, true)
            dv.setUint32 (coordsCount * 12 + 8, i, true)
            coordsCount++
        }

        if(done && !rd.mimpaps) {
            rd.mimpaps = true
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, rd.bgTextures)
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR)
            gl.generateMipmap(gl.TEXTURE_2D_ARRAY)
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, rd.buf)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, dv, 0, coordsCount * 12)

        rd.curCount = coordsCount
        rd.changed.length = 0
    }

    gl.bindVertexArray(rd.vao)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, rd.curCount)
}
