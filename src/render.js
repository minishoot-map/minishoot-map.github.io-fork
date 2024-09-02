import * as canvasDisplay from './canvas.js'
import * as backgroundsDisplay from './renderBackground.js'
import * as collidersDisplay from './renderColliders.js'
import * as circularDisplay from './renderCircularColliders.js'
import * as markersDisplay from './renderMarkers.js'
import ParserWorker from './worker.js?worker'

var scenes, objects
var resolveObjectsP
const objectsP = new Promise((s, j) => {
    resolveObjectsP = s
})

var resolveCollidersP
const collidersP = new Promise((s, j) => {
    resolveCollidersP = s
})

var resolveMarkersDataP
const markersP = new Promise((s, j) => {
    resolveMarkersDataP = s
})

if(__worker) {
    const worker = new ParserWorker()
    worker.onmessage = (e) => {
        console.log('received from worker', e.data.type)
        if(e.data.type === 'colliders-done') {
            const it = {
                verts: e.data.verts,
                indices: e.data.indices,
                polyDrawData: e.data.polyDrawData,
                circularData: e.data.circularData,
                circularDrawData: e.data.circularDrawData,
            }
            resolveCollidersP(it)
        }
        else if(e.data.type == 'markers-done') {
            const it = { markers: e.data.markers, markersData: e.data.markersData, count: e.data.count }
            resolveMarkersDataP(it)
        }
    }
    worker.onerror = (e) => {
        console.error('Error with webworker')
    }
}

const canvas = document.getElementById('glCanvas')
const gl = canvas.getContext('webgl2', { alpha: false })

if (!gl) { throw 'WebGL 2 is not supported.' }

// Note: this is not correct alpha blending, works only if background is already fully transparent!
// 1. Source alpha is multiplied by itself so overall transparency decreases when drawing transparent things
// 2. Disregards destination alpha (dst color should be multiplied by it).
// This all doesn't matter when background starts as fully opaque and alpha is disregarded at the end.
gl.enable(gl.BLEND)
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

function render(context) {
    if(window.__stop) return

    if(!canvasDisplay.resize(context)) return

    const b = context.cameraBuf
    const aspect = context.canvasSize[1] / context.canvasSize[0]
    const scale = 1 / context.camera.scale
    b[0] = -context.camera.posX * (scale * aspect)
    b[1] = -context.camera.posY * scale
    b[2] = scale * aspect
    b[3] = scale
    gl.bindBuffer(gl.UNIFORM_BUFFER, context.cameraUbo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, b)

    backgroundsDisplay.render(context)
    if(__render_colliders) collidersDisplay.render(context)
    if(__render_circular) circularDisplay.render(context)
    if(__render_markers) markersDisplay.render(context)
}

function requestRender(priority/* 0 - immediate, 1 - animation, 2 - idle */) {
    const rr = this.renderRequest
    if(rr != null) {
        if(rr.priority <= priority) return
        rr.cancel()
    }

    if(priority == 0) {
        this.renderRequest = null
        render(this)
    }
    else if(priority == 1) {
        this.renderRequest = {
            priority: 1,
            cancel() { cancelAnimationFrame(this.id) },
            id: requestAnimationFrame(() => {
                this.renderRequest = null
                render(this)
            })
        }
    }
    else {
        this.renderRequest = {
            priority: 2,
            cancel() { cancelIdleCallback(this.id) },
            id: requestIdleCallback(() => {
                this.renderRequest = null
                render(this)
            })
        }
    }
}

const context = {
    canvas, gl,
    renderRequest: null,
    requestRender,
    camera: { posX: 0, posY: 0, scale: 1000 },
    canvasSize: [],
}

canvasDisplay.setup(context)
backgroundsDisplay.setup(context)
if(__setup_markers) markersDisplay.setup(gl, context, markersP)
if(__setup_colliders) collidersDisplay.setup(gl, context, collidersP)
if(__setup_circular) circularDisplay.setup(gl, context, collidersP)

/* prep Camera UBO */ {
    /*
layout(std140) uniform Camera {
    vec2 add;
    vec2 multiply;
} cam;
    */

    const ubo = gl.createBuffer()
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, 16, gl.STATIC_DRAW)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo)

    context.cameraUbo = ubo
    context.cameraBuf = new Float32Array(4)
}
