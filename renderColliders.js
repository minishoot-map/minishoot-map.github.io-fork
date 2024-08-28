import { loadShader, checkProg } from './render_util.js'
import { getAsSchema, parsedSchema } from './schema.js'
import markerData from './data-processed/markers.json'
import * as load from './load.js'

const vsSource = `#version 300 es
precision highp float;

uniform vec2 translate;
uniform float scale;
uniform float aspect;

in vec2 coord;

void main(void) {
    vec2 pos = (translate + coord) * scale;
    pos.x *= aspect;
    gl_Position = vec4(pos, 1.0, 1.0);
}
`
const colliderColors = {
    0 : "0a590360", // destroyable
    4 : "6a97dd20", // water
    6 : "35009920", // deep water
    12: "f9000060", // enemy
    13: "f9000060", // enemy
    14: "c14a0320", // wall
    16: "00000020", // hole
    17: "ff00ff40", // trigger?
    23: "11656360", // static
    25: "4f3c0140", // bridge
    26: "f9005060", // enemy (stationary)
    31: "11656360", // static
    fallback: "9400f920"
}
let colliderColorsS = 'const vec4 layerColors[32] = vec4[32]('
for(let i = 0; i < 32; i++) {
    const c = colliderColors[i] ?? colliderColors.fallback
    let r = parseInt(c.slice(0, 2), 16) / 255
    let g = parseInt(c.slice(2, 4), 16) / 255
    let b = parseInt(c.slice(4, 6), 16) / 255
    let a = parseInt(c.slice(6, 8), 16) / 255
    if(i != 0) colliderColorsS += ',\n'
    colliderColorsS += `vec4(${r}, ${g}, ${b}, ${a})`
}
colliderColorsS += ');'

const fsSource = `#version 300 es
precision highp float;

uniform int layer;

out vec4 color;

${colliderColorsS}

void main(void) {
    color = layerColors[layer];
}
`

export function setup(gl, context, objects, polygonsP) {
    const renderData = {}
    context.polygons = renderData

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource)
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource)

    const prog = gl.createProgram()
    gl.attachShader(prog, vertexShader, 'polygons v')
    gl.attachShader(prog, fragmentShader, 'polygons f')
    gl.linkProgram(prog)

    if(!checkProg(gl, prog)) return

    gl.useProgram(prog)

    const translate = gl.getUniformLocation(prog, 'translate')
    const scale = gl.getUniformLocation(prog, 'scale')
    const aspect = gl.getUniformLocation(prog, 'aspect')
    const layer = gl.getUniformLocation(prog, 'layer')

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    const vertexData = new ArrayBuffer(20 * 5)
    const v = new DataView(vertexData)

    var count = 0
    for(const name in markerData) {
        if(count >= 5) break
        const m = markerData[name]

        v.setFloat32(0 + count*20, (m[0] + m[2]*0.5) / 2048 * 2 - 1, true)
        v.setFloat32(4 + count*20, 1 - (m[1] + m[3]*0.5) / 4096 * 2, true)
        v.setFloat32(8 + count*20, m[2] > m[3] ? m[2] / 2048 / 2 : m[3] / 4096 / 2, true)
        v.setUint16(12 + count*20, m[0], true)
        v.setUint16(14 + count*20, m[1], true)
        v.setUint16(16 + count*20, m[2], true)
        v.setUint16(18 + count*20, m[3], true)

        count++
    }
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW)

    polygonsP.then((polygonsA) => {
        const polygons = load.parse(parsedSchema, polygonsA)
        prepareRenderData(context, objects, polygons)
    })

    renderData.u = { translate, scale, aspect, layer }
    renderData.prog = prog
}

function prepareRenderData(context, objects, polygons) {
    const renderData = context.polygons
    const gl = context.gl

    const taken = {}

    var totalPointsC = 0, totalIndicesC = 0
    const polyDrawDataByLayer = Array(32)
    for(let i = 0; i < objects.length; i++) {
        const obj = objects[i]
        const cs = obj.components
        let composite, tilemap
        for(let j = 0; j < cs.length && (composite == null || tilemap == null); j++) {
            if(composite == null) composite = getAsSchema(cs[j], parsedSchema.typeSchemaI['CompositeCollider2D'])
            if(tilemap == null) tilemap = getAsSchema(cs[j], parsedSchema.typeSchemaI['TilemapCollider2D'])
        }
        if(composite == null || tilemap == null) continue

        const polygon = polygons[composite.polygons]
        if(polygon.indices.length == 0) continue

        if(taken[composite.polygons] != null) {
            console.log('taken!', taken[polygon], obj)
            continue
        }
        taken[composite.polygons] = obj

        const data = [obj.matrix, polygon]

        var datas = polyDrawDataByLayer[obj.layer]
        if(datas == null) polyDrawDataByLayer[obj.layer] = [data]
        else datas.push(data)

        totalPointsC += polygon.points.length * 2
        totalIndicesC += polygon.indices.length
    }


    const verts = new Float32Array(totalPointsC)
    const indices = new Uint32Array(totalIndicesC)
    let vertI = 0, indexI = 0
    const polyDrawData = []
    for(let i = 0; i < polyDrawDataByLayer.length; i++) {
        const datas = polyDrawDataByLayer[i]
        if(datas == null) continue
        const startIndexI = indexI

        for(let j = 0; j < datas.length; j++) {
            const data = datas[j]
            const m = data[0]
            const poly = data[1]
            const startVertexI = vertI
            for(let k = 0; k < poly.points.length; k++) {
                const x = poly.points[k][0]
                const y = poly.points[k][1]
                verts[vertI*2    ] = x * m[0] + y * m[1] + m[2]
                verts[vertI*2 + 1] = x * m[3] + y * m[4] + m[5]
                vertI++
            }
            for(let k = 0; k < poly.indices.length; k++) {
                indices[indexI++] = startVertexI + poly.indices[k]
            }
        }

        polyDrawData.push({ startIndexI, length: indexI - startIndexI, layer: i })
    }

    const verticesB = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)

    const indicesB = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)


    const polygonsVao = gl.createVertexArray()
    gl.bindVertexArray(polygonsVao)

    gl.bindBuffer(gl.ARRAY_BUFFER, verticesB)
    const coordIn = gl.getAttribLocation(renderData.prog, 'coord')
    gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
    gl.enableVertexAttribArray(coordIn)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesB)

    renderData.vao = polygonsVao
    renderData.drawData = polyDrawData
    renderData.ok = true
    context.scheduleRender()
}

export function render(context) {
    const rd = context.polygons
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
        gl.drawElements(gl.TRIANGLES, it.length, gl.UNSIGNED_INT, it.startIndexI * 4)
    }
}
