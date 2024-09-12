import { loadShader, checkProg } from './render_util.js'

const vsSource = `#version 300 es
precision highp float;

layout(std140) uniform Camera {
    vec2 add;
    vec2 multiply;
} cam;

uniform float markerSize;
uniform int drawType;

in vec2 coord;

out vec2 uv;
flat out int type;

const vec2 coords[4] = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));
const float intToFloat = ${1 / 65535};

void main(void) {
    vec2 offset = coords[gl_VertexID] * markerSize * (1.0 + float(drawType & 1) * 0.4);

    vec2 pos = (coord + offset) * cam.multiply + cam.add;
    gl_Position = vec4(pos, 1.0, 1.0);
    uv = coords[gl_VertexID];

    type = drawType;
}
`
const fsSource = `#version 300 es
precision mediump float;

uniform sampler2D tex;
in vec2 uv;
flat in int type;

out vec4 color;

void main(void) {
    vec4 col = vec4(0.5, 0.5, 0.9, 0);

    float sd = dot(uv, uv);
    float edgeWidth = fwidth(sd); ${''/* I hope square length is fine */}
    float alpha = smoothstep(1.0 - edgeWidth, 1.0 + edgeWidth, sd);
    col.a = 1.0 - alpha;

    if((type & 1) != 0) {
        col.rgb = vec3(1, 0, 0);
    }
    if(((type >> 1) & 1) != 0) {
        col.rgb = mix(col.rgb, vec3(1.0), 0.2);
    }

    color = col;
}
`
export function setup(context) {
    const renderData = {}
    context.specialMarker = renderData
    const { gl } = context

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource, 'special marker v')
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource, 'special marker f')

    const prog = gl.createProgram()
    renderData.prog = prog
    gl.attachShader(prog, vertexShader)
    gl.attachShader(prog, fragmentShader)
    gl.linkProgram(prog)

    if(!checkProg(gl, prog)) return

    gl.useProgram(prog)

    gl.uniformBlockBinding(prog, gl.getUniformBlockIndex(prog, "Camera"), 0)

    const markerSize = gl.getUniformLocation(prog, 'markerSize')
    const drawType = gl.getUniformLocation(prog, 'drawType')
    renderData.u = { markerSize, drawType }

    const dataB = gl.createBuffer()
    renderData.dataB = dataB
    renderData.data = new ArrayBuffer(8)
    renderData.dataView = new DataView(renderData.data)

    const vao = gl.createVertexArray()
    renderData.vao = vao
    gl.bindVertexArray(vao)

    gl.bindBuffer(gl.ARRAY_BUFFER, dataB)
    gl.bufferData(gl.ARRAY_BUFFER, 16, gl.DYNAMIC_DRAW)

    const coordIn = gl.getAttribLocation(prog, 'coord')
    if(coordIn != -1) {
        gl.vertexAttribPointer(coordIn, 2, gl.FLOAT, false, 8, 0)
        gl.enableVertexAttribArray(coordIn)
        gl.vertexAttribDivisor(coordIn, 1)
    }

    gl.bindVertexArray(null)

    renderData.ok = true
    if(context.sideMenu?.currentObject?.first) {
        context.requestRender(1)
    }
}

export function render(context) {
    const rd = context.specialMarker
    if(rd?.ok !== true) return
    const { gl, camera } = context

    const first = context.sideMenu?.currentObject?.first
    if(!first) return
    else if(first.markerI != null && context.markers?.ok) return // drawn as regular marker

    rd.dataView.setFloat32(0, first.pos[0], true)
    rd.dataView.setFloat32(4, first.pos[1], true)
    gl.bindBuffer(gl.ARRAY_BUFFER, rd.dataB)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, rd.data)

    gl.useProgram(rd.prog)
    gl.uniform1f(rd.u.markerSize, Math.min(camera.scale, 200) * 0.03)

    gl.bindVertexArray(rd.vao)
    gl.uniform1i(rd.u.drawType, 1)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.uniform1i(rd.u.drawType, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}
