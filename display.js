'use strict';

var colliderTypes = { box: 0, capsule: 1, circle: 2, polygon: 3, composite: 4, tilemap: 5 }
var colliderNames = ['BoxCollider2D', 'CapsuleCollider2D', 'CircleCollider2D', 'PolygonCollider2D', 'CompositeCollider2D', 'TilemapCollider2D']

var locations = ["Overworld", "Cave", "CaveExtra", "Dungeon1", "Dungeon2", "Dungeon3", "Dungeon4", "Dungeon5", "Temple1", "Temple2", "Temple3", "Tower", "CaveArena", "Snow"]

function multiply(n, m) {
    var a = m[0] * n[0] + m[1] * n[3]
    var b = m[0] * n[1] + m[1] * n[4]
    var c = m[0] * n[2] + m[1] * n[5] + m[2]
    var d = m[3] * n[0] + m[4] * n[3]
    var e = m[3] * n[1] + m[4] * n[4]
    var f = m[3] * n[2] + m[4] * n[5] + m[5]

    n[0] = a
    n[1] = b
    n[2] = c
    n[3] = d
    n[4] = e
    n[5] = f

    return n
}

var deg2rad = (Math.PI / 180)
// Note: rotation is counter-clockwise in both Unity and css (right?)
function construct(obj) {
    var sin = Math.sin(obj.rz * deg2rad)
    var cos = Math.cos(obj.rz * deg2rad)
    var matrix = new Float32Array(6);
    matrix[0] = cos * obj.scale[0]
    matrix[1] = -sin * obj.scale[1]
    matrix[2] = obj.localPos[0]
    matrix[3] = sin * obj.scale[0]
    matrix[4] = cos * obj.scale[1]
    matrix[5] = obj.localPos[1]
    return matrix
}

function updateTansform(i) {
    if(i == undefined || i < 0) return
    var obj = objects[i]
    if(obj.matrix) return obj.matrix

    var matrix = construct(obj)
    var pMatrix = updateTansform(obj.parentI)
    if(pMatrix) multiply(matrix, pMatrix)

    return obj.matrix = matrix
}

var view = document.getElementById('view')
var container = document.getElementById('map-cont')
var title = document.getElementById('name') // yay name is already taken
var other = document.getElementById('other')
var desc = document.getElementById('desc')
var c_enemy = document.getElementById('c-enemy')
var c_jar = document.getElementById('c-jar')
var c_crd = document.getElementById('c-crd')
var c_tran = document.getElementById('c-tran')
var c_scarab = document.getElementById('c-scarab')
var c_destr = document.getElementById('c-destr')

c_enemy.querySelector('.lvl').addEventListener("change", () => {
    updProp(curI)
})

var propsHidden = true
window['prop-show-hide'].addEventListener('click', () => {
    propsHidden = !propsHidden
    updPropsHidden()
})
function updPropsHidden() {
    window.views.setAttribute('data-hidden', propsHidden)
}
updPropsHidden()

var dd = 100

function cx(i) { return i * dd }
function cy(i) { return -i * dd }
function icx(i) { return i / dd }
function icy(i) { return -i / dd }

function sqd(x, y, a, b) {
    return Math.abs(x - a) * Math.abs(x - a) + Math.abs(y - b) * Math.abs(y - b)
}

// console.log(icx(-9), icy(-19), icx(826), icy(135))
// -313.66262626262625 288.7287878787879 739.7868686868687 94.43989898989898
// console.log(dd)
// 0.7926341072858286

var map_details = {
    "ow": [ -313.66262626262625, 290.1, 0.405 ],
    "d3": [ 739.7868686868687, 94.43989898989898, 0.13 / 0.7926341072858286 ]
}

function createCanvas(w, h) {
    if ('OffscreenCanvas' in window) {
        const canvas = new OffscreenCanvas(w, h)
        const ctx = canvas.getContext('2d', { alpha: false })

        const getUrl = async() => {
            const blob = await canvas.convertToBlob()
            return URL.createObjectURL(blob)
        };

        return { canvas, ctx, getUrl }
    }
    else {
        const canvas = document.createElement('canvas')
        canvas.width = w + "px"
        canvas.height = h + "px"
        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
        const getUrl = () => {
            return new Promise((s, j) => {
                canvas.toBlob(blob => {
                    if(blob == null) j()
                    s(URL.createObjectURL(blob))
                })
            })
        }

        return { canvas, ctx, getUrl }
    }
}


;(() => {
    const images = []
    const min = [backgroundCount[0], backgroundCount[1]], max = [0, 0]
    for(let i = 0; i < backgrounds.length; i++) {
        const b = backgrounds[i]
        min[0] = Math.min(min[0], b[0])
        min[1] = Math.min(min[1], b[1])
        max[0] = Math.max(max[0], b[0])
        max[1] = Math.max(max[1], b[1])
        const img = new Image()
        img.src = './backgrounds/' + b[0] + '_' + b[1] + '.png'
        images.push({ b, img })
    }

    const actualResolution = backgroundResolution * 0.25 // downscale

    const width = (max[0] - min[0] + 1)
    const height = (max[1] - min[1] + 1)

    var imgg = new Image()
    const x = cx(backgroundStart[0] + (min[0] * backgroundSize) - backgroundSize*0.5)
    const y = cy(backgroundStart[1] + (min[1] * backgroundSize) - backgroundSize*0.5)
        - height * backgroundSize * dd /* hate this */
    imgg.draggable = false
    imgg.style.opacity = 0
    imgg.style.transform = `translate(${x}px, ${y}px)`
    imgg.width = width * backgroundSize * dd
    imgg.height = height * backgroundSize * dd

    const { canvas, ctx, getUrl } = createCanvas(width * actualResolution, height * actualResolution)

    ctx.fillStyle = "#" + backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    var count = 0
    function checkSubmit() {
        if(count == images.length) {
            getUrl().then(url => {
                imgg.src = url
                imgg.style.opacity = 1
            })
        }
    }

    for(let i = 0; i < images.length; i++) {
        const it = images[i]
        // this is safe right? I am not suspending, so the event could not trigger before this
        it.img.addEventListener('error', _ => {
            count++
            checkSubmit()
        })
        it.img.addEventListener('load', _ => {
            count++
            ctx.drawImage(
                it.img,
                (it.b[0] - min[0]) * actualResolution,
                canvas.height - (1 + it.b[1] - min[1]) * actualResolution,
                actualResolution,
                actualResolution
            )
            checkSubmit()
        })
    }

    document.getElementById("backgrounds").appendChild(imgg)
})()

var levelDiffMax = 35
var num2arr = [0, -0.0005760992, -0.001099514, -0.001562121, -0.001955796, -0.002272415, -0.002503856, -0.002641993, -0.002678705, -0.002605866, -0.002415353, -0.002099043, -0.001648813, -0.001056537, -0.0003140926, 0.000586643, 0.001653795, 0.002895486, 0.004319842, 0.005934983, 0.007749034, 0.009770121, 0.01200636, 0.01446589, 0.01715682, 0.02008727, 0.02326539, 0.02669927, 0.03039706, 0.03436686, 0.03861683, 0.04315505, 0.04798967, 0.05312951, 0.05867211, 0.06471878, 0.07132179, 0.07853336, 0.08640583, 0.09499138, 0.1043423, 0.1145109, 0.1255495, 0.1375101, 0.1504453, 0.1644071, 0.1794479, 0.1956198, 0.2129754, 0.2315666, 0.2514459, 0.2726654, 0.2952775, 0.3193344, 0.3448884, 0.3719916, 0.4006965, 0.4310553, 0.4631202, 0.4969434, 0.5325773, 0.5700741, 0.6094862, 0.6508656, 0.6942647, 0.7397357, 0.7873312, 0.8371028, 0.8891034, 0.9433848, 1]

var baseXpGain = 1
var gainCoeffMax = 10
var minimumGain = 1

function Round(num) {
    let rounded = Math.round(num);
    if (Math.abs(num % 1) === 0.5) {
        rounded = (rounded % 2 === 0) ? rounded : rounded - 1;
    }
    return rounded;
}

function calcXp(size, level, playerL) {
    var num = level * 10 - playerL
    var num2 = num2arr[Math.min(Math.max(0, num + levelDiffMax), num2arr.length-1)]
    var b = Round(Math.fround(Math.fround(baseXpGain * num2) * gainCoeffMax))
    var num3 = size > 1 ? (size * 0.75) : 1
    return Round(Math.fround(Math.max(minimumGain, b) * num3))
}

var originX = -cx(-1), originY = -cy(34.44)
var scale = 1

var panning = { is: false, prevX: undefined, prevY: undefined }
var touches = { order: [/*id*/], touches: {/*id: { prevX, prevY }*/} }

function enemyLevel(e) {
    return 3 * (e.tier - 1) + e.size
}

function createObjectUrl(i) {
    const obj = objects[i]
    if(obj) {
        const url = document.createElement('a')
        url.href = 'javascript:void(0);'
        url.innerText = obj.name || '<No name>'
        url.addEventListener('click', () => {
            other.innerHTML = ''
            updProp(i)
        })
        return url
    }
    else {
        return document.createTextNode('<Unknown>')
    }
}

function getCurUrlI(url) {
    if(!url) url = new URL(window.location.href)

    const name = url.searchParams.get('obj')
    var i = 0
    for(; i < objects.length; i++) {
        if(objects[i].name === name) break
    }
    if(i === objects.length) i = -1

    return i
}

function updUrl() {
    if(!wereObjectsLoaded) return

    const url = new URL(window.location.href)
    const prevI = getCurUrlI(url)

    if(prevI === curI) return
    const o = objects[curI]

    url.searchParams.set('obj', o.name)
    window.history.pushState({}, '', url);
}

var curI
function updProp(i) {
    curI = i

    document.querySelectorAll('.selected').forEach((el) => { el.classList.remove('selected') })
    var el = document.querySelector('[data-index="' + i + '"]')
    if(el) {
        el.classList.add('selected')
    }

    c_enemy.style.display = 'none'
    c_jar.style.display = 'none'
    c_crd.style.display = 'none'
    c_tran.style.display = 'none'
    c_scarab.style.display = 'none'
    c_destr.style.display = 'none'

    updUrl()

    if(i === -1) {
        gotoMark.setAttribute('disabled', '')
        desc.innerHTML = ''
        other.innerHTML = ''
        return
    }
    if(!wereObjectsLoaded) return

    gotoMark.removeAttribute('disabled')

    const o = objects[i]
    title.value = o.name
    let descText = 'Position: (' + o.pos[0] + ', ' + o.pos[1] + ')<br>Components:'
    for(let i = 0; i < o.allComponents.length; i++) {
        descText += '<br><span class="gap"></span>' + o.allComponents[i]
    }
    desc.innerHTML = descText

    const c = o.components
    if(c.Enemy) {
        c_enemy.style.display = ''
        const xp = c_enemy.querySelector('.xp')
        const lvl = c_enemy.querySelector('.lvl')
        const desc = c_enemy.querySelector('.desc')

        var it = c.Enemy
        desc.innerText = 'HP: ' + it.hp + '\nSize: ' + it.size + '\nTier: ' + it.tier
        if(!lvl.value) lvl.value = '0'
        var level = +lvl.value
        xp.innerText = calcXp(it.size, enemyLevel(it), level)
    }

    if(c.Jar) {
        c_jar.style.display = ''
        const desc = c_jar.querySelector('.desc')

        var it = c.Jar
        desc.innerText = 'Type: ' + jarTypes[it.dropType] + getExtra(it) + '\nSize: ' + it.size
    }

    if(c.CrystalDestroyable) {
        c_crd.style.display = ''
        const desc = c_crd.querySelector('.desc')

        var it = c.CrystalDestroyable
        desc.innerText = 'Drops xp: ' + it.dropXp + (it.dropXp ? '\nXp: ' + xpForCrystalSize[it.size] : '') + '\nSize: ' + it.size
    }

    if(c.Transition) {
        c_tran.style.display = ''
        const desc = c_tran.querySelector('.desc')

        var it = c.Transition
        desc.innerText = 'Destination location: ' + (locations[it.destLocation] ?? '<Unknown>') + (it.isSameLoc ? ' (same location)' : '') + '\nDestination: '
        desc.appendChild(createObjectUrl(it.destObjectI))
    }

    if(c.Scarab) {
        c_scarab.style.display = ''
        const dest = c_scarab.querySelector('.dest')

        var it = c.Scarab
        dest.innerHTML = ''
        dest.appendChild(createObjectUrl(it.destrI))
    }

    if(c.Destroyable) {
        c_destr.style.display = ''
        const perm = c_destr.querySelector('[data-perm]')

        var it = c.Destroyable
        perm.innerText = it.isPermanent
    }
}

var jarTypes = ["nothing", "hp", "random", "big crystal", "energy", "full energy", "big srystals (65)"]

function getExtra(e) {
    var extra
    if(e.dropType == 1) extra = e.size - 1
    if(e.dropType == 2) extra = "15% hp, 15% 1-9 xp, 15% 2-4 energy"
    if(e.dropType == 3) extra = (e.size - 1) * 2
    if(e.dropType == 4) extra = "3-5"
    return extra !== undefined ? ' (' + extra + ')' : ''
}

function updTransform() {
    view.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${originX}, ${originY})`
}

var batchSize = 1024

var sizeDisplayUpdate = {
    i: 0, updatedCount: 0,
    update() {
        var elements = this.elements
        var updatedCount = this.updatedCount
        if(updatedCount >= elements.length) return
        var i = this.i

        elements[i].style.setProperty('--size2', this.size)
        i++
        if(i === elements.length) i = 0
        updatedCount++

        this.i = i
        this.updatedCount = updatedCount
    },
    updateAll() {
        var elements = this.elements
        var updatedCount = this.updatedCount
        if(updatedCount >= elements.length) return
        var sizeS = '' + this.size

        for(var i = 0; i < elements.length; i++) {
            elements[i].style.setProperty('--size2', sizeS)
        }

        // note: do not reset `i` so that all marks periodicly update
        this.updatedCount = elements.length
    },
    set(newSize) {
        this.size = newSize
        this.updatedCount = 0
        // note: do not reset `i` so that all marks periodicly update
    },
}

document.body.style.setProperty('--dd', dd)
function updSize() {
    const minScale = 0.1
    const newSize2 = minScale / Math.min(scale, minScale)
    if(newSize2 != sizeDisplayUpdate.size) {
        sizeDisplayUpdate.set(newSize2)
    }
}

function update() {
    try {
        sizeDisplayUpdate.update()
    }
    catch(e) { console.error(e) }

    requestAnimationFrame(update)
}

function gotoObject() {
    if(curI == -1) return
    if(!wereObjectsLoaded) return

    const o = objects[curI]
    if(o == null) return

    originX = -cx(o.pos[0]) * scale
    originY = -cy(o.pos[1]) * scale
    updTransform()
}

const gotoMark = window['goto-mark']
gotoMark.setAttribute('disabled', '')
gotoMark.onclick = () => {
    gotoObject()
}

var curMarkBatch, curMarkBatchI
function addMark(it) {
    if(curMarkBatch == null) {
        curMarkBatchI = 0
        curMarkBatch = document.createElement('div')
        curMarkBatch.classList.add('batch', 'mark-batch')
    }

    curMarkBatch.appendChild(it)
    curMarkBatchI++
    if(curMarkBatchI == batchSize) {
        view.appendChild(curMarkBatch)
        curMarkBatch = null
    }
}

var curColliderBatch, curColliderBatchI
function addCollider(it) {
    if(curColliderBatch == null) {
        curColliderBatchI = 0
        curColliderBatch = document.createElement('div')
        curColliderBatch.classList.add('batch', 'collider-batch')
    }

    curColliderBatch.appendChild(it)
    curColliderBatchI++
    if(curColliderBatchI == batchSize) {
        view.appendChild(curColliderBatch)
        curColliderBatch = null
    }
}

var filters = {
    enemies: false, e_name: false, e_name_text: "", e_size: false, e_size_text: 3, e_tier: false, e_tier_text: 1,
    jars: true, jars_t0: true, jars_t1: true, jars_t2: true, jars_t3: true, jars_t4: true, jars_t5: true, jars_t6: true,
    crd_y_f: true, crd_n_f: true, crd_f_s: false, crd_f_s_text: 3,
    tran: true, tran_l: false,
    scarab: true,
    backg: true, coll: false, coll_4: true, coll_6: true, coll_14: true, coll_16: true, coll_17: false, coll_25: true,
    coll_ui: false,
}
var coll_layers = [4, 6, 14, 16, 17, 25]

var filters_elements = {}

;((fe) => {
    fe.enemies = window['e-f']
    fe.e_name = window['e-f-name']
    fe.e_name_text = window['e-f-name-text']
    fe.e_size = window['e-f-size']
    fe.e_size_text = window['e-f-size-text']
    fe.e_tier = window['e-f-tier']
    fe.e_tier_text = window['e-f-tier-text']

    fe.jars = window['j-f']
    fe.jars_t0 = window['j-f-0']
    fe.jars_t1 = window['j-f-1']
    fe.jars_t2 = window['j-f-2']
    fe.jars_t3 = window['j-f-3']
    fe.jars_t4 = window['j-f-4']
    fe.jars_t5 = window['j-f-5']
    fe.jars_t6 = window['j-f-6']

    fe.crd_y_f = window['crd-y-f']
    fe.crd_n_f = window['crd-n-f']
    fe.crd_f_s = window['crd-f-s']
    fe.crd_f_s_text = window['crd-f-s-text']

    fe.tran = window['tran-f']
    fe.tran_l = window['tran-f-l']

    fe.scarab = window['scarab-f']

    fe.coll = window['c-f']
    for(let coll_li of coll_layers) {
        fe['coll_' + coll_li] = window['c-f-' + coll_li]
    }
    fe.backg = window['b-f']

    for(let key in filters_elements) {
        let el = filters_elements[key]
        let f = filters[key]
        el.type = el.getAttribute('type')
        if(el.type == 'checkbox') {
            el.checked = f
            el.addEventListener("change", (event) => {
                filters[key] = el.checked
                updFilters()
            })
        }
        else {
            el.value = f
            el.addEventListener("change", (event) => {
                filters[key] = el.type == 'number' ? parseInt(el.value) : el.value
                updFilters()
            })
        }
    }
})(filters_elements)

const filters_style = document.createElement('style');
document.head.appendChild(filters_style);
function updFilters() {
    for(let key in filters_elements) {
        let el = filters_elements[key]
        let f = filters[key]
        el.value = f
        el.checked = f
    }

    var css = ""
    if(!filters.enemies) css += '[data-enemy-index] { display: none; }'
    if(filters.e_name) css += '[data-enemy-name]:not([data-enemy-name*="' + filters.e_name_text.replace(/[^a-zA-Z0-9-\s]/g, '') + '" i]) { display: none; }'
    if(filters.e_size) css += '[data-enemy-size]:not([data-enemy-size="' + filters.e_size_text + '"]) { display: none; }'
    if(filters.e_tier) css += '[data-enemy-tier]:not([data-enemy-tier="' + filters.e_tier_text + '"]) { display: none; }'
    if(!filters.jars) css += '[data-jar-index] { display: none; }'

    for(let i = 0; i < 7; i++) {
        if(!filters["jars_t" + i]) css += '[data-jar-type="' + i + '"] { display: none; }'
    }

    if(!filters.crd_y_f) css += '[data-crd-type="1"] { display: none; }'
    if(!filters.crd_n_f) css += '[data-crd-type="0"] { display: none; }'
    if(filters.crd_f_s) css += '[data-crd-size]:not([data-crd-size="' + filters.crd_f_s_text + '"]) { display: none; }'

    if(!filters.tran) css += '[data-transition] { display: none; }'
    if(!filters.tran_l) css += '[data-transition-line] { display: none; }'

    if(!filters.scarab) css += '[data-scarab] { display: none; }'

    if(!filters.coll) css += '[data-collider-layer] { display: none; }'
    for(let coll_li of coll_layers) {
        if(!filters['coll_' + coll_li]) css += '[data-collider-layer="' + coll_li + '"] { display: none; }'
    }
    if(!filters.backg) css += '#backgrounds { display: none; }'


    filters_style.textContent = css;
}

function testFiltersEnemy(it, obj) {
    if(!filters.enemies) return false;
    if(filters.e_name && !obj.name.toLowerCase().includes(filters.e_name_text.toLowerCase())) return false;
    if(filters.e_size && it.size != filters.e_size_text) return false;
    if(filters.e_tier && it.tier != filters.e_tier_text) return false;
    return true;
}

function testFiltersJar(it) {
    if(!filters.jars) return false;
    if(!filters['jars_t' + it.dropType]) return false
    return true
}

function testFiltersCrd(it) {
    if(!(it.dropXp ? filters.crd_y_f : filters.crd_n_f)) return false
    if(filters.crd_f_s && it.size != filters.crd_f_s_text) return false
    return true
}

function testFiltersTran(it) {
    return filters.tran
}

function testFiltersScarab(it) {
    return filters.scarab
}

var minScale = 0.1 / dd, maxScale = 100 / dd
function clampedScale(scale, old) {
    if(scale != scale) {
        return [false, old]
    }
    if(scale <= maxScale) {
        if(scale >= minScale) return [true, scale]
        else return [false, minScale]
    }
    else return [false, maxScale]
}
function clampScale(scale, old) {
    return clampedScale(scale, old)[1]
}

function hypot2(xd, yd) {
    var h = Math.hypot(xd, yd)
    if(h >= 0.0001) return h
    else return 0.0001
}


container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = view.getBoundingClientRect();
    const offsetX = originX + e.clientX - rect.left;
    const offsetY = originY + e.clientY - rect.top;

    const zoomFactor = 0.004;
    var delta = 1 + Math.abs(e.deltaY) * -zoomFactor;
    if(e.deltaY < 0) delta = 1 / delta

    const newScale = clampScale(scale * delta, scale)

    const tx = offsetX + (originX - offsetX) * (newScale / scale)
    const ty = offsetY + (originY - offsetY) * (newScale / scale)

    scale = newScale;
    originX = tx;
    originY = ty;
    updTransform()
    updSize()
});

container.addEventListener('mousedown', (e) => {
    panning.is = true
    panning.prevX = e.clientX
    panning.prevY = e.clientY
});

container.addEventListener('mouseup', () => {
    panning.is = false
});

container.addEventListener('mousemove', (e) => {
    if(!panning.is) return;

    var curX = e.clientX
    var curY = e.clientY

    originX += curX - panning.prevX
    originY += curY - panning.prevY
    updTransform()

    panning.prevX = curX
    panning.prevY = curY
});

container.addEventListener('touchstart', function (e) {
    const rect = window['center-view'].getBoundingClientRect()

    for(var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i]
        if(touches.touches[t.identifier]) continue;
        touches.order.push(t.identifier)
        touches.touches[t.identifier] = { prevX: t.clientX - rect.x, prevY: t.clientY - rect.y }
    }
});

container.addEventListener('touchmove', function (e) {
    const firstId = touches.order[0]
    if(firstId == undefined) return
    const secondId = touches.order[1]

    let t1, t2
    for(let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i]
        if(t.identifier == firstId) {
            t1 = t
        }
        else if(t.identifier == secondId) {
            t2 = t
        }
    }
    if(t1 == undefined) return

    const rect0 = window['center-view'].getBoundingClientRect()
    const rect = { x: rect0.x, y: rect0.y }

    const touch1 = touches.touches[firstId]
    if(t2 == undefined) { // pan
        const curX = t1.clientX - rect.x
        const curY = t1.clientY - rect.y

        originX += curX - touch1.prevX
        originY += curY - touch1.prevY
        updTransform()
    }
    else {
        const touch2 = touches.touches[secondId]

        const curX1 = t1.clientX - rect.x
        const curY1 = t1.clientY - rect.y
        const curX2 = t2.clientX - rect.x
        const curY2 = t2.clientY - rect.y

        const preX1 = touch1.prevX
        const preY1 = touch1.prevY
        const preX2 = touch2.prevX
        const preY2 = touch2.prevY

        // note: for some reason, zoom sometimes snaps to some value
        const dx = curX1 - curX2
        const dy = curY1 - curY2
        const pdx = preX1 - preX2
        const pdy = preY1 - preY2
        const delta = Math.sqrt((dx * dx + dy * dy) / (pdx * pdx + pdy * pdy))
        const [wasOk, newScale] = clampedScale(scale * delta, scale)
        const newDelta = wasOk ? delta : (newScale / scale)

        const tx = (curX1 + curX2) * 0.5 - ((preX1 + preX2) * 0.5 - originX) * newDelta
        const ty = (curY1 + curY2) * 0.5 - ((preY1 + preY2) * 0.5 - originY) * newDelta

        scale = newScale
        originX = tx
        originY = ty

        updTransform()
        updSize()
    }

    for(let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        const touch = touches.touches[t.identifier]
        if(!touch) continue

        touch.prevX = t.clientX - rect.x
        touch.prevY = t.clientY - rect.y
    }

    e.preventDefault()
});

container.addEventListener('touchend', function (e) {
    for(let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        for(let j = 0; j < touches.order.length; j++) {
            if(touches.order[j] === t.identifier) {
                delete touches.touches[t.identifier]
                touches.order.splice(j, 1)
                break;
            }
        }
    }
})

var markers = []

objectsLoaded.then(() => {
    for(let i = 0; i < objects.length; i++) {
        let it = objects[i]
        it.name = it[0]
        it.parentI = it[1]
        it.localPos = it[2]
        it.pos = it[3]
        it.rz = it[4]
        it.scale = it[5]
        it.allComponents = it[6]
        it.components = {} // just hope that there wouldn't be 2 components of the same type
    }

    for(let i = 0; i < enemies.length; i++) {
        let it = enemies[i]
        it.objI = it[0]
        it.size = it[1]
        it.tier = it[2]
        it.hp = it[3]
        it.spriteI = it[4]

        objects[it.objI].components['Enemy'] = it
    }

    for(let i = 0; i < jars.length; i++) {
        let it = jars[i]
        it.objI = it[0]
        it.size = it[1]
        it.dropType = it[2]

        objects[it.objI].components['Jar'] = it
    }

    for(let i = 0; i < crystalDestroyables.length; i++) {
        let it = crystalDestroyables[i]
        it.objI = it[0]
        it.dropXp = it[1]
        it.size = it[2]

        objects[it.objI].components['CrystalDestroyable'] = it
    }

    for(let i = 0; i < scarabs.length; i++) {
        let it = scarabs[i]
        it.objI = it[0]
        it.destrI = it[1]

        objects[it.objI].components['Scarab'] = it
    }

    for(let i = 0; i < destroyables.length; i++) {
        let it = destroyables[i]
        it.objI = it[0]
        it.isPermanent = it[1]

        objects[it.objI].components['Destroyable'] = it
    }

    for(let i = 0; i < colliders.length; i++) {
        let it = colliders[i]
        it.objI = it[0]
        it.isTrigger = it[1]
        it.off = it[2]
        it.layer = it[3]
        it.type = it[4]
        if(it.type == colliderTypes.box) {
            it.size = it[5]
            it.usedByComposite = it[6]
        }
        else if(it.type == colliderTypes.capsule) {
            it.size = it[5]
            it.vertical = it[6]
        }
        else if(it.type == colliderTypes.circle) {
            it.radius = it[5]
        }
        else if(it.type == colliderTypes.polygon) {
            it.usedByComposite = it[5]
            it.polygon = it[6]
        }
        else if(it.type == colliderTypes.composite) {
            it.polygons = it[5]
        }

        objects[it.objI].components[colliderNames[it.type] ?? it.type] = it
    }

    for(let i = 0; i < transitions.length; i++) {
        let it = transitions[i]
        it.objI = it[0]
        it.isSameLoc = it[1]
        it.destLocation = it[2]
        it.destObjectI = it[3]

        objects[it.objI].components['Transition'] = it
    }

    for(let i = 0; i < objects.length; i++) {
        updateTansform(i);
    }

    for(let i = 0; i < objects.length; i++) {
        const obj = objects[i]
        const c = obj.components

        if(c.Enemy) {
            const it = c.Enemy

            var el = document.createElement('span')
            el.classList.add('mark')
            el.setAttribute('data-index', i)
            el.setAttribute("data-enemy-index", i)
            el.setAttribute("data-enemy-name", obj.name)
            el.setAttribute("data-enemy-size", it.size)
            el.setAttribute("data-enemy-tier", it.tier)
            el.style.left = cx(obj.pos[0]) + 'px'
            el.style.top = cy(obj.pos[1]) + 'px'

            var img = document.createElement('img')
            img.src = 'data/sprites/' + textures[it.spriteI] + '.png'
            img.draggable = false
            el.appendChild(img)

            addMark(el)
            markers.push(i)
            continue
        }

        if(c.Jar) {
            const it = c.Jar

            var el = document.createElement('span')
            el.classList.add('mark')
            el.setAttribute('data-index', i)
            el.setAttribute("data-jar-index", i)
            el.setAttribute("data-jar-type", it.dropType)
            el.style.left = cx(obj.pos[0]) + 'px'
            el.style.top = cy(obj.pos[1]) + 'px'

            var img = document.createElement('img')
            img.src = 'data/sprites/' + textures[jarTexture] + '.png'
            img.draggable = false
            el.appendChild(img)

            addMark(el)
            markers.push(i)
            continue
        }

        if(c.CrystalDestroyable) {
            const it = c.CrystalDestroyable

            var el = document.createElement('span')
            el.classList.add('mark')
            el.setAttribute('data-index', i)
            el.setAttribute("data-crd-size", it.size)
            el.setAttribute("data-crd-type", it.dropXp ? 1 : 0)
            el.style.setProperty('--size-fac', 1 + 0.5 * it.size)
            el.style.left = cx(obj.pos[0]) + 'px'
            el.style.top = cy(obj.pos[1]) + 'px'

            var img = document.createElement('img')
            img.src = 'data/sprites/' + (it.dropXp ? textures[crystalDestroyableTexture] : textures[crystalDestroyableTexture2]) + '.png'
            img.draggable = false
            el.appendChild(img)

            addMark(el)
            markers.push(i)
            continue
        }

        if(c.Transition) {
            const it = c.Transition

            const itc = c.CompositeCollider2D ?? c.BoxCollider2D ?? c.CircleCollider2D ?? c.CapsuleCollider2D ?? c.PolygonCollider2D
            if(itc) {
                let coll = createCollider(itc, obj, true)
                if(!coll) {
                    coll = document.createElement('span')
                    coll.classList.add('dot')
                    coll.classList.add('collider')
                }

                let line
                if(it.destObjectI >= 0) {
                    const iline = createSvgLine(obj.pos, objects[it.destObjectI].pos)
                    line = document.createElement('span')
                    line.classList.add('collider')
                    line.style.transform = `matrix(1, 0, 0, -1, 0, 0)`
                    line.appendChild(iline)
                    line.setAttribute('data-transition-line', '')
                }

                const el = document.createElement('span');
                el.classList.add('collider')
                el.setAttribute('data-index', i)
                el.setAttribute('data-transition', '')
                el.appendChild(coll)
                if(line) el.appendChild(line)
                {
                    const mark = document.createElement('span');
                    mark.classList.add('mark')
                    mark.style.left = obj.pos[0] * dd + 'px'
                    mark.style.top = obj.pos[1] * -dd + 'px'
                    el.appendChild(mark)
                }

                addMark(el)
                markers.push(i)
                continue
            }
        }

        if(c.Scarab) {
            const it = c.Scarab

            var el = document.createElement('span')
            el.classList.add('mark')
            el.setAttribute('data-index', i)
            el.setAttribute("data-scarab", '')
            el.style.left = cx(obj.pos[0]) + 'px'
            el.style.top = cy(obj.pos[1]) + 'px'

            var img = document.createElement('img')
            img.src = 'data/sprites/' + textures[scarabTexture] + '.png'
            img.draggable = false
            el.appendChild(img)

            addMark(el)
            markers.push(i)
            continue
        }

        if(c.TilemapCollider2D && c.CompositeCollider2D) {
            const it = c.CompositeCollider2D
            const el = createCollider(it, obj)
            if(el) {
                el.setAttribute('data-index', i)
                el.setAttribute('data-collider-layer', it.layer)
                addCollider(el)
            }
            continue
        }

        {
            const it = c.CompositeCollider2D ?? c.BoxCollider2D ?? c.CircleCollider2D ?? c.CapsuleCollider2D ?? c.PolygonCollider2D
            if(it && (obj.name === 'Wall' || it.layer == 17 || it.layer == 25) && obj.name != 'Movable') {
                const el = createCollider(it, obj)
                if(el) {
                    el.setAttribute('data-index', i)
                    el.setAttribute('data-collider-layer', it.layer)
                    addCollider(el)
                }
                continue
            }
        }
    }

    if(curColliderBatch) view.appendChild(curColliderBatch)
    if(curMarkBatch) view.appendChild(curMarkBatch)

    container.addEventListener('click', function(e) {
        const rect = view.getBoundingClientRect()
        const x = icx((e.clientX - rect.left) / scale)
        const y = icy((e.clientY - rect.top) / scale)

        var ca = new Array()
        for(let i = 0; i < 5; i++) {
            ca[i] = [-1, 1/0, -1]
        }


        for(let i = 0; i < markers.length; i++) {
            let objI = markers[i]
            let obj = objects[objI]
            let c = obj.components

            if(c.Enemy) {
                if(!testFiltersEnemy(c.Enemy, obj)) continue
            }
            if(c.Jar) {
                if(!testFiltersJar(c.Jar)) continue
            }
            if(c.CrystalDestroyable) {
                if(!testFiltersCrd(c.CrystalDestroyable)) continue
            }
            if(c.Transition) {
                if(!testFiltersTran(c.Transition)) continue
            }
            if(c.Scarab) {
                if(!testFiltersScarab(c.Scarab)) continue
            }

            var v = [objI, sqd(x, y, obj.pos[0], obj.pos[1])]
            for(let j = 0; j < ca.length; j++) {
                if(v[1] < ca[j][1]) {
                    var t = ca[j]
                    ca[j] = v
                    v = t
                }
            }
        }

        other.innerHTML = ''
        for(let i = 1; i < ca.length; i++) {
            if(ca[i][0] < 0) break
            other.appendChild(createObjectUrl(ca[i][0]))
            other.appendChild(document.createTextNode(` (away ${Math.round(Math.sqrt(ca[i][1]))})`))
            other.appendChild(document.createElement('br'))
        }

        if(ca[0][0] !== -1) {
            updProp(ca[0][0])
        }
    })

    title.addEventListener("change", (e) => {
        var newName = title.value
        for(let i = 0; i < objects.length; i++) {
            if(objects[i].name === newName) {
                updProp(i)
                return
            }
        }
        updProp(-1)
    })

    sizeDisplayUpdate.elements = view.querySelectorAll('.mark-batch')
    sizeDisplayUpdate.updateAll()
    requestAnimationFrame(update)

    const newI = getCurUrlI()
    updProp(newI)
    gotoObject()
})

updFilters()
updTransform()
updSize()
updProp(-1)
