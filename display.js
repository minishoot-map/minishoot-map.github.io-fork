var minx = 1/0, maxx = -1/0, miny = 1/0, maxy = -1/0

var dedup = /^(.+?) [0-9]+/

var emenies = []
;(() => {
    for(let i = 0; i < data.length; i++) {
        let it = data[i]
        if(it.name.startsWith('Cave')) continue;
        emenies.push(it)

        minx = Math.min(minx, it.x)
        maxx = Math.max(maxx, it.x)
        miny = Math.min(miny, it.y)
        maxy = Math.max(maxy, it.y)
    }
})()

var view = document.getElementById('view')
var container = document.getElementById('cont')

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
    document.body.style.setProperty('--size2', 10 / Math.max(scale, 5) + "px")
}

function icx(i) {
    return (i - 5) / dd + minx;
}
function icy(i) {
    return maxy - (i - 5) / dd;
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

;(() => {
    for(let i = 0; i < emenies.length; i++) {
        let it = emenies[i]

        var img = document.createElement('img')
        img.src = 'sprites-dedup/' + it.dedup_name + '.png'
        img.title = it.name + ' (' + it.hp + 'hp)';
        img.draggable = "false"
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

    var originX = 0, originY = 0;
    var scale = 1;

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = view.getBoundingClientRect();
        const offsetX = originX + e.clientX - rect.left;
        const offsetY = originY + e.clientY - rect.top;

        const zoomFactor = 0.004;
        var delta = 1 + Math.abs(e.deltaY) * -zoomFactor;
        if(e.deltaY < 0) delta = 1 / delta

        const newScale = Math.min(Math.max(0.2, scale * delta), 25);

        const tx = offsetX + (originX - offsetX) * (newScale / scale)
        const ty = offsetY + (originY - offsetY) * (newScale / scale)

        scale = newScale;
        originX = tx;
        originY = ty;
        view.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${tx}, ${ty}`
        updSize(scale)
    });
    updSize(scale)

    let isPanning = false;
    let prevX, prevY;

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
