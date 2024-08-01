var minx = 1/0, maxx = -1/0, miny = 1/0, maxy = -1/0

var dedup = /^(.+?) [0-9]+/

var enemies = data
;(() => {
    for(let i = 0; i < data.length; i++) {
        let it = data[i]

        minx = Math.min(minx, it.x)
        maxx = Math.max(maxx, it.x)
        miny = Math.min(miny, it.y)
        maxy = Math.max(maxy, it.y)
    }

    for(let i = 0; i < jars.length; i++) {
        let it = jars[i]
        it.x = it[0]
        it.y = it[1]
        it.size = it[2]
        it.type = it[3]

        minx = Math.min(minx, it.x)
        maxx = Math.max(maxx, it.x)
        miny = Math.min(miny, it.y)
        maxy = Math.max(maxy, it.y)
    }
})()

var view = document.getElementById('view')
var container = document.getElementById('map-cont')
var title = document.getElementById('name') // yay name is already taken
var lvl = document.getElementById('lvl')
var xp = document.getElementById('xp')
var desc = document.getElementById('desc')
var other = document.getElementById('other')

var mx = (maxx - minx)
var my = (maxy - miny)
var mm = Math.max(mx, my)
var dd = 99000 / mm

function cx(i) {
    return 5 + (i - minx) * dd
}
function cy(i) {
    return 5 + (maxy - i) * dd
}

function icx(i) {
    return (i - 5) / dd + minx;
}
function icy(i) {
    return maxy - (i - 5) / dd;
}

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

var originX = 0, originY = 0;
var scale = 0.01

let isPanning = false;
let prevX, prevY;


container.addEventListener('click', function(e) {
    const rect = view.getBoundingClientRect()
    const x = icx((e.clientX - rect.left) / scale)
    const y = icy((e.clientY - rect.top) / scale)

    ca = new Array()
    for(let i = 0; i < 5; i++) {
        ca[i] = [-1, 1/0, -1]
    }

    for(let i = 0; i < enemies.length; i++) {
        var v = [i, sqd(x, y, enemies[i].x, enemies[i].y), 0]
        for(let j = 0; j < ca.length; j++) {
            if(v[1] < ca[j][1]) {
                var t = ca[j]
                ca[j] = v
                v = t
            }
        }
    }

    for(let i = 0; i < jars.length; i++) {
        var v = [i, sqd(x, y, jars[i].x, jars[i].y), 1]
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

    other.innerText = s
    if(ca[0][2] == 0) updProp(ca[0][0])
    else updJar(ca[0][0])
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
    title.value = e.name
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
    if(e.type == 1) extra = e.size - 1
    if(e.type == 2) extra = "15% hp, 15% 1-9 xp, 15% 2-4 energy"
    if(e.type == 3) extra = (e.size - 1) * 2
    if(e.type == 4) extra = "3-5"
    return extra !== undefined ? ' (' + extra + ')' : ''
}

function updJar(i) {
    curI = i
    curJ = 1

    var e = jars[i]
    title.value = "jar " + i
    desc.innerText = "Type: " + jarTypes[e.type] + getExtra(e) + "\nSize: " + e.size
    xp.innerText = 'N/A'

    document.querySelectorAll('.selected').forEach((el) => { el.classList.remove('selected') })
    var el = document.querySelector('[data-jar-index="' + i + '"]')
    if(el) {
        el.classList.add('selected')
    }
}

function updTransform() {
    view.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${originX}, ${originY}`
}

function updSize() {
    document.body.style.setProperty('--size2', 1000 / Math.max(scale * 100, 9900 / mm) + "px")
}

var filters = {
    enemies: true, e_name: false, e_name_text: "", e_size: false, e_size_text: 3, e_tier: false, e_tier_text: 1,
    jars: true, jars_t0: true, jars_t1: true, jars_t2: true, jars_t3: true, jars_t4: true, jars_t5: true, jars_t6: true
}
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
    if(filters.e_name) css += '[data-enemy-name]:not([data-enemy-name*="' + filters.e_name_text.replace(/[^a-zA-Z0-9-\s]/g, '') + '"]) { display: none; }'
    if(filters.e_size) css += '[data-enemy-size]:not([data-enemy-size="' + filters.e_size_text + '"]) { display: none; }'
    if(filters.e_tier) css += '[data-enemy-tier]:not([data-enemy-tier="' + filters.e_tier_text + '"]) { display: none; }'
    if(!filters.jars) css += '[data-jar-index] { display: none; }'

    for(let i = 0; i < 7; i++) {
        if(!filters["jars_t" + i]) css += '[data-jar-type="' + i + '"] { display: none; }'
    }

    filters_style.textContent = css;
}

;(() => {
    for(let i = 0; i < enemies.length; i++) {
        let it = enemies[i]

        var el = document.createElement('span')
        el.classList.add('enemy')
        el.setAttribute("data-enemy-index", i)
        el.setAttribute("data-enemy-name", it.name)
        el.setAttribute("data-enemy-size", it.size)
        el.setAttribute("data-enemy-tier", it.tier)
        el.style.left = cx(it.x) + 'px'
        el.style.top = cy(it.y) + 'px'

        var img = document.createElement('img')
        img.title = it.name + ' (' + it.hp + 'hp)';
        img.src = 'sprites-dedup/' + it.dedup_name + '.png'
        img.draggable = "false"
        el.appendChild(img)

        view.appendChild(el)
    }

    for(let i = 0; i < jars.length; i++) {
        let it = jars[i]

        var dot = document.createElement('span')
        dot.classList.add('dot')
        dot.setAttribute("data-jar-index", i)
        dot.setAttribute("data-jar-type", it.type)
        dot.style.left = cx(it.x) + 'px'
        dot.style.top = cy(it.y) + 'px'
        view.appendChild(dot)
    }


    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = view.getBoundingClientRect();
        const offsetX = originX + e.clientX - rect.left;
        const offsetY = originY + e.clientY - rect.top;

        const zoomFactor = 0.004;
        var delta = 1 + Math.abs(e.deltaY) * -zoomFactor;
        if(e.deltaY < 0) delta = 1 / delta

        const newScale = Math.min(Math.max(0.01, scale * delta), 0.35);

        const tx = offsetX + (originX - offsetX) * (newScale / scale)
        const ty = offsetY + (originY - offsetY) * (newScale / scale)

        scale = newScale;
        originX = tx;
        originY = ty;
        updTransform()
        updSize()
    });

    container.addEventListener('mousedown', (e) => {
        isPanning = true;
        prevX = e.clientX
        prevY = e.clientY
    });

    container.addEventListener('mouseup', () => {
        isPanning = false;
    });

    container.addEventListener('mousemove', (e) => {
        if (isPanning) {
            var curX = e.clientX
            var curY = e.clientY

            originX = originX + (curX - prevX)
            originY = originY + (curY - prevY)

            updTransform()
            prevX = curX
            prevY = curY
        }
    });

    view.addEventListener('mouseleave', () => {
        isPanning = false;
    });
})()

updTransform()
updSize()
