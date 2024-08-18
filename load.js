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

class Src {
    constructor(reader) {
        this.reader = reader
        this.value = new Uint8Array(0)
        this.i = 0
    }

    async peek() {
        while(this.value && this.i >= this.value.length) {
            await this._read()
        }
        if(!this.value) return null
        return this.value[this.i];
    }

    async pop() {
        const cur = await this.peek()
        this.skip()
        return cur
    }

    skip() {
        this.i++
    }

    async _read() {
        const { done, value } = await this.reader.read()
        this.i -= this.value.length
        if(done) this.value = null
        else this.value = value
    }
}

var scenes

var objectsLoaded = (async() => {
    const response = await fetch('./data/objects.bp')
    const reader = response.body.getReader()
    scenes = await parseAny(new Src(reader))
    wereObjectsLoaded = true
})()

async function parseCompressedInt(src) {
    var res = 0
    var i = 0
    do {
        var cur = await src.pop()
        res = res | ((cur & 0b0111_1111) << (i * 7))
        i++
    } while((cur & 0b1000_0000) == 0)
    return res
}

const bytes4 = new ArrayBuffer(4)
const bytes4view = new DataView(bytes4)
async function parseFloat(src) {
    if(await src.peek() === 0b1111_1111) {
        src.skip()
        return 0
    }
    for(var i = 3; i > -1; i--) bytes4view.setUint8(i, await src.pop())
    return bytes4view.getFloat32(0, true)
}
async function parseVector2(src) {
    if(await src.peek() === 0b0111_1111) {
        src.skip()
        return [0, 0]
    }
    const x = await parseFloat(src)
    const y = await parseFloat(src)
    return [x, y]
}

async function parseString(src) {
    var res = ''
    if(await src.peek() == 0b1000_0000) return res
    do {
        var cur = await src.pop()
        res += String.fromCharCode(cur & 0b0111_1111)
    } while((cur & 0b1000_0000) == 0)
    return res
}

const primParsers = {
    ["GameManager+None"]: () => { throw "None is not parsable" },
    ["System.Boolean"]: async(src) => await src.pop() != 0,
    ["System.Int32"]: parseCompressedInt,
    ["System.Single"]: parseFloat,
    ["System.String"]: parseString,
    ["GameManager+Reference"]: parseCompressedInt,
    ["GameManager+Sprite"]: parseCompressedInt,
    ["UnityEngine.Vector2"]: parseVector2,
    ["GameManager+Any"]: parseAny,
}

async function parsePrimitive(schemaI, src) {
    return await primParsers[schemas[schemaI].name](src)
}

async function parseAny(src) {
    var schemaI = await parseCompressedInt(src)
    var schema = schemas[schemaI]
    return await parseBySchema(schemaI, src)
}

async function parseBySchema(schemaI, src) {
    const schema = schemas[schemaI]
    const type = schema.type
    if(type === 0) {
        return await parsePrimitive(schemaI, src)
    }
    else if(type === 1) {
        return await parseRecord(schemaI, src)
    }
    else if(type === 2) {
        return await parseArray(schemaI, src)
    }
    else throw ("No type " + type)
}

async function parseRecord(schemaI, src) {
    const schema = schemas[schemaI]

    const names = schema.members
    const types = schema.membersT

    const res = {}
    for(var i = 0; i < names.length; i++) {
        res[names[i]] = await parseBySchema(types[i], src)
    }
    if(schema.base != null) {
        res._base = await parseBySchema(schema.base, src)
    }
    res._schema = schemaI

    return res
}

async function parseArray(schemaI, src) {
    const schema = schemas[schemaI]
    const len = await parseCompressedInt(src)
    const res = Array(len)
    for(var i = 0; i < len; i++) {
        res[i] = await parseBySchema(schema.elementT, src)
    }
    res._schema = schemaI
    return res
}
