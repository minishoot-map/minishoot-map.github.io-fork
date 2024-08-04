var colliderTypes = { box: 0, capsule: 1, circle: 2, polygon: 3, composite: 4, tilemap: 5 }
var colliderNames = ['BoxCollider2D', 'CapsuleCollider2D', 'CircleCollider2D', 'PolygonCollider2D', 'CompositeCollider2D', 'TilemapCollider2D']

var locations = ["Overworld", "Cave", "CaveExtra", "Dungeon1", "Dungeon2", "Dungeon3", "Dungeon4", "Dungeon5", "Temple1", "Temple2", "Temple3", "Tower", "CaveArena", "Snow"]

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
        it.size = it[2] - 1 // HACK: turns out Size and size in CrystalDestroyable are different... why???

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
        it.destObjectI = it[3]

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
    if(obj.matrix) return obj.matrix

    var matrix = construct(obj)
    var pMatrix = updateTansform(obj.parentI)
    if(pMatrix) multiply(matrix, pMatrix)

    return obj.matrix = matrix
}

for(let i = 0; i < objects.length; i++) {
    updateTansform(i);
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

        var v = [objI, sqd(x, y, obj.pos[0], obj.pos[1])]
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
        updProp(ca[0][0])
    }
});

title.addEventListener("change", (e) => {
    var newName = name.value
    for(let i = 0; i < enemies.length; i++) {
        if(objects[i].name === newName) {
            updProp(i)
            break;
        }
    }
});

function enemyLevel(e) {
    return 3 * (e.tier - 1) + e.size
}

var curI
function updProp(i) {
    curI = i

    document.querySelectorAll('.selected').forEach((el) => { el.classList.remove('selected') })
    var el = document.querySelector('[data-index="' + i + '"]')
    if(el) {
        el.classList.add('selected')
    }

    const o = objects[i]
    title.value = o.name
    let descText = 'Position: (' + o.pos[0] + ', ' + o.pos[1] + ')<br>Components:'
    for(let i = 0; i < o.allComponents.length; i++) {
        descText += '<br><span class="gap"></span>' + o.allComponents[i]
    }
    desc.innerHTML = descText

    c_enemy.style.display = 'none'
    c_jar.style.display = 'none'
    c_crd.style.display = 'none'
    c_tran.style.display = 'none'

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
        const dest = objects[it.destObjectI]
        if(dest) {
            const di = it.destObjectI
            const url = document.createElement('a')
            url.href = 'javascript:void(0);'
            url.addEventListener('click', () => {
                other.innerText = ''
                updProp(di)
            })
            url.innerText = dest.name || '<No name>'
            desc.appendChild(url)
        }
        else {
            dest.innerText += '<Unknown>'
        }
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

document.body.style.setProperty('--size2', dd + "px")

function updSize() { }

var filters = {
    enemies: true, e_name: false, e_name_text: "", e_size: false, e_size_text: 3, e_tier: false, e_tier_text: 1,
    jars: true, jars_t0: true, jars_t1: true, jars_t2: true, jars_t3: true, jars_t4: true, jars_t5: true, jars_t6: true,
    crd_y_f: true, crd_n_f: true,
    backg: true, coll: true, coll_4: true, coll_6: true, coll_14: true, coll_16: true, coll_17: false, coll_25: true,
    tran: true, tran_l: false,
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

    fe.tran = window['tran-f']
    fe.tran_l = window['tran-f-l']

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

    if(!filters.tran) css += '[data-transition] { display: none; }'
    if(!filters.tran_l) css += '[data-transition-line] { display: none; }'

    if(!filters.coll) css += '[data-collider-layer] { display: none; }'
    for(let coll_li of coll_layers) {
        if(!filters['coll_' + coll_li]) css += '[data-collider-layer="' + coll_li + '"] { display: none; }'
    }
    if(!filters.backg) css += '#maps { display: none; }'


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

function testFiltersCrd(it) {
    if(it.dropXp) return filters.crd_y_f;
    else return filters.crd_n_f;
}

function testFiltersTran(it) {
    return filters.tran
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

var markers = []

;(() => {
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
            img.draggable = "false"
            el.appendChild(img)

            view.appendChild(el)
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
            img.draggable = "false"
            el.appendChild(img)

            view.appendChild(el)
            markers.push(i)
            continue
        }

        if(c.CrystalDestroyable) {
            const it = c.CrystalDestroyable

            var el = document.createElement('span')
            el.classList.add('mark', 'mark-crd')
            el.setAttribute('data-index', i)
            el.setAttribute("data-crd-index", i)
            el.setAttribute("data-crd-type", it.dropXp ? 1 : 0)
            el.style.setProperty('--crystal-size', 1 + 0.5 * it.size)
            el.style.left = cx(obj.pos[0]) + 'px'
            el.style.top = cy(obj.pos[1]) + 'px'

            var img = document.createElement('img')
            img.src = 'data/sprites/' + (it.dropXp ? textures[crystalDestroyableTexture] : textures[crystalDestroyableTexture2]) + '.png'
            img.draggable = "false"
            el.appendChild(img)

            view.appendChild(el)
            markers.push(i)
            continue
        }

        if(c.Transition) {
            const it = c.Transition

            const itc = c.CompositeCollider2D ?? c.BoxCollider2D ?? c.CircleCollider2D ?? c.CapsuleCollider2D ?? c.PolygonCollider2D
            if(itc) {
                let coll = createCollider(itc, obj)
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

                view.appendChild(el)
                markers.push(i)
            }
        }

        if(c.TilemapCollider2D && c.CompositeCollider2D) {
            const it = c.CompositeCollider2D
            const el = createCollider(it, obj)
            if(el) {
                el.setAttribute('data-index', i)
                el.setAttribute('data-collider-layer', it.layer)
                view.appendChild(el)
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
                    view.appendChild(el)
                }
                continue
            }
        }
    }

    for(let i = 0; i < jars.length; i++) {
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
