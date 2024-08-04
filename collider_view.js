const data = []

const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0,]
const counts2 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ]

const svgNS = "http://www.w3.org/2000/svg"
const styles = {
    0: "fill: #0a590360", // destroyable
    4: "fill: #6a97dd20", // water
    6: "fill: #35009920", // deep water
    14: "fill: #c14a0320", // wall
    16: "fill: #00000020", // hole
    17: "fill: #ff00ff40", // trigger?
    12: "fill: #f9000060", // enemy
    13: "fill: #f9000060", // enemy
    25: "fill: #4f3c0140", // bridge
    26: "fill: #f9005060", // enemy (stationary)
    23: "fill: #11656360", // static
    31: "fill: #11656360", // static
}
const fallbackStyle = "fill: #9400f920"

function addPath(it, obj, minx, miny, maxx, maxy, element) {
    const m = obj.matrix
    const width = maxx - minx, height = maxy - miny
    data.push(obj.pos)

    counts[it.type]++
    counts2[it.layer]++

    var el = document.createElement('span')
    el.setAttribute('data-index', it.objI)
    el.setAttribute('data-collider-layer', it.layer)
    el.classList.add('collider')
    el.style.transform = `matrix(${m[0]}, ${-m[3]}, ${m[1]}, ${-m[4]}, ${m[2] * dd}, ${-m[5] * dd})`

    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('width', '' + width)
    svg.setAttribute('height', '' + height)
    svg.setAttribute('viewBox', `${minx} ${miny} ${width} ${height}`);
    svg.style.left = minx + 'px'
    svg.style.top = miny + 'px'
    el.appendChild(svg)

    svg.appendChild(element)

    view.appendChild(el)
}

function addCollider(it, obj) {
    if(it.type == colliderTypes.composite) {
        const polygons = it.polygons

        let pathData = ''
        let minx = 1/0, maxx = -1/0, miny = 1/0, maxy = -1/0
        let hasPoints = false
        for(let j = 0; j < polygons.length; j++) {
            const points = polygons[j]

            for(let k = 0; k < points.length; k++) {
                const x = (points[k][0] + it.off[0]) * dd
                const y = (points[k][1] + it.off[1]) * dd
                minx = Math.min(minx, x)
                maxx = Math.max(maxx, x)
                miny = Math.min(miny, y)
                maxy = Math.max(maxy, y)
                hasPoints = true
                pathData += (k == 0 ? 'M' : 'L') + x + ' ' + y + ' '
            }
        }
        pathData += 'Z'
        if(!hasPoints) return

        const path = document.createElementNS(svgNS, 'path')
        path.setAttribute('d', pathData)
        path.setAttribute('fill-rule', 'evenodd')
        path.setAttribute('style', styles[it.layer] ?? fallbackStyle)

        addPath(it, obj, minx, miny, maxx, maxy, path)
    }
    else if(it.type == colliderTypes.polygon) {
        const polygon = it.polygon

        let pathData = ''
        let minx = 1/0, maxx = -1/0, miny = 1/0, maxy = -1/0
        let hasPoints = false
        for(let k = 0; k < polygon.length; k++) {
            const x = (polygon[k][0] + it.off[0]) * dd
            const y = (polygon[k][1] + it.off[1]) * dd
            minx = Math.min(minx, x)
            maxx = Math.max(maxx, x)
            miny = Math.min(miny, y)
            maxy = Math.max(maxy, y)
            hasPoints = true
            pathData += (k == 0 ? 'M' : 'L') + x + ' ' + y + ' '
        }
        pathData += 'Z'
        if(!hasPoints) return

        const path = document.createElementNS(svgNS, 'path')
        path.setAttribute('d', pathData)
        path.setAttribute('fill-rule', 'evenodd')
        path.setAttribute('style', styles[it.layer] ?? fallbackStyle)

        addPath(it, obj, minx, miny, maxx, maxy, path)
    }
    else if(it.type == colliderTypes.box) {
        var width = it.size[0] * dd, height = it.size[1] * dd
        var w2 = width * 0.5, h2 = height * 0.5

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", -w2 + it.off[0] * dd);
        rect.setAttribute("y", -h2 + it.off[1] * dd);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute('style', styles[it.layer] ?? fallbackStyle)

        addPath(it, obj, -w2 + it.off[0] * dd, -h2 + it.off[1] * dd, w2 + it.off[0] * dd, h2 + it.off[1] * dd, rect)
    }
    else if(it.type == colliderTypes.capsule) {
        var width = it.size[0] * dd, height = it.size[1] * dd
        var w2 = width * 0.5, h2 = height * 0.5
        var m = Math.max(width, height)

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", -w2 + it.off[0] * dd);
        rect.setAttribute("y", -h2 + it.off[1] * dd);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute('style', styles[it.layer] ?? fallbackStyle)
        rect.setAttribute('rx', m);
        rect.setAttribute('ry', m);

        addPath(it, obj, -w2 + it.off[0] * dd, -h2 + it.off[1] * dd, w2 + it.off[0] * dd, h2 + it.off[1] * dd, rect)
    }
    else if(it.type == colliderTypes.circle) {
        var r = it.radius * dd

        const circle = document.createElementNS(svgNS, 'circle')
        circle.setAttribute('cx', it.off[0] * dd)
        circle.setAttribute('cy', it.off[1] * dd)
        circle.setAttribute('r', r)
        circle.setAttribute('style', styles[it.layer] ?? fallbackStyle)

        addPath(it, obj, it.off[0] * dd - r, it.off[1] * dd - r, it.off[0] * dd + r, it.off[1] * dd + r, circle)
    }
}

/* if(obj.name == 'Movable') continue;
if(obj.allComponents.includes('SurfaceHandler')) continue;
if(obj.allComponents.includes('BiomeTrigger')) continue;
if(obj.name.startsWith('SurfaceColliders')) continue;
//if(obj.name.startsWith('Debris')) continue;
//if(obj.name.startsWith('CrystalHp')) continue;
if(obj.name.endsWith('(Clone)')) continue*/
