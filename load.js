const typeSchemaI = {}
const shortenName = /[.+](.+)$/

;(() => {
    for(var i = 0; i < schemas.length; i++) {
        const s = schemas[i]
        s.type = s[0]
        s.name = s[1]
        for(let key in s[2]) s[key] = s[2][key]
        if(s.type === 1) {
            s.members ??= []
            s.membersT ??= []
        }

        const match = shortenName.exec(s.name)
        if(match && !typeSchemaI.hasOwnProperty(match[1])) {
            typeSchemaI[match[1]] = i
        }
        typeSchemaI[s.name] = i
    }
})()

var src
function peek() {
    if(src.i < src.value.length) return src.value[src.i]
    return src.value[i]
}
function pop() {
    var cur = peek(src)
    src.i++
    return cur
}
function skip() {
    src.i++
}

var scenes

var objectsLoaded = (async() => {
    const response = await fetch('./data/objects.bp')
    const value = new Uint8Array(await response.arrayBuffer())
    console.log('started')
    const start = performance.now()
    src = { i: 0, value }
    scenes = parseAny()
    const end = performance.now()
    console.log('done in ' + (end - start) + 'ms')
    wereObjectsLoaded = true
})()

function parseCompressedInt() {
    var res = 0
    var i = 0
    do {
        var cur = pop()
        res = res | ((cur & 0b0111_1111) << (i * 7))
        i++
    } while((cur & 0b1000_0000) == 0)
    return res
}

const bytes4 = new ArrayBuffer(4)
const bytes4view = new DataView(bytes4)
function parseFloat() {
    if(peek() === 0b1111_1111) {
        skip()
        return 0
    }
    for(var i = 3; i > -1; i--) bytes4view.setUint8(i, pop())
    return bytes4view.getFloat32(0, true)
}
function parseVector2() {
    if(peek() === 0b0111_1111) {
        skip()
        return [0, 0]
    }
    const x = parseFloat()
    const y = parseFloat()
    return [x, y]
}

function parseString() {
    var res = ''
    if(peek() == 0b1000_0000) return res
    do {
        var cur = pop()
        res += String.fromCharCode(cur & 0b0111_1111)
    } while((cur & 0b1000_0000) == 0)
    return res
}

const primParsers = {
    ["GameManager+None"]: () => { throw "None is not parsable" },
    ["System.Boolean"]: () => pop() != 0,
    ["System.Int32"]: parseCompressedInt,
    ["System.Single"]: parseFloat,
    ["System.String"]: parseString,
    ["GameManager+Reference"]: parseCompressedInt,
    ["GameManager+Sprite"]: parseCompressedInt,
    ["UnityEngine.Vector2"]: parseVector2,
    ["GameManager+Any"]: parseAny,
}
const primIParsers = Array(10)
for(const key in primParsers) {
    primIParsers[typeSchemaI[key]] = primParsers[key]
}

function parsePrimitive(schemaI) {
    return primIParsers[schemaI]()
}

function parseAny() {
    var schemaI = parseCompressedInt()
    var schema = schemas[schemaI]
    return parseBySchema(schemaI)
}

function parseBySchema(schemaI) {
    const schema = schemas[schemaI]
    const type = schema.type
    if(type === 0) {
        return parsePrimitive(schemaI)
    }
    else if(type === 1) {
        return parseRecord(schemaI)
    }
    else if(type === 2) {
        return parseArray(schemaI)
    }
    else throw ("No type " + type)
}

function parseRecord(schemaI) {
    const schema = schemas[schemaI]

    const names = schema.members
    const types = schema.membersT

    const res = {}
    for(var i = 0; i < names.length; i++) {
        res[names[i]] = parseBySchema(types[i])
    }
    if(schema.base != null) {
        res._base = parseBySchema(schema.base)
    }
    res._schema = schemaI

    return res
}

function parseArray(schemaI) {
    const schema = schemas[schemaI]
    const len = parseCompressedInt()
    const res = Array(len)
    for(var i = 0; i < len; i++) {
        res[i] = parseBySchema(schema.elementT)
    }
    res._schema = schemaI
    return res
}
