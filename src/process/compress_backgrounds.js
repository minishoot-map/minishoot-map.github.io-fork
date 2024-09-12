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

const nameRegex = /^(.+)_(.+)\.png$/
const filenames = fs.readdirSync(srcPath)
const residedPixelsP = []
const imagesGrid = new Map()
const imageBytesC = 512*512*3

function addImage(x, y, data) {
    var row = imagesGrid.get(y)
    if(row == null) {
        row = new Map()
        imagesGrid.set(y, row)
    }
    row.set(x, data)
}

function getImageCounts(x, y) {
    return imagesGrid.get(y)?.get(x)?.counts
}

for(let i = 0; i < filenames.length; i++) {
    const fn = filenames[i]
    if(!fn.endsWith('.png')) {
        console.log('skipping', fn)
        continue
    }

    const img = sharp(join(srcPath, fn))
    residedPixelsP.push((async() => {
        const resized = img.resize(512, 512, { kernel: 'lanczos2' })
        const buf = await resized.raw().toBuffer()
        if(buf.length !== imageBytesC) throw 'Size?' + fn + ' ' + buf.length

        const counts = { [bgInt]: 1 }
        for(let i = 0; i < buf.length; i += 3) {
            const v = buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16)
            counts[v] = (counts[v] ?? 0) + 1
        }

        const groups = fn.match(nameRegex)
        addImage(parseInt(groups[1]), parseInt(groups[2]), { buf, counts, index: i })
    })())
}

await Promise.all(residedPixelsP)
console.log('counted pixels')

function addCounts(totalCounts, counts) {
    if(!counts) return 0
    for(const k in counts) totalCounts[k] = (totalCounts[k] ?? 0) + counts[k]
    return 1
}

const centroidC = 256
const centroids = new Uint32Array(centroidC)
function genCentroids(uniqueColors) {
    const colorsC = uniqueColors.length
    random.use(52)

    // pin background color
    centroids[0] = bgInt

    const taken = new Set([bgInt])
    for (let i = 1; i < centroidC; i++) {
        do {
            var ri = uniqueColors[random.int(0, colorsC -1)]
        } while(taken.has(ri))
        taken.add(ri)
        centroids[i] = ri
    }
}

const totalDifferences = new Float32Array(centroidC * 3)
const totalCounts = new Uint32Array(centroidC)

function iterate(countsA) {
    totalDifferences.fill(0)
    totalCounts.fill(0)

    for(let i = 0; i < countsA.length; i += 2) {
        const count = countsA[i*2 + 1]

        const col = countsA[i*2]
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

        const ccol = centroids[minJ]
        const dr = r - ((ccol      ) & 0xff)
        const dg = g - ((ccol >>  8) & 0xff)
        const db = b - ((ccol >> 16) & 0xff)

        totalDifferences[minJ*3    ] += dr * count
        totalDifferences[minJ*3 + 1] += dg * count
        totalDifferences[minJ*3 + 2] += db * count
        totalCounts[minJ] += count
    }

    // skip first centroid (void color - pinned to be the same)
    for(let i = 1; i < centroidC; i++) {
        const ccol = centroids[i]
        const cr = (ccol      ) & 0xff
        const cg = (ccol >>  8) & 0xff
        const cb = (ccol >> 16) & 0xff

        // console.log(totalDifferences[i*3], totalDifferences[i*3 + 1], totalDifferences[i*3 + 2], totalCounts[i])

        if(totalCounts[i] == 0) continue
        const tic = 1 / totalCounts[i]
        const r = Math.min(Math.max(0, cr + Math.round(totalDifferences[i*3    ] * tic)), 255)
        const g = Math.min(Math.max(0, cg + Math.round(totalDifferences[i*3 + 1] * tic)), 255)
        const b = Math.min(Math.max(0, cb + Math.round(totalDifferences[i*3 + 2] * tic)), 255)

        centroids[i] = r | (g << 8) | (b << 16)
    }
}

function processImage(x, y, imgData) {
    const { buf, index } = imgData
    const thisCounts = imgData.counts

    const counts = {}
    addCounts(counts, thisCounts) // note: cannot modify thisCounts, that's why
    // include counts from neighbouring images to avoid discontinuities (hopefully)
    var count = 0
    count += addCounts(counts, getImageCounts(x - 1, y))
    count += addCounts(counts, getImageCounts(x + 1, y))
    count += addCounts(counts, getImageCounts(x, y - 1))
    count += addCounts(counts, getImageCounts(x, y + 1))

    console.log(x, y, count)

    const uniqueColors = Object.keys(counts)
    const colorsC = uniqueColors.length
    if(colorsC <= centroidC) {
        sharp(buf, { raw: { width: 512, height: 512, channels: 3 } })
            .png({ compressionLevel: 9, palette: true })
            .toFile(join(dstPath, filenames[index]))
        return
    }

    genCentroids(uniqueColors)

    const countsA = new Uint32Array(colorsC * 2)
    for(let i = 0; i < colorsC; i++) {
        const c = uniqueColors[i]
        countsA[i*2    ] = c
        countsA[i*2 + 1] = counts[c]
    }


    for(let iter = 0; iter < 4; iter++) {
        iterate(countsA)
    }

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

    // ouptut (overwrite the same buffer)
    for(let j = 0; j < buf.length; j += 3) {
        const col = buf[j] | (buf[j + 1] << 8) | (buf[j + 2] << 16)
        const pcol = palette[col]
        buf.writeUint8((pcol      ) & 0xff, j    )
        buf.writeUint8((pcol >>  8) & 0xff, j + 1)
        buf.writeUint8((pcol >> 16) & 0xff, j + 2)
    }
    sharp(buf, { raw: { width: 512, height: 512, channels: 3 } })
        .png({ compressionLevel: 9, palette: true })
        .toFile(join(dstPath, filenames[index]))
}

var doneCounts = 0
for(const [rk, row] of imagesGrid) {
    for(const [ck, col] of row) {
        processImage(ck, rk, col)
        doneCounts++
        if(doneCounts % 10 == 0) console.log('done', doneCounts, 'of', residedPixelsP.length)
    }
}

console.log('done processing')

const bgInfo = {}
bgInfo.backgroundColor = bgInt
bgInfo.backgroundResolution = 512

fs.writeFileSync(dstInfo, JSON.stringify(bgInfo))
