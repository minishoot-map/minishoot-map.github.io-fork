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
const countsDoneP = []
const residedPixelsP = []
for(let i = 0; i < filenames.length; i++) {
    const fn = filenames[i]
    if(!fn.endsWith('.png')) {
        console.log('skipping', fn)
        continue
    }

    const img = sharp(join(srcPath, fn))
    countsDoneP.push(
        (async() => {
            const resized = img.resize(512, 512, { kernel: 'lanczos2' })
            residedPixelsP.push(resized.raw().toBuffer())
            // resized.png().toFile(join(dstPath, 'src.png'))

            const buf = await resized.raw().toBuffer()
            if(buf.length !== 512*512*3) throw 'Size?' + fn + ' ' + buf.length
            for(var i = 0; i < buf.length; i += 3) {
                var v = buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16)
                counts[v] = (counts[v] ?? 0) + 1
            }
        })()
    )
}

counts[bgInt] = (counts[bgInt] ?? 0) + 100/*arbitrary*/

await Promise.all(countsDoneP)
console.log('counted pixels')

const uniqueColors = Object.keys(counts)
const colorsC = uniqueColors.length

const centroidC = 256

if(colorsC < centroidC) throw new Error('Not enough colors')
function genCentroids() {
    random.use(52)
    const centroids = new Uint32Array(centroidC)

    const taken = {}
    for (let i = 0; i < centroidC; i++) {
        do {
            var ri = uniqueColors[random.int(0, colorsC -1)]
        } while(taken[ri] != null)
        taken[ri] = 0
        centroids[i] = ri
    }

    return centroids
}

const centroids = genCentroids()

const countsA = new Uint32Array(colorsC * 2)
for(let i = 0; i < colorsC; i++) {
    const c = uniqueColors[i]
    countsA[i*2    ] = c
    countsA[i*2 + 1] = counts[c]
}

function iterate() {
    var totalDifferences = new Float32Array(centroidC * 3)
    var totalCounts = new Uint32Array(centroidC)

    for(var i = 0; i < countsA.length; i += 2) {
        var count = countsA[i*2 + 1]

        var col = countsA[i*2]
        var r = (col      ) & 0xff
        var g = (col >>  8) & 0xff
        var b = (col >> 16) & 0xff

        var minDist = 1 / 0
        var minJ = -1

        for(var j = 0; j < centroidC; j++) {
            var ccol = centroids[j]
            var dr = r - ((ccol      ) & 0xff)
            var dg = g - ((ccol >>  8) & 0xff)
            var db = b - ((ccol >> 16) & 0xff)
            var dist = dr*dr + dg*dg + db*db
            if(dist < minDist) {
                minJ = j
                minDist = dist
            }
        }

        {
            var ccol = centroids[minJ]
            var dr = r - ((ccol      ) & 0xff)
            var dg = g - ((ccol >>  8) & 0xff)
            var db = b - ((ccol >> 16) & 0xff)

            totalDifferences[minJ*3    ] += dr * count
            totalDifferences[minJ*3 + 1] += dg * count
            totalDifferences[minJ*3 + 2] += db * count
            totalCounts[minJ] += count
        }
    }

    for(var i = 0; i < centroidC; i++) {
        var ccol = centroids[i]
        var cr = (ccol      ) & 0xff
        var cg = (ccol >>  8) & 0xff
        var cb = (ccol >> 16) & 0xff

        // console.log(totalDifferences[i*3], totalDifferences[i*3 + 1], totalDifferences[i*3 + 2], totalCounts[i])

        if(totalCounts[i] == 0) continue
        var tic = 1 / totalCounts[i]
        var r = Math.min(Math.max(0, cr + Math.round(totalDifferences[i*3    ] * tic)), 255)
        var g = Math.min(Math.max(0, cg + Math.round(totalDifferences[i*3 + 1] * tic)), 255)
        var b = Math.min(Math.max(0, cb + Math.round(totalDifferences[i*3 + 2] * tic)), 255)

        centroids[i] = r | (g << 8) | (b << 16)
    }
}

for(let iter = 0; iter < 10; iter++) {
    console.log('iteration', iter)
    iterate()
}

// output centroids
/*
if(centroidC != 256) console.warn('skipping centroids image')
else {
    const buffer = Buffer.alloc(centroids.length * 4)
    centroids.forEach((value, index) => {
        buffer.writeUInt32LE(value, index * 4)
        buffer.writeUint8(255, index * 4 + 3)
    })
    sharp(buffer, { raw: { width: 16, height: 16, channels: 4 } })
        .png()
        .toFile(join(dstPath, 'image' + iter + '.png'))
}
*/

const resizedPixels = await Promise.all(residedPixelsP)

const palette = {}
for(let i = 0; i < uniqueColors.length; i++) {
    const col = uniqueColors[i]
    const r = (col      ) & 0xff
    const g = (col >>  8) & 0xff
    const b = (col >> 16) & 0xff

    let minDist = 1 / 0
    let minJ = -1

    for(let j = 0; j < centroidC; j++) {
        const ccol = centroids[j]
        const dr = r - ((ccol      ) & 0xff)
        const dg = g - ((ccol >>  8) & 0xff)
        const db = b - ((ccol >> 16) & 0xff)
        const dist = dr*dr + dg*dg + db*db
        if(dist < minDist) {
            minJ = j
            minDist = dist
        }
    }

    palette[col] = centroids[minJ]
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
