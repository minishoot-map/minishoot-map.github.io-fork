import * as canvasDisplay from './canvas.js'
import * as backgroundsDisplay from './renderBackground.js'
import * as collidersDisplay from './renderColliders.js'
import ParserWorker from './worker.js?worker'

var scenes, objects
var resolveObjectsP
const objectsP = new Promise((s, j) => {
    resolveObjectsP = s
})

var collidersData
var resolveCollidersP
const collidersP = new Promise((s, j) => {
    resolveCollidersP = s
})

const worker = new ParserWorker()
worker.onmessage = (e) => {
    console.log('received from worker', e.data.type)
    if(e.data.type === 'colliders-done') {
        collidersData = { verts: e.data.verts, indices: e.data.indices, polyDrawData: e.data.polyDrawData }
        resolveCollidersP()
    }
}
worker.onerror = (e) => {
    console.error('Error with webworker')
}

const canvas = document.getElementById('glCanvas')
const gl = canvas.getContext('webgl2', { alpha: false })

if (!gl) { throw 'WebGL 2 is not supported.' }

collidersP.then(() => {
    collidersDisplay.setup(gl, context, collidersData)
})

// Note: this is not correct alpha blending, works only if background is already fully transparent!
// 1. Source alpha is multiplied by itself so overall transparency decreases when drawing transparent things
// 2. Disregards destination alpha (dst color should be multiplied by it).
// This all doesn't matter when background starts as fully opaque and alpha is disregarded at the end.
gl.enable(gl.BLEND)
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

function render(context) {
    if(window.__stop) return

    if(!canvasDisplay.resize(context)) return

    backgroundsDisplay.render(context)
    collidersDisplay.render(context)
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
