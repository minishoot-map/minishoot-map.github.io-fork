
function shouldResize(c) {
    const pw = Math.round(c.resizeData.prevCanvasSize[0])
    const ph = Math.round(c.resizeData.prevCanvasSize[1])

    const cw = Math.round(c.canvasSize[0])
    const ch = Math.round(c.canvasSize[1])

    if(cw !== pw || ch !== ph) {
        return [cw, ch]
    }
}

export function resize(context) {
    const resizeInfo = shouldResize(context)
    if(resizeInfo) {
        if(resizeInfo[0] >= 1 && resizeInfo[1] >= 1) {
            context.resizeData.prevCanvasSize[0] = context.canvasSize[0]
            context.resizeData.prevCanvasSize[1] = context.canvasSize[1]
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

function prepInfo(canvas, camera) {
    const rect = canvas.getBoundingClientRect()
    return {
        cx: rect.width * 0.5,
        cy: rect.height * 0.5,
        posX: camera.posX,
        posY: camera.posY,
        scale: camera.scale * 2 / rect.height,
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
        if(shouldResize(context)) context.render()
    }
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(canvas, {box: 'content-box'});

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault()

        const info = prepInfo(canvas, camera)

        const offsetX = xScreenToWorld(e.clientX, info)
        const offsetY = yScreenToWorld(e.clientY, info)

        const zoomFactor = 0.004
        var delta = 1 + Math.abs(e.deltaY) * -zoomFactor
        if(e.deltaY > 0) delta = 1 / delta

        const newScale = clampScale(camera.scale * delta, camera.scale)

        const tx = offsetX - (offsetX - camera.posX) * (newScale / camera.scale)
        const ty = offsetY - (offsetY - camera.posY) * (newScale / camera.scale)

        camera.scale = newScale
        camera.posX = tx
        camera.posY = ty
        context.scheduleRender()
    });

    var panning = { is: false, prevX: undefined, prevY: undefined }

    canvas.addEventListener('mousedown', (e) => {
        const info = prepInfo(canvas, camera)
        panning.is = true
        panning.prevX = xScreenToWorld(e.clientX, info)
        panning.prevY = yScreenToWorld(e.clientY, info)
    });

    canvas.addEventListener('mouseup', () => {
        panning.is = false
    });

    canvas.addEventListener('mousemove', (e) => {
        if(!panning.is) return
        const info = prepInfo(canvas, camera)

        const curX = xScreenToWorld(e.clientX, info)
        const curY = yScreenToWorld(e.clientY, info)

        camera.posX -= curX - panning.prevX
        camera.posY -= curY - panning.prevY
        context.scheduleRender()
    });
}
