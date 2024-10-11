import * as v0 from './v0/schema.js'
import * as v1 from './v1/schema.js'

import * as lv0 from './v0/load.js'
import * as lv1 from './v1/load.js'

function findObj(obj, test, out) {
    if(test(obj, obj)) out.push(obj)
    obj.children.forEach(child => findObj(child, test, out))
}

window.schema = v1
window.sc = v1.meta.schemas
window.findObj = (test) => {
    const out = []
    for(let i = 0; i < window.it.length; i++) {
        const r = window.it[i].roots
        for(let j = 0; j < r.length; j++) {
            findObj(r[j], test, out)
        }
    }
    return out
}

const t1p = fetch('./v0/objects.bp').then(content => content.arrayBuffer()).then(content => {
    return lv0.parse(v0.parsedSchema, new Uint8Array(content))
})
const t2p = fetch('./v1/objects.bp').then(content => content.arrayBuffer()).then(content => {
    return lv1.parse(v1.parsedSchema, new Uint8Array(content))
})

const [t1, t2] = await Promise.all([t1p, t2p])
window.it = t1
console.log('done!')
console.log(t1)
console.log(t2)

function type(v) {
    if(Array.isArray(v)) return 0
    else if(typeof(v) == 'object') return 1
    else return 2
}
const errors = []
function checkArr(a, b, prefix) {
    if(a.length !== b.length) {
        errors.push(prefix + ' - different length: ' + a.length + ', ' + b.length)
        throw 0
    }

    let error = false
    for(let i = 0; i < a.length; i++) {
        try {
            check(a[i], b[i], prefix + '[' + i + ']')
        }
        catch(e) {
            if(e !== 0) throw e
            error = true
        }
    }
    if(error) throw 0
}
function check(a, b, prefix) {
    const ta = type(a), tb = type(b)
    if(ta !== tb) {
        errors.push(prefix + ' - difference in types: ' + ta + ', ' + tb)
        throw 0
    }
    if(ta == 0) {
        checkArr(a, b, prefix)
    }
    else if(ta == 1) {
        const ka = Object.keys(a)
        const kb = Object.keys(b)
        checkArr(ka, kb, prefix + '[keys: ' + ka + ', ' + kb + ']')
        let error = false
        for(let i = 0; i < ka.length; i++) {
            const k = ka[i]
            try {
                check(a[k], b[k], prefix + '.' + k)
            }
            catch(e) {
                if(e !== 0) throw e
                error = true
            }
        }
        if(error) throw 0
    }
    else {
        if(a !== b) {
            errors.push(prefix + ' - different values: ' + a + ', ' + b)
            throw 0
        }
    }
}
try {
    check(t1, t2, 'ROOTS')
}
catch(e) {
    if(e !== 0) console.error(e)
}

if(errors.length == 0) {
    document.body.append(document.createTextNode('no errors!'))
}
errors.forEach(e => {
    it = document.createElement('div')
    it.append(document.createTextNode(e))
    document.body.append(it)
})
