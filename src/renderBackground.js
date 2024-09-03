import * as bkg from '$/backgrounds.js'
import { loadShader, checkProg } from './render_util.js'

const actualResolution = bkg.backgroundResolution * 0.25 // downscaled by script
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
function convToRGB656(gl, inputC) {
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

function setupImages(images, context) {
    for(let i = 0; i < bkg.backgrounds.length; i++) {
        const b = bkg.backgrounds[i]

        const imgData = { ok: false, done: false }
        images[i] = imgData

        const img = new Image()
        imgData.img = img

        img.src = '/data/backgrounds/' + b[0] + '_' + b[1] + '.png'
        img.addEventListener('error', _ => {
            // note: don't redender just because a texture errored.
            // Technically can be the last texture, so this will make
            // mimpaps not appear. But only until the user moves the screen
            // or something else triggers a rerender, so shouldn't be a big deal
            context.backgrounds.changed.push(i)
            imgData.done = true
        })
        img.addEventListener('load', _ => {
            const gl = context.gl
            const renderData = context.backgrounds

            gl.bindTexture(gl.TEXTURE_2D_ARRAY, renderData.bgTextures)
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

    if(__backgrounds_setup_images) setupImages(images, context)

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
    const c = bkg.backgroundColor
    const inputData = new Uint8Array(3)
    inputData[0] = parseInt(c.slice(0, 2), 16)
    inputData[1] = parseInt(c.slice(2, 4), 16)
    inputData[2] = parseInt(c.slice(4, 6), 16)
    const res = convToRGB656(gl, inputData)
    gl.clearColor(res[0] / 255, res[1] / 255, res[2] / 255, 1)

    renderData.ok = true
}

export function render(context) {
    const { gl, camera } = context
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
