
function shouldResize(c) {
    const pw = Math.floor(c.resizeData.prevCanvasSize[0])
    const ph = Math.floor(c.resizeData.prevCanvasSize[1])

    const cw = Math.floor(c.canvasSize[0])
    const ch = Math.floor(c.canvasSize[1])

    if(cw !== pw || ch !== ph) {
        return [cw, ch]
    }
}

export function resize(context) {
    const resizeInfo = shouldResize(context)

    context.resizeData.prevCanvasSize[0] = context.canvasSize[0]
    context.resizeData.prevCanvasSize[1] = context.canvasSize[1]
    if(resizeInfo) {
        if(resizeInfo[0] >= 1 && resizeInfo[1] >= 1) {
            context.canvas.width = resizeInfo[0]
            context.canvas.height = resizeInfo[1]
            context.gl.viewport(0, 0, resizeInfo[0], resizeInfo[1])
            return true
        }
    }
    else if(context.canvasSize[0] >= 1 && context.canvasSize[1] >= 1) return true
}

var minScale = 0.1, maxScale = 10000
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

function prepInfo(bounds, camera) {
    return {
        cx: bounds.left + bounds.width * 0.5,
        cy: bounds.top + bounds.height * 0.5,
        posX: camera.posX,
        posY: camera.posY,
        scale: camera.scale * 2 / bounds.height,
    }
}
function xScreenToWorld(it, info) {
    return (it - info.cx) * info.scale + info.posX
}
function yScreenToWorld(it, info) {
    return -(it - info.cy) * info.scale + info.posY
}

export function setup(context) {
    const resizeData = {
        prevCanvasSize: [ -1, -1 ],
    }
    context.resizeData = resizeData

    const canvas = context.canvas
    const camera = context.camera

    // https://webgl2fundamentals.org/webgl/lessons/webgl-fundamentals.html
    function onResize(entries) {
        const entry = entries[0]
        if(entry == null) return
        var width
        var height
        var dpr = window.devicePixelRatio
        if (entry.devicePixelContentBoxSize) {
            width = entry.devicePixelContentBoxSize[0].inlineSize
            height = entry.devicePixelContentBoxSize[0].blockSize
            dpr = 1
        } else if (entry.contentBoxSize) {
            if (entry.contentBoxSize[0]) {
                width = entry.contentBoxSize[0].inlineSize
                height = entry.contentBoxSize[0].blockSize
            } else {
                width = entry.contentBoxSize.inlineSize
                height = entry.contentBoxSize.blockSize
            }
        } else {
            width = entry.contentRect.width
            height = entry.contentRect.height
        }
        context.canvasSize[0] = width * dpr
        context.canvasSize[1] = height * dpr
        if(shouldResize(context)) context.requestRender(0)
    }
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(canvas, {box: 'content-box'});

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault()

        const bounds = canvas.getBoundingClientRect()
        const info = prepInfo(bounds, camera)

        const offsetX = xScreenToWorld(e.clientX, info)
        const offsetY = yScreenToWorld(e.clientY, info)

        const zoomFactor = 0.004
        var delta = 1 + Math.abs(e.deltaY) * zoomFactor
        if(e.deltaY < 0) delta = 1 / delta

        const newScale = clampScale(camera.scale * delta, camera.scale)

        const tx = offsetX - (offsetX - camera.posX) * (newScale / camera.scale)
        const ty = offsetY - (offsetY - camera.posY) * (newScale / camera.scale)

        camera.scale = newScale
        camera.posX = tx
        camera.posY = ty
        context.requestRender(1)
    });

    var panning = { is: false, prevX: undefined, prevY: undefined }
    var touches = { order: [/*id*/], touches: {/*id: { prevX, prevY }*/} }

    canvas.addEventListener('click', (e) => {
        const bounds = canvas.getBoundingClientRect()
        const info = prepInfo(bounds, camera)
        const x = xScreenToWorld(e.clientX, info)
        const y = yScreenToWorld(e.clientY, info)

        context.onClick(x, y)
    })

    canvas.addEventListener('mousedown', (e) => {
        const bounds = canvas.getBoundingClientRect()
        const info = prepInfo(bounds, camera)
        panning.is = true
        panning.prevX = xScreenToWorld(e.clientX, info)
        panning.prevY = yScreenToWorld(e.clientY, info)
    });

    window.addEventListener('mouseup', (e) => {
        canvas.style.pointerEvents = ''
        panning.is = false
    })

    window.addEventListener('mousemove', (e) => {
        if(!panning.is) return
        // https://stackoverflow.com/a/59957886
        canvas.style.pointerEvents = 'none'
        const bounds = canvas.getBoundingClientRect()
        const info = prepInfo(bounds, camera)

        const curX = xScreenToWorld(e.clientX, info)
        const curY = yScreenToWorld(e.clientY, info)

        camera.posX -= curX - panning.prevX
        camera.posY -= curY - panning.prevY
        context.requestRender(1)
    });

    canvas.addEventListener('touchstart', function (e) {
        const bounds = canvas.getBoundingClientRect()
        const info = prepInfo(bounds, camera)

        for(var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i]
            if(touches.touches[t.identifier]) continue;
            touches.order.push(t.identifier)
            touches.touches[t.identifier] = {
                prevX: xScreenToWorld(t.clientX, info),
                prevY: yScreenToWorld(t.clientY, info),
            }
        }
    });

    canvas.addEventListener('touchmove', function (e) {
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

        const bounds = canvas.getBoundingClientRect()
        const info = prepInfo(bounds, camera)

        const touch1 = touches.touches[firstId]
        if(t2 == undefined) { // pan
            const curX = xScreenToWorld(t1.clientX, info)
            const curY = yScreenToWorld(t1.clientY, info)

            camera.posX -= curX - touch1.prevX
            camera.posY -= curY - touch1.prevY
            context.requestRender(1)
        }
        else {
            const touch2 = touches.touches[secondId]

            const curX1 = xScreenToWorld(t1.clientX, info)
            const curY1 = yScreenToWorld(t1.clientY, info)
            const curX2 = xScreenToWorld(t2.clientX, info)
            const curY2 = yScreenToWorld(t2.clientY, info)

            const preX1 = touch1.prevX
            const preY1 = touch1.prevY
            const preX2 = touch2.prevX
            const preY2 = touch2.prevY

            const dx = curX1 - curX2
            const dy = curY1 - curY2
            const pdx = preX1 - preX2
            const pdy = preY1 - preY2
            const preDist2 = pdx * pdx + pdy * pdy
            const curDist2 = dx * dx + dy * dy

            const preCenterX = (preX1 + preX2) * 0.5
            const preCenterY = (preY1 + preY2) * 0.5

            const curCenterX = (curX1 + curX2) * 0.5
            const curCenterY = (curY1 + curY2) * 0.5

            const delta = Math.sqrt(preDist2 / curDist2)
            const newScale = clampScale(camera.scale * delta, camera.scale)
            const newDelta = newScale / camera.scale

            camera.scale = newScale
            camera.posX = preCenterX - (curCenterX - camera.posX) * newDelta
            camera.posY = preCenterY - (curCenterY - camera.posY) * newDelta

            const info2 = prepInfo(bounds, camera)
            touch1.prevX = xScreenToWorld(t1.clientX, info2)
            touch1.prevY = yScreenToWorld(t1.clientY, info2)
            touch2.prevX = xScreenToWorld(t2.clientX, info2)
            touch2.prevY = yScreenToWorld(t2.clientY, info2)

            context.requestRender(1)
        }

        e.preventDefault()
    });

    canvas.addEventListener('touchend', function (e) {
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
}
