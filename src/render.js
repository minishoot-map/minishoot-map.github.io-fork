import * as canvasDisplay from './canvas.js'
import * as backgroundsDisplay from './renderBackground.js'
import * as collidersDisplay from './renderColliders.js'
import * as circularDisplay from './renderCircularColliders.js'
import * as markersDisplay from './renderMarkers.js'
import * as specMarkerDisplay from './renderSpecialMarker.js'
import * as sideMenu from './sideMenu.jsx'
import { xpForCrystalSize } from '$/meta.json'

var resolveCollidersP
const collidersP = new Promise((s, j) => {
    resolveCollidersP = s
})

var resolveMarkersDataP
const markersP = new Promise((s, j) => {
    resolveMarkersDataP = s
})

var startt, endd

var worker
if(__worker) {
    worker = window.worker
    worker.onmessage = (e) => {
        const d = e.data
        console.log('received from worker', d.type)

        if(d.type === 'click') {
            endd = performance.now()
            console.log('in', endd - startt)
            console.log(JSON.parse(JSON.stringify(d)))
            sideMenu.setCurrentObject({ first: d.first, nearby: d.nearby })
        }
        else if(d.type === 'getInfo') {
            console.log(JSON.parse(JSON.stringify(d)))
            sideMenu.setCurrentObject({ first: d.object })
        }
        else if(d.type === 'colliders-done') {
            const it = {
                verts: d.verts,
                indices: d.indices,
                polyDrawData: d.polyDrawData,
                circularData: d.circularData,
                circularDrawData: d.circularDrawData,
            }
            resolveCollidersP(it)
        }
        else if(d.type == 'markers-done') {
            const it = { markers: d.markers, markersData: d.markersData, count: d.count }
            resolveMarkersDataP(it)
        }
    }
    worker.postMessage({ type: 'ready' })
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
    specMarkerDisplay.render(context)
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

const filters = [
    [
        '$Object', 'Show markers', true, 'filters',
        [
            ['name', 'Filter by name containing', false, 'name'],
            [
                'Enemy', 'Show enemies', true, 'filters',
                [
                    ['size', 'Filter by size', false, 'number', 3],
                    ['tier', 'Filter by tier', false, 'number', 1],
                ],
            ],
            [
                'Jar', 'Show jars', true, 'filters',
                [
                    ['size', 'Filter by size', false, 'number', true],
                    [
                        'drop', 'Filter by drop type', false, 'enum',
                        [
                            [0, 'nothing [0]', false],
                            [1, 'hp [1]', false],
                            [2, 'random [2]', false],
                            [3, 'big crystal [3]', true],
                            [4, 'energy [4]', false],
                            [5, 'full energy [5]', false],
                            [6, '65 big crystals [6]', true],
                        ],
                    ]
                ],
            ],
            [
                'CrystalDestroyable', 'Show crystals', true, 'filters',
                [
                    ['dropXp', 'Filter by xp drop', false, 'boolean', [true, true]],
                    [
                        'size', 'Filter by size', false, 'enum',
                        (() => {
                            const result = []
                            for(let i = 0; i < xpForCrystalSize.length; i++) {
                                result.push([xpForCrystalSize[i], '' + i + ' [' + xpForCrystalSize[i] + ' xp]', true])
                            }
                            return result
                        })(),
                    ],
                ],
            ],
            ['ScarabPickup', 'Show scarabs', true, 'filters', []],
        ],
    ],
    [
        '$Collider', 'Show colliders', true, 'filters',
        [
            [
                'layer', 'Filter by layer', true, 'enum',
                [
                    [0, '0', true],
                    [1, '1', true],
                    [2, '2', true],
                    [3, '3', true],
                    [4, 'water [4]', true],
                    [5, '5', true],
                    [6, 'deep water [6]', true],
                    [7, '7', true],
                    [8, '8', true],
                    [9, '9', true],
                    [10, '10', true],
                    [11, '11', true],
                    [12, 'enemy [12]', true],
                    [13, 'enemy [13]', true],
                    [14, 'wall [14]', true],
                    [15, '15', true],
                    [16, 'hole [16]', true],
                    [17, 'trigger? [17]', true],
                    [18, '18', true],
                    [19, '19', true],
                    [20, '20', true],
                    [21, '21', true],
                    [22, '22', true],
                    [23, 'static [23]', true],
                    [24, '24', true],
                    [25, 'bridge [25]', true],
                    [26, 'enemy [26]', true],
                    [27, '27', true],
                    [28, '28', true],
                    [29, '29', true],
                    [30, '30', true],
                    [31, '31', true],
                ],
            ]
        ],
    ],
    [
        '$Background', 'Show backgrounds', true, 'filters',
        []
    ]
]

const context = {
    canvas, gl,
    renderRequest: null,
    requestRender,
    camera: { posX: 0, posY: 0, scale: 1000 },
    canvasSize: [],
    filters,
    filtersUpdated() {
        sideMenu.filtersUpdated()
        console.log('filters changed')
    },
    onClick(x, y) {
        startt = performance.now()
        console.log('sending')
        worker?.postMessage({ type: 'click', x, y })
    },
    viewObject(index) {
        if(index == null) return
        worker?.postMessage({ type: 'getInfo', index })
    }
}

try { sideMenu.setup(context) }
catch(e) { console.error(e) }

try { canvasDisplay.setup(context) }
catch(e) { console.error(e) }

try { backgroundsDisplay.setup(context) }
catch(e) { console.error(e) }

try { if(__setup_markers) markersDisplay.setup(gl, context, markersP) }
catch(e) { console.error(e) }

try { if(__setup_markers) specMarkerDisplay.setup(context) }
catch(e) { console.error(e) }

try { if(__setup_colliders) collidersDisplay.setup(gl, context, collidersP) }
catch(e) { console.error(e) }

try { if(__setup_circular) circularDisplay.setup(gl, context, collidersP) }
catch(e) { console.error(e) }


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
