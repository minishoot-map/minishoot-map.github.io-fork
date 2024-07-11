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
var dd = 990 / mm

function cx(i) {
    return 5 + (i - minx) * dd
}
function cy(i) {
    return 5 + (maxy - i) * dd
}

function updSize(scale) {
    document.body.style.setProperty('--size2', 10 / Math.max(scale, 15 * dd) + "px")
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
var scale = 1;

let isPanning = false;
let prevX, prevY;


container.addEventListener('click', function(e) {
    const rect = view.getBoundingClientRect()
    const x = icx((e.clientX - rect.left) / scale)
    const y = icy((e.clientY - rect.top) / scale)

    ca = new Array()
    for(let i = 0; i < 5; i++) {
        ca[i] = [-1, 1/0]
    }

    for(let i = 0; i < enemies.length; i++) {
        var v = [i, sqd(x, y, enemies[i].x, enemies[i].y)]
        for(let j = 0; j < ca.length; j++) {
            if(v[1] < ca[j][1]) {
                var t = ca[j]
                ca[j] = v
                v = t
            }
        }
    }

    var s = "Other enemies nearby:\n"
    for(let i = 1; i < ca.length; i++) {
        s += enemies[ca[i][0]].name + ` (away ${Math.round(Math.sqrt(ca[i][1]))})\n`
    }

    other.innerText = s
    updProp(ca[0][0])
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

lvl.addEventListener("change", () => { updProp(curI) })

function enemyLevel(e) {
    return 3 * (e.tier - 1) + e.size
}

var curI
function updProp(i) {
    curI = i
    var e = enemies[i]
    title.value = e.name
    desc.innerText = "HP: " + e.hp + "\nSize: " + e.size + "\nTier: " + e.tier
    if(!lvl.value) lvl.value = "1"
    var level = +lvl.value
    xp.innerText = calcXp(e.size, enemyLevel(e), level)

    document.querySelectorAll('.selected').forEach((el) => { el.classList.remove('selected') })
    var el = document.querySelector('[data-index="' + i + '"]')
    if(el) {
        el.classList.add('selected')
    }
}

;(() => {
    for(let i = 0; i < enemies.length; i++) {
        let it = enemies[i]

        var img = document.createElement('img')
        img.src = 'sprites-dedup/' + it.dedup_name + '.png'
        img.title = it.name + ' (' + it.hp + 'hp)';
        img.draggable = "false"
        img.setAttribute("data-index", i)
        // + ' (' + it.x + ', ' + it.y + ')';
        let x = cx(it.x);
        let y = cy(it.y);
        img.style.left = x + 'px'
        img.style.top = y + 'px'
        img.classList.add('enemy')
        if(x < 0 || x > 1000) console.log("x", x)
        if(y < 0 || y > 1000) console.log("y", y)
        view.appendChild(img)
    }


    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = view.getBoundingClientRect();
        const offsetX = originX + e.clientX - rect.left;
        const offsetY = originY + e.clientY - rect.top;

        const zoomFactor = 0.004;
        var delta = 1 + Math.abs(e.deltaY) * -zoomFactor;
        if(e.deltaY < 0) delta = 1 / delta

        const newScale = Math.min(Math.max(0.2, scale * delta), 35);

        const tx = offsetX + (originX - offsetX) * (newScale / scale)
        const ty = offsetY + (originY - offsetY) * (newScale / scale)

        scale = newScale;
        originX = tx;
        originY = ty;
        view.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${tx}, ${ty}`
        updSize(scale)
    });
    updSize(scale)


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

            view.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${originX}, ${originY}`
            prevX = curX
            prevY = curY
        }
    });

    view.addEventListener('mouseleave', () => {
        isPanning = false;
    });
})()
