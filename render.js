const canvas = document.getElementById('glCanvas')
const gl = canvas.getContext('webgl2')

if (!gl) {
    throw 'WebGL 2 is not supported.'
}

// Vertex shader program
const vsSource = `#version 300 es
precision highp float;

uniform uint texture_size;

in vec2 position;
in float scale;
in uvec2 texture_data;

out vec2 texture_coord;

const vec2 positions[4] = vec2[4](
    vec2(-1.0, -1.0),
    vec2(1.0, -1.0),
    vec2(-1.0, 1.0),
    vec2(1.0, 1.0)
);

void main(void) {
    int tw = int(texture_size & 65535u);
    int th = int(texture_size >> 16u);
    vec2 t_fac = vec2(tw, th);

    int x = int(texture_data.x & 65535u);
    int y = int(texture_data.x >> 16u);
    int w = int(texture_data.y & 65535u);
    int h = int(texture_data.y >> 16u);

    int m = max(w, h);
    vec2 size = vec2(w, h) * scale / float(m);

    gl_Position = vec4(position + positions[gl_VertexID] * size, 1, 1);

    vec2 tex = mix(vec2(x, y + h), vec2(x + w, y), vec2(gl_VertexID & 1, gl_VertexID >> 1));
    tex -= 1.0;
    tex /= t_fac;

    texture_coord = tex;
}
`

// Fragment shader program
const fsSource = `#version 300 es
precision highp float;

uniform sampler2D uSampler;
in vec2 texture_coord;

out vec4 color;

void main(void) {
    color = texture(uSampler, texture_coord);
}
`

// Compile shader program
function loadShader(type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`An error occurred compiling the ${type == gl.VERTEX_SHADER ? 'v' : 'f'} shader: ${gl.getShaderInfoLog(shader)}`)
        gl.deleteShader(shader)
        return null
    }
    return shader
}

const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource)
const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource)

const shaderProgram = gl.createProgram()
gl.attachShader(shaderProgram, vertexShader)
gl.attachShader(shaderProgram, fragmentShader)
gl.linkProgram(shaderProgram)

if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram))
}

gl.useProgram(shaderProgram)

const attrs = {
    position: gl.getAttribLocation(shaderProgram, 'position'),
    scale: gl.getAttribLocation(shaderProgram, 'scale'),
    texture_data: gl.getAttribLocation(shaderProgram, 'texture_data'),
}

const unifs = {
    uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
    texture_size: gl.getUniformLocation(shaderProgram, 'texture_size')
}

// Set up the buffers
const positionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
const vertexData = new ArrayBuffer(20 * 5)
const v = new DataView(vertexData)

var count = 0
for(const name in markerData) {
    if(count >= 5) break
    const m = markerData[name]
    console.log(name)

    v.setFloat32(0 + count*20, (m[0] + m[2]*0.5) / 2048 * 2 - 1, true)
    v.setFloat32(4 + count*20, 1 - (m[1] + m[3]*0.5) / 4096 * 2, true)
    console.log(v.getFloat32(0 + count*20, true), v.getFloat32(4 + count*20, true))
    v.setFloat32(8 + count*20, m[2] > m[3] ? m[2] / 2048 / 2 : m[3] / 4096 / 2, true)
    v.setUint16(12 + count*20, m[0], true)
    v.setUint16(14 + count*20, m[1], true)
    v.setUint16(16 + count*20, m[2], true)
    v.setUint16(18 + count*20, m[3], true)

    count++
}
gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW)


// ext.vertexAttribDivisorANGLE(loc, 1)
/* const m = markerData['Overworld 410 Miniboss Busher T1 S3.png']

const textureCoordBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer)
const textureCoordinates = [
    m[0] / 2048, m[1] / 4096,
    m[0] / 2048, m[3] / 4096,
    m[2] / 2048, m[1] / 4096,
    m[2] / 2048, m[3] / 4096,
]
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);*/

// Load and set up the texture
const texture = gl.createTexture()
gl.bindTexture(gl.TEXTURE_2D, texture)

// Load image
const image = new Image()
image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.generateMipmap(gl.TEXTURE_2D)

    render()
}
image.src = './data/markers.png'; // Replace with the texture URL

// uniform uint texture_size

// Bind position buffer
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
console.log(attrs)

gl.vertexAttribPointer(attrs.position, 2, gl.FLOAT, false, 20, 0)
gl.enableVertexAttribArray(attrs.position)
gl.vertexAttribDivisor(attrs.position, 1)

 gl.vertexAttribPointer(attrs.scale, 1, gl.FLOAT, false, 20, 8)
 gl.enableVertexAttribArray(attrs.scale)
 gl.vertexAttribDivisor(attrs.scale, 1)

gl.vertexAttribIPointer(attrs.texture_data, 2, gl.UNSIGNED_INT, 20, 12)
gl.enableVertexAttribArray(attrs.texture_data)
gl.vertexAttribDivisor(attrs.texture_data, 1)


// Render
function render() {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(unifs.uSampler, 0)
    gl.uniform1ui(unifs.texture_size, image.width | (image.height << 16))

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 5)
}

