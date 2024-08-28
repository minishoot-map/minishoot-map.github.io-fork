import * as load from './load.js'
import * as canvasDisplay from './canvas.js'
import * as backgroundsDisplay from './renderBackground.js'
import { getAsSchema, parsedSchema } from './schema.js'
import * as polygons from './renderColliders.js'

const objectsP = fetch('./data/objects.bp').then(it => it.arrayBuffer()).then(it => new Uint8Array(it))
const polygonsP = fetch('./data/polygons.bp').then(it => it.arrayBuffer()).then(it => new Uint8Array(it))

const canvas = document.getElementById('glCanvas')
const gl = canvas.getContext('webgl2', { alpha: false })

if (!gl) { throw 'WebGL 2 is not supported.' }

function multiply(n, m) {
    var a = m[0] * n[0] + m[1] * n[3]
    var b = m[0] * n[1] + m[1] * n[4]
    var c = m[0] * n[2] + m[1] * n[5] + m[2]
    var d = m[3] * n[0] + m[4] * n[3]
    var e = m[3] * n[1] + m[4] * n[4]
    var f = m[3] * n[2] + m[4] * n[5] + m[5]

    n[0] = a
    n[1] = b
    n[2] = c
    n[3] = d
    n[4] = e
    n[5] = f

    return n
}

var deg2rad = (Math.PI / 180)
// Note: rotation is counter-clockwise in both Unity and css (right?)
function construct(t) {
    var sin = Math.sin(t.rotation * deg2rad)
    var cos = Math.cos(t.rotation * deg2rad)
    var matrix = new Float32Array(6)
    matrix[0] = cos * t.scale[0]
    matrix[1] = -sin * t.scale[1]
    matrix[2] = t.position[0]
    matrix[3] = sin * t.scale[0]
    matrix[4] = cos * t.scale[1]
    matrix[5] = t.position[1]
    return matrix
}


const objects = []
function prepareObjects(parentMatrix, parentI, obj) {
    var transform
    for(let i = 0; i < obj.components.length && transform == null; i++) {
        transform = getAsSchema(obj.components[i], parsedSchema.typeSchemaI.Transform)
    }
    if(transform == null) throw "Unreachable"
    obj.transform = transform
    obj.parentI = parentI

    const index = objects.length
    objects.push(obj)

    var matrix = construct(transform)
    if(parentMatrix) multiply(matrix, parentMatrix)
    obj.matrix = matrix
    obj.pos = [matrix[2], matrix[5]]

    obj.children.forEach(c => prepareObjects(matrix, index, c))
}

objectsP.then(objectsA => {
    const scenes = load.parse(parsedSchema, objectsA)

    for(let i = 0; i < scenes.length; i++) {
        const roots = scenes[i].roots
        for(let j = 0; j < roots.length; j++) {
            prepareObjects(null, -1 - i, roots[j])
        }
    }

    polygons.setup(gl, context, objects, polygonsP)
})


var renderScheduled = false
function scheduleRender() {
    if(renderScheduled) return
    renderScheduled = true
    requestAnimationFrame(() => {
        if(renderScheduled) this.render()
    })
}


// Note: this is not correct alpha blending, works only if background is already fully transparent!
// 1. Source alpha is multiplied by itself so overall transparency decreases when drawing transparent things
// 2. Disregards destination alpha (dst color should be multiplied by it).
// This all doesn't matter when background starts as fully opaque and alpha is disregarded at the end.
gl.enable(gl.BLEND)
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

function render() {
    if(window.__stop) return
    renderScheduled = false

    if(!canvasDisplay.resize(this)) return

    backgroundsDisplay.render(this)
    // polygons.render(this)

    // gl.bindVertexArray(renderData.centerVao)
    // gl.uniformMatrix2x3fv(transformU, false, new Float32Array([100, 0, 0, 0, 100, 0]))
    // gl.drawArrays(gl.TRIANGLES, 0, 3)
}


const context = {
    canvas, gl,
    scheduleRender,
    render,
    camera: { posX: 0, posY: 0, scale: 1000 },
    canvasSize: [],
}

canvasDisplay.setup(context)
backgroundsDisplay.setup(context)

/*


    const centerVao = gl.createVertexArray()
    gl.bindVertexArray(centerVao)

const centerB = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, centerB)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 1, 1, -1]), gl.STATIC_DRAW)
gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
gl.enableVertexAttribArray(coordIn)

context.polygons.centerVao = centerVao
*/
