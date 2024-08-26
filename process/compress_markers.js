// See for generating the atlas: https://free-tex-packer.com/app/
const fs = require('fs')
var data = fs.readFileSync('../data/markers.json')
data = JSON.parse(data).frames

var res = {}
for(const name in data) {
    const m = data[name]
    res[name] = [m.frame.x, m.frame.y, m.frame.w, m.frame.h]
    if(m.pivot.x != 0.5 || m.pivot.y != 0.5) throw 'Not implemented'
    if(m.trimmed) throw 'Trim not supported'
}
res = 'var markerData = ' + JSON.stringify(res)
fs.writeFileSync('../markers.js', res, 'utf-8')
console.log('Done!')
