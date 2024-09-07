import { promises as fs } from 'node:fs'
import { createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { backgrounds } from '../data-raw/backgrounds/backgrounds.js'

const srcDir = join(import.meta.dirname, '../data-processed/backgrounds')
const dstFilename = join(import.meta.dirname, '../data-processed/backgrounds.pak')


const filenames = await fs.readdir(srcDir)

const filesP = []
for(let i = 0; i < filenames.length; i++) {
    filesP[i] = fs.readFile(join(srcDir, filenames[i]))
}

const header = []

function writeUint(v) {
    var it = v
    do {
        var div = it >> 7;
        var rem = it & ((1 << 7) - 1)
        header.push(rem | (div == 0 ? 1 << 7 : 0))
        it = div;
    } while(it != 0)
}
function writeString(v) {
    const buffer = Buffer.from(v, 'utf8')
    for(var i = 0; i < buffer.length; i++) if(buffer.readInt8(i) < 0) {
        throw new Exception(v)
    }

    if(buffer.length == 0) header.push(1 << 7)
    else {
        if(buffer.length == 1 && buffer.readUint8(0) == (1 << 7)) throw new Exception()
        for(let i = 0; i < buffer.length-1; i++) {
            header.push(buffer[i])
        }
        header.push(buffer[buffer.length - 1] | (1 << 7))
    }
}

writeUint(filenames.length)

const files = await Promise.all(filesP)

const nameRegex = /^(.+)_(.+)\.png$/

for(let i = 0; i < filenames.length; i++) {
    writeUint(files[i].length)
    const groups = filenames[i].match(nameRegex)
    const x = groups[1]
    const y = groups[2]
    let texI = 0
    while(true) {
        const coord = backgrounds[texI]
        if(coord[0] == x && coord[1] == y) break
        texI++
    }
    writeUint(texI)
}

const dst = createWriteStream(dstFilename)
const hLen = Buffer.alloc(4)
hLen.writeUint32LE(header.length)
dst.write(hLen)
dst.write(Buffer.from(header))

for(let i = 0; i < files.length; i++) {
    dst.write(files[i])
}

dst.end(async() => {
    console.log('Done!')
})
