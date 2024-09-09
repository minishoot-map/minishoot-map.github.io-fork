import sharp from 'sharp'
import * as fs from 'node:fs'
import { join } from 'node:path'
import random from 'random'
import { backgroundColor } from '../data-raw/backgrounds/backgrounds.js'
const bgr = parseInt(backgroundColor.slice(0, 2), 16)
const bgg = parseInt(backgroundColor.slice(2, 4), 16)
const bgb = parseInt(backgroundColor.slice(4, 6), 16)
const bgInt = bgr | (bgg << 8) | (bgb << 16)

const srcPath = join(import.meta.dirname, '../data-raw/backgrounds')
const dstPath = join(import.meta.dirname, '../data-processed/backgrounds')
const dstInfo = join(import.meta.dirname, '../data-processed/backgrounds.json')

fs.mkdirSync(dstPath, { recursive: true })


const filenames = fs.readdirSync(srcPath)
const counts = {}
const residedPixelsP = []
for(let i = 0; i < filenames.length; i++) {
    const fn = filenames[i]
    if(!fn.endsWith('.png')) {
        console.log('skipping', fn)
        continue
    }

    const img = sharp(join(srcPath, fn))
    residedPixelsP.push(
        (async() => {
            const resized = img.resize(512, 512, { kernel: 'lanczos2' })
            const buf = await resized.raw().toBuffer()
            if(buf.length !== 512*512*3) throw 'Size?' + fn + ' ' + buf.length

            for(var i = 0; i < buf.length; i += 3) {
                var v = buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16)
                counts[v] = (counts[v] ?? 0) + 1
            }

            return buf
        })()
    )
}

counts[bgInt] = (counts[bgInt] ?? 0) + 100/*arbitrary*/

const resizedPixels = await Promise.all(residedPixelsP)
console.log('counted pixels')

// radix sort bucket counts for each channel
const bucketSize = 256
const channelValuesCounts = new Uint32Array(bucketSize * 3)
const startOffsets = new Uint32Array(bucketSize)

const rounds = 8

const buckets = new Uint32Array(2 ** rounds)
var bucketI = 0

function palletize(remSpits, beginI, endI, colors, colorsDst) {
    if(beginI == endI) {
        console.warn('lost a palette color')
        return
    }
    if(remSpits <= 0) {
        buckets[bucketI++] = endI
        return
    }

    channelValuesCounts.fill(0)

    var rmin = 255, rmax = 0
    var gmin = 255, gmax = 0
    var bmin = 255, bmax = 0

    for(let i = beginI; i < endI; i++) {
        const r = colors[i*3    ]
        channelValuesCounts[r]++
        rmin = Math.min(rmin, r)
        rmax = Math.max(rmax, r)

        const g = colors[i*3 + 1]
        channelValuesCounts[bucketSize + g]++
        gmin = Math.min(gmin, g)
        gmax = Math.max(gmax, g)

        const b = colors[i*3 + 2]
        channelValuesCounts[bucketSize * 2 + b]++
        bmin = Math.min(bmin, b)
        bmax = Math.max(bmax, b)
    }

    var off = 0
    var diff = rmax - rmin
    if(gmax - gmin > diff) {
        off = 1
        diff = gmax - gmin
    }
    if(bmax - bmin > diff) {
        off = 2
        diff = bmax - bmin
    }

    // console.log('chose', off, diff)

    var sum  = 0
    for(let i = 0; i < bucketSize; i++) {
        startOffsets[i] = (beginI + sum) * 3
        sum += channelValuesCounts[off * bucketSize + i]
    }

    var totalPixelsCount = 0
    for(let i = beginI; i < endI; i++) {
        const r = colors[i*3    ]
        const g = colors[i*3 + 1]
        const b = colors[i*3 + 2]

        const v = colors[i * 3 + off]
        const offset = startOffsets[v]

        startOffsets[v] += 3
        colorsDst[offset    ] = r
        colorsDst[offset + 1] = g
        colorsDst[offset + 2] = b

        const color = r | (g << 8) | (b << 16)
        totalPixelsCount += counts[color]
    }

    const median = totalPixelsCount * 0.5

    var prevC = 0, curC = 0
    var countI = beginI
    for(; countI < endI; countI++) {
        const color = colorsDst[countI*3] | (colorsDst[countI*3 + 1] << 8) | (colorsDst[countI*3 + 2] << 16)
        prevC = curC
        curC += counts[color]
        if(curC >= median) break
    }

    if(median - prevC < curC - median) countI = countI - 1
    countI = Math.min(Math.max(beginI + 1, countI), endI - 1)

    // console.log('   ', beginI, countI, endI, curC, prevC, median)
    palletize(remSpits - 1, beginI, countI, colorsDst, colors)
    palletize(remSpits - 1, countI, endI, colorsDst, colors)
}


const uniqueColors = Object.keys(counts)
const colorsC = uniqueColors.length

const colors = new Uint8Array(colorsC * 3)
for(let i = 0; i < colorsC; i++) {
    const c = uniqueColors[i]
    colors[i*3    ] = (c      ) & 0xff
    colors[i*3 + 1] = (c >>  8) & 0xff
    colors[i*3 + 2] = (c >> 16) & 0xff
}
const colors2 = new Uint8Array(colorsC * 3)

palletize(rounds, 0, colorsC, colors, colors2)
const resultColors = rounds & 1 ? colors2 : colors

console.log('done')

const palette = {}
let prevOff = 0
for(let i = 0; i < bucketI; i++) {
    const curOff = buckets[i]
    var tr = 0, tg = 0, tb = 0, total = 0
    for(let j = prevOff; j < curOff; j++) {
        const r = resultColors[j*3    ]
        const g = resultColors[j*3 + 1]
        const b = resultColors[j*3 + 2]

        const color = r | (g << 8) | (b << 16)
        const count = counts[color]

        tr += (r - 127) * count
        tg += (g - 127) * count
        tb += (b - 127) * count
        total += count
    }

    const ar = Math.min(Math.max(0, Math.round(tr / total + 127)), 255)
    const ag = Math.min(Math.max(0, Math.round(tg / total + 127)), 255)
    const ab = Math.min(Math.max(0, Math.round(tb / total + 127)), 255)
    const avg = ar | (ag << 8) | (ab << 16)

    for(let j = prevOff; j < curOff; j++) {
        const r = resultColors[j * 3]
        const g = resultColors[j*3 + 1]
        const b = resultColors[j*3 + 2]
        const color = r | (g << 8) | (b << 16)
        palette[color] = avg
    }

    prevOff = curOff
}

console.log('generating output')

// ouptut
for(let i = 0; i < resizedPixels.length; i++) {
    const rp = resizedPixels[i]
    const res = Buffer.alloc(rp.length)
    for(let j = 0; j < rp.length; j += 3) {
        const col = rp[j    ] | (rp[j + 1] << 8) | (rp[j + 2] << 16)
        const pcol = palette[col]
        res.writeUint8((pcol      ) & 0xff, j    )
        res.writeUint8((pcol >>  8) & 0xff, j + 1)
        res.writeUint8((pcol >> 16) & 0xff, j + 2)
    }
    sharp(res, { raw: { width: 512, height: 512, channels: 3 } })
        .png({ compressionLevel: 9, palette: true, colors: 256 }) // just hope it uses the same colors as us I guess
        .toFile(join(dstPath, filenames[i]))
}

const bgInfo = {}
bgInfo.backgroundColor = palette[bgInt]
bgInfo.backgroundResolution = 512

fs.writeFileSync(dstInfo, JSON.stringify(bgInfo))
