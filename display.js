var dedup = /^(.+?) [0-9]+/

var colliderTypes = { box: 0, capsule: 1, circle: 2, polygon: 3, composite: 4, tilemap: 5 }
var colliderNames = ['BoxCollider2D', 'CapsuleCollider2D', 'CircleCollider2D', 'PolygonCollider2D', 'CompositeCollider2D', 'TilemapCollider2D']

;(() => {
    for(let i = 0; i < objects.length; i++) {
        let it = objects[i]
        it.name = it[0]
        it.parentI = it[1]
        it.localPos = it[2]
        it.pos = it[3]
        it.rz = it[4]
        it.scale = it[5]
        it.allComponents = it[6]
        it.components = {}
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
        it.destObject = it[3]

        objects[it.objI].components['Transition'] = it
    }
})()

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
    if(obj.matrix != undefined) return obj.matrix

    var matrix = construct(obj)
    var pMatrix = updateTansform(obj.parentI)
    if(pMatrix != undefined) multiply(matrix, pMatrix)

    return obj.matrix = matrix
}

for(let i = 0; i < objects.length; i++) {
    updateTansform(i);
}

var view = document.getElementById('view')
var container = document.getElementById('map-cont')
var title = document.getElementById('name') // yay name is already taken
var lvl = document.getElementById('lvl')
var xp = document.getElementById('xp')
var desc = document.getElementById('desc')
var other = document.getElementById('other')

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
    "ow": [ -313.66262626262625, 288.7287878787879, 0.3206 / 0.7926341072858286 ],
    "d3": [ 739.7868686868687, 94.43989898989898, 0.13 / 0.7926341072858286 ]
}


;(() => {
    var maps = document.getElementById("maps")
    for (const child of maps.children) {
        var d = map_details[child.id]
        child.style.left = cx(d[0]) + "px"
        child.style.top = cy(d[1]) + "px"
        child.style.transform = `scale(${d[2] * dd})`
    }
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

var originX = -cx(-1) + 500, originY = -cy(34.44) - 500
var scale = 1

var panning = { is: false, prevX: undefined, prevY: undefined }
var touches = { order: [/*id*/], touches: {/*id: { prevX, prevY }*/} }

container.addEventListener('click', function(e) {
    const rect = view.getBoundingClientRect()
    const x = icx((e.clientX - rect.left) / scale)
    const y = icy((e.clientY - rect.top) / scale)

    ca = new Array()
    for(let i = 0; i < 5; i++) {
        ca[i] = [-1, 1/0, -1]
    }

    for(let i = 0; i < enemies.length; i++) {
        let it = enemies[i]
        let obj = objects[it.objI]
        if(!testFiltersEnemy(it, obj)) continue;
        var v = [i, sqd(x, y, obj.pos[0], obj.pos[1]), 0]
        for(let j = 0; j < ca.length; j++) {
            if(v[1] < ca[j][1]) {
                var t = ca[j]
                ca[j] = v
                v = t
            }
        }
    }

    for(let i = 0; i < jars.length; i++) {
        let it = jars[i]
        let obj = objects[it.objI]
        if(!testFiltersJar(it)) continue;
        var v = [i, sqd(x, y, obj.pos[0], obj.pos[1]), 1]
        for(let j = 0; j < ca.length; j++) {
            if(v[1] < ca[j][1]) {
                var t = ca[j]
                ca[j] = v
                v = t
            }
        }
    }

    var s = "Other markers nearby:\n"
    for(let i = 1; i < ca.length; i++) {
        let c = ca[i]
        if(c[2] == 0) {
            s += enemies[ca[i][0]].name + ` (away ${Math.round(Math.sqrt(ca[i][1]))})\n`
        }
        else {
            s += "jar " + c[0] + ` (away ${Math.round(Math.sqrt(ca[i][1]))})\n`
        }
    }

    if(ca[0][0] !== -1) {
        other.innerText = s
        if(ca[0][2] == 0) updProp(ca[0][0])
        else updJar(ca[0][0])
    }
});

title.addEventListener("change", (e) => {
    var newName = name.value
    for(let i = 0; i < enemies.length; i++) {
        if(enemies[i].name === newName) {
            updProp(i)
            break;
        }
    }
});

lvl.addEventListener("change", () => {
    if(curJ == 0) updProp(curI)
    else if(curJ == 1) updJar(curI)
})

function enemyLevel(e) {
    return 3 * (e.tier - 1) + e.size
}

var curI, curJ
function updProp(i) {
    curI = i
    curJ = 0

    var e = enemies[i]
    var o = objects[e.objI]
    title.value = o.name
    desc.innerText = "HP: " + e.hp + "\nSize: " + e.size + "\nTier: " + e.tier
    if(!lvl.value) lvl.value = "0"
    var level = +lvl.value
    xp.innerText = calcXp(e.size, enemyLevel(e), level)

    document.querySelectorAll('.selected').forEach((el) => { el.classList.remove('selected') })
    var el = document.querySelector('[data-enemy-index="' + i + '"]')
    if(el) {
        el.classList.add('selected')
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

function updJar(i) {
    curI = i
    curJ = 1

    var e = jars[i]
    title.value = "jar " + i
    desc.innerText = "Type: " + jarTypes[e.dropType] + getExtra(e) + "\nSize: " + e.size
    xp.innerText = 'N/A'

    document.querySelectorAll('.selected').forEach((el) => { el.classList.remove('selected') })
    var el = document.querySelector('[data-jar-index="' + i + '"]')
    if(el) {
        el.classList.add('selected')
    }
}

function updTransform() {
    view.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${originX}, ${originY})`
}

function updSize() {
    document.body.style.setProperty('--size2', dd + "px")
}

var filters = {
    enemies: false, e_name: false, e_name_text: "", e_size: false, e_size_text: 3, e_tier: false, e_tier_text: 1,
    jars: false, jars_t0: true, jars_t1: true, jars_t2: true, jars_t3: true, jars_t4: true, jars_t5: true, jars_t6: true,
    backg: true, coll: true, coll_0: true, coll_4: true, coll_6: true, coll_14: true, coll_16: true, coll_12: true, coll_13: true, coll_17: true, coll_23: true, coll_26: true, coll_31: true,

    coll_ui: false,
}
var coll_layers = [0, 4, 6, 14, 16, 12, 13, 17, 23, 26, 31]

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

    fe.backg = window['b-f']
    fe.coll = window['c-f']
    for(let coll_li of coll_layers) {
        fe['coll_' + coll_li] = window['c-f-' + coll_li]
    }

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

    if(!filters.backg) css += '#maps { display: none; }'
    if(!filters.coll) css += '[data-collider-layer] { display: none; }'
    for(let coll_li of coll_layers) {
        if(!filters['coll_' + coll_li]) css += '[data-collider-layer="' + coll_li + '"] { display: none; }'
    }


    filters_style.textContent = css;
}

updFilters()

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

var minScale = 0.1 / dd, maxScale = 100 / dd
function clampScale(scale, old) {
    if(scale != scale) return old;
    if(scale <= maxScale) {
        if(scale >= minScale) return scale
        else return minScale
    }
    else return maxScale
}

function hypot2(xd, yd) {
    var h = Math.hypot(xd, yd)
    if(h >= 0.0001) return h
    else return 0.0001
}


var Aall = {}

const svgNS = "http://www.w3.org/2000/svg"
const styles = {
    0: "fill: #0a590360", // destroyable
    4: "fill: #6a97dd20", // water
    6: "fill: #35009920", // deep water
    14: "fill: #c14a0320", // wall
    16: "fill: #00000020", // hole
    17: "fill: #6addd520", // trigger?
    12: "fill: #f9000060", // enemy
    13: "fill: #f9000060", // enemy
    26: "fill: #f9005060", // enemy (stationary)
    23: "fill: #11656360", // static
    31: "fill: #11656360", // static
}
const fallbackStyle = "fill: #9400f920"
function addPath(it, obj, minx, miny, maxx, maxy, pathData) {
    const m = obj.matrix
    const width = maxx - minx, height = maxy - miny

    var el = document.createElement('span')
    el.setAttribute('data-index', it.objI)
    el.setAttribute('data-collider-layer', it.layer)
    el.classList.add('collider')
    el.style.transform = `matrix(${m[0]}, ${-m[3]}, ${m[1]}, ${-m[4]}, ${m[2] * 100}, ${-m[5] * 100})`

    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('widrh', '' + width)
    svg.setAttribute('height', '' + height)
    svg.setAttribute('viewBox', `${minx} ${miny} ${width} ${height}`);
    svg.style.left = minx + 'px'
    svg.style.top = miny + 'px'
    el.appendChild(svg)

    const path = document.createElementNS(svgNS, 'path')
    path.setAttribute('d', pathData)
    path.setAttribute('fill-rule', 'evenodd')
    path.setAttribute('style', styles[it.layer] ?? fallbackStyle)
    svg.appendChild(path)

    view.appendChild(el)
}

;(() => {
    for(let i = 0; i < colliders.length; i++) {
        let it = colliders[i]
        let obj = objects[it.objI]

        Aall[it.layer] = true

        if(it.type == colliderTypes.composite) {
            const polygons = it.polygons

            let pathData = ''
            let minx = 1/0, maxx = -1/0, miny = 1/0, maxy = -1/0
            let hasPoints = false
            for(let j = 0; j < polygons.length; j++) {
                const points = polygons[j]

                for(let k = 0; k < points.length; k++) {
                    const x = (points[k][0] + it.off[0]) * 100
                    const y = (points[k][1] + it.off[1]) * 100
                    minx = Math.min(minx, x)
                    maxx = Math.max(maxx, x)
                    miny = Math.min(miny, y)
                    maxy = Math.max(maxy, y)
                    hasPoints = true
                    pathData += (k == 0 ? 'M' : 'L') + x + ' ' + y + ' '
                }
            }
            pathData += 'Z'
            if(!hasPoints) continue

            addPath(it, obj, minx, miny, maxx, maxy, pathData)
        }
        else if(it.type == colliderTypes.polygon) {
            const polygon = it.polygon

            let pathData = ''
            let minx = 1/0, maxx = -1/0, miny = 1/0, maxy = -1/0
            let hasPoints = false
            for(let k = 0; k < polygon.length; k++) {
                const x = (polygon[k][0] + it.off[0]) * 100
                const y = (polygon[k][1] + it.off[1]) * 100
                minx = Math.min(minx, x)
                maxx = Math.max(maxx, x)
                miny = Math.min(miny, y)
                maxy = Math.max(maxy, y)
                hasPoints = true
                pathData += (k == 0 ? 'M' : 'L') + x + ' ' + y + ' '
            }
            pathData += 'Z'
            if(!hasPoints) continue

            addPath(it, obj, minx, miny, maxx, maxy, pathData)
        }
        else if(false && it.type == colliderTypes.box) {
            var width = it.size[0], height = it.size[1]

            var el = document.createElement('span')
            el.setAttribute('data-index', it.objI)
            el.setAttribute('data-collider-layer', it.layer)
            el.classList.add('collider')
            el.style.left = cx(obj.pos[0] + minx + it.off[0]) + 'px'
            el.style.top = cy(obj.pos[1] + miny + it.off[1]) + 'px'

            const svg = document.createElementNS(svgNS, 'svg')
            svg.setAttribute('width', '' + width * dd)
            svg.setAttribute('height', '' + height * dd)
            svg.setAttribute('viewBox', `${-width*0.5} ${-height*0.5} ${width} ${height}`);
            el.appendChild(svg)

            const rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("x", -width*0.5);
            rect.setAttribute("y", -height*0.5);
            rect.setAttribute("width", width);
            rect.setAttribute("height", height);
            rect.setAttribute('style', styles[it.layer])
            svg.appendChild(rect)

            view.appendChild(el)
        }
    }

    for(let i = 0; i < enemies.length; i++) {
        let it = enemies[i]
        let obj = objects[it.objI]

        var el = document.createElement('span')
        el.classList.add('enemy')
        el.setAttribute('data-index', it.objI)
        el.setAttribute("data-enemy-index", i)
        el.setAttribute("data-enemy-name", obj.name)
        el.setAttribute("data-enemy-size", it.size)
        el.setAttribute("data-enemy-tier", it.tier)
        el.style.left = cx(obj.pos[0]) + 'px'
        el.style.top = cy(obj.pos[1]) + 'px'

        var img = document.createElement('img')
        img.src = 'data/sprites/' + textures[it.spriteI] + '.png'
        img.draggable = "false"
        el.appendChild(img)

        view.appendChild(el)
    }

    for(let i = 0; i < jars.length; i++) {
        let it = jars[i]
        let obj = objects[it.objI]

        var el = document.createElement('span')
        el.classList.add('enemy')
        el.setAttribute('data-index', it.objI)
        el.setAttribute("data-jar-index", i)
        el.setAttribute("data-jar-type", it.dropType)
        el.style.left = cx(obj.pos[0]) + 'px'
        el.style.top = cy(obj.pos[1]) + 'px'

        var img = document.createElement('img')
        img.src = 'data/sprites/' + textures[jarTexture] + '.png'
        img.draggable = "false"
        el.appendChild(img)

        view.appendChild(el)
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
        for(var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i]
            if(touches.touches[t.identifier]) continue;
            touches.order.push(t.identifier)
            touches.touches[t.identifier] = { prevX: t.clientX, prevY: t.clientY }
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

        const touch1 = touches.touches[firstId]
        if(t2 == undefined) { // pan
            const curX = t1.clientX
            const curY = t1.clientY

            originX += curX - touch1.prevX
            originY += curY - touch1.prevY
            updTransform()
        }
        else {
            const touch2 = touches.touches[secondId]

            const curX = t1.clientX
            const curY = t1.clientY
            const curX2 = t2.clientX
            const curY2 = t2.clientY

            const preX = touch1.prevX
            const preY = touch1.prevY
            const preX2 = touch2.prevX
            const preY2 = touch2.prevY

            const delta = hypot2(curX - curX2, curY - curY2) / hypot2(preX - preX2, preY - preY2)
            const newScale = clampScale(scale * delta, scale)

            const tx = curX - (preX - originX) * (newScale / scale)
            const ty = curY - (preY - originY) * (newScale / scale)

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

            touch.prevX = t.clientX
            touch.prevY = t.clientY
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
    });
})()

updTransform()
updSize()
