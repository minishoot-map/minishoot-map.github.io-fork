import * as bkg from '$/backgrounds.js'
import * as bkg2 from '$/backgrounds.json'
import { loadShader, checkProg } from './render_util.js'

const actualResolution = bkg2.backgroundResolution
const texturesC = bkg.backgrounds.length

// THIS LANGUAGE... IMAGINE TOT BEING ABLE TO PRINT A NUMBER WITH DECIMAL POINT
// NO, toFixed() ALSO ROUNDS THE NUMBER OR ADDS A MILLION ZEROS
// NO, toString() PRINTS INTEGERS WITHOUT DECIMAL POINT
const bgSize = bkg.backgroundSize + '.0'

const vsSource = `#version 300 es
precision highp float;

layout(std140) uniform Camera {
    vec2 add;
    vec2 multiply;
} cam;

in vec2 coord;
in int index;

const vec2 coords[4] = vec2[4](
    vec2(-0.5, -0.5),
    vec2(0.5, -0.5),
    vec2(-0.5, 0.5),
    vec2(0.5, 0.5)
);

out vec2 uv;
flat out int tIndex;

void main(void) {
    vec2 off = coords[gl_VertexID];
    vec2 pos = (coord + off * ${bgSize}) * cam.multiply + cam.add;
    gl_Position = vec4(pos, 1.0, 1.0);
    uv = vec2(off.x + 0.5, 0.5 - off.y);
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

// Need to quantize clear color to the same precision as background texture
// to remove seams. Result is hardware-dependent! ([0, 12, 16] and [8, 12, 25])
// RGB need to be unsigned bytes. Floats do not work
function convToRGB565(gl, inputC) {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGB565, 1, 1)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGB, gl.UNSIGNED_BYTE, inputC)

    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)

    var res
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
        res = new Uint8Array(4)
        // Why is it RGBA? RGB doesn't work... Also floats do not work.
        // Also why do I need a framebuffer to read pixel data from a texture?
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, res)
    }
    else {
        res = inputC
        console.error('Framebuffer is not complete')
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)

    gl.deleteFramebuffer(fb)
    gl.deleteTexture(tex)

    return res
}

export function updateBackground(context, index, data) {
    const rd = context.backgrounds
    if(rd?.loadImages !== true) return

    const imgData = rd.images[index]

    const blob = new Blob([data], { type: 'image/png' })
    const url = URL.createObjectURL(blob) // TODO: delete
    const img = new Image()
    img.src = url

    img.addEventListener('error', _ => {
        // note: don't redender just because a texture errored.
        // Technically can be the last texture, so this will make
        // mimpaps not appear. But only until the user moves the screen
        // or something else triggers a rerender, so shouldn't be a big deal
        context.backgrounds.changed.push(index)
        imgData.done = true
        console.log('err')
    })
    img.addEventListener('load', _ => {
        const gl = context.gl

        gl.bindTexture(gl.TEXTURE_2D_ARRAY, rd.bgTextures)
        gl.texSubImage3D(
            gl.TEXTURE_2D_ARRAY, 0,
            0, 0, index,
            actualResolution, actualResolution, 1,
            gl.RGB, gl.UNSIGNED_BYTE,
            img
        )

        rd.changed.push(index)
        imgData.ok = true
        imgData.done = true

        context.requestRender(2)
    })

}

export function setup(context) {
    const { gl } = context

    const renderData = { changed: [], curCount: 0 }
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

    gl.uniformBlockBinding(prog, gl.getUniformBlockIndex(prog, "Camera"), 0)

    const bgTextures = gl.createTexture()
    renderData.bgTextures = bgTextures

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, bgTextures)
    console.log(actualResolution, __backgrounds_mipmap_levels)
    gl.texStorage3D(
        gl.TEXTURE_2D_ARRAY, __backgrounds_mipmap_levels,
        gl.RGB565, actualResolution, actualResolution,
        texturesC
    )

    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST) // for now
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const images = Array(texturesC)
    renderData.images = images

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

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, bgTextures)
    const texturesU = gl.getUniformLocation(prog, 'textures')
    gl.uniform1i(texturesU, 0)

    // by the way, how is this color the correct one?
    // I palletized the images, hasn't it change?
    const c = bkg2.backgroundColor
    const inputData = new Uint8Array(3)
    inputData[0] = (c      ) & 0xff
    inputData[1] = (c >>  8) & 0xff
    inputData[2] = (c >> 16) & 0xff
    const res = convToRGB565(gl, inputData)
    gl.clearColor(res[0] / 255, res[1] / 255, res[2] / 255, 1)

    renderData.ok = true

    for(let i = 0; i < texturesC; i++) {
        images[i] = { ok: false, done: false }
    }

    renderData.loadImages = true
}

export function render(context) {
    const { gl } = context
    const rd = context.backgrounds
    if(rd?.ok !== true) {
        gl.clearColor(1, 1, 1, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return
    }

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(rd.prog)
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
