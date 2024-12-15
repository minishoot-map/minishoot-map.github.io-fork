import sharp from 'sharp'
import * as fs from 'node:fs'
import { join } from 'node:path'
import * as B from '../data-raw/backgrounds/backgrounds.js'

const bgr = parseInt(B.backgroundColor.slice(0, 2), 16)
const bgg = parseInt(B.backgroundColor.slice(2, 4), 16)
const bgb = parseInt(B.backgroundColor.slice(4, 6), 16)
const bgInt = bgr | (bgg << 8) | (bgb << 16)

const srcPath = join(import.meta.dirname, '../data-raw/backgrounds')
const dstPath = join(import.meta.dirname, '../data-processed/backgrounds')
const dstInfo = join(import.meta.dirname, '../data-processed/backgrounds.json')

fs.mkdirSync(dstPath, { recursive: true })

const filenames = fs.readdirSync(srcPath)
const imagePixelsC = 512*512

var done = 0
function updateDone() {
    done++
    if(done % 10 === 0) console.log('done', done, 'of ~' + filenames.length)
}

function findChunk(buffer, name) {
    const nameInt = name.charCodeAt(0) | (name.charCodeAt(1) << 8) | (name.charCodeAt(2) << 16) | (name.charCodeAt(3) << 24)
    const nameUint = nameInt >>> 0

    var i = 8 // skip signature
    while(i < buffer.length) {
        const len = buffer.readUint32BE(i)
        const chunkName = buffer.readUint32LE(i + 4)
        if(chunkName == nameUint) return [len, i + 8]
        i += 4 + 4 + len + 4
    }
}

// https://web.archive.org/web/20150825201508/http://upokecenter.dreamhosters.com/articles/png-image-encoder-in-c/
const crcTable = new Uint32Array(256)
{
    for(let i = 0; i < crcTable.length; i++) {
        let c = i
        for(var j = 0; j < 8; j++) {
            if((c & 1) == 1) {
                c = 0xEDB88320 ^ ((c >> 1) & 0x7FFFFFFF)
            }
            else {
                c = ((c >> 1) & 0x7FFFFFFF)
            }
        }
        crcTable[i] = c
    }
}

function crc32(buf, begin, end, crc) {
    var c = ~crc
    for(var i = begin; i < end; i++) {
        c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8)
    }
    return ~c;
}

for(let i = 0; i < filenames.length; i++) {
    const fn = filenames[i]
    if(!fn.endsWith('.png')) {
        console.log('skipping', fn)
        continue
    }

    const dstFn = join(dstPath, fn)

    const img = sharp(join(srcPath, fn))
    ;(async() => {
        const resized = img.resize(512, 512, { kernel: 'lanczos2' })
        const buf = await resized.raw().toBuffer()
        if(buf.length !== imagePixelsC * 3) throw 'Size?' + fn + ' ' + buf.length


        // Note: we replace void color with transparent color, quantize the image,
        // and then replace the transparent color with void color.
        // This is done to preserve the void color between the images, as pinning
        // colors is not provided by the library.

        const resB = Buffer.alloc(imagePixelsC * 4)
        var hasTransp = false
        for(let i = 0; i < imagePixelsC; i++) {
            const r = buf.readUint8(i * 3    )
            const g = buf.readUint8(i * 3 + 1)
            const b = buf.readUint8(i * 3 + 2)
            if(Math.abs(r - bgr) < 3 && Math.abs(g - bgg) < 3 && Math.abs(b - bgb) < 3) {
                resB.writeUint32LE(i*4, 0)
                hasTransp = true
            }
            else {
                resB.writeUint8(r, i*4    )
                resB.writeUint8(g, i*4 + 1)
                resB.writeUint8(b, i*4 + 2)
                resB.writeUint8(0xff, i*4 + 3)
            }
        }

        const pngImage = sharp(resB, { raw: { width: 512, height: 512, channels: 4 } })
            .png({ compressionLevel: 9, palette: true })

        if(!hasTransp) {
            pngImage.toFile(dstFn)
            updateDone()
            return
        }

        const pngB = await pngImage.toBuffer()

        const [tLen, ti] = findChunk(pngB, 'tRNS')
        var lowestTransparencyI = 0, lowestTransparency = pngB.readUint8(ti)
        for(let j = 1; j < tLen; j++) {
            const transp = pngB.readUint8(ti + j)
            if(transp < lowestTransparency) {
                lowestTransparency = transp
                lowestTransparencyI = j
            }
        }
        // pngB.writeUint8(255, ti + lowestTransparencyI)

        const [pLen, pi] = findChunk(pngB, 'PLTE')
        pngB.writeUint8(bgr, pi + lowestTransparencyI*3    )
        pngB.writeUint8(bgg, pi + lowestTransparencyI*3 + 1)
        pngB.writeUint8(bgb, pi + lowestTransparencyI*3 + 2)
        const newCrc = crc32(pngB, pi - 4, pi + pLen, 0) >>> 0
        // console.log(pngB.readUint32BE(pi + pLen), newCrc)
        pngB.writeUint32BE(newCrc, pi + pLen)

        // remove transparency chunk since orig didn't have any transparency and we no longer need it
        const tChunkLen = 8 + tLen + 4
        pngB.copy(pngB, ti - 8, ti - 8 + tChunkLen)
        const finalB = pngB.subarray(0, pngB.length - tChunkLen)
        fs.promises.writeFile(dstFn, finalB)

        updateDone()
    })()
}

const bgInfo = {}
bgInfo.backgroundColor = bgInt
bgInfo.backgroundResolution = 512
bgInfo.backgroundSize = B.backgroundSize
bgInfo.backgroundStart = B.backgroundStart
bgInfo.backgroundCount = B.backgroundCount
bgInfo.backgroundLength = B.backgrounds.length

fs.writeFileSync(dstInfo, JSON.stringify(bgInfo))
