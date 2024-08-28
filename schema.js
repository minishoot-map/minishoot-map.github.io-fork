import meta from './data-processed/meta.json'
import * as load from './load.js'

export { meta }
export const parsedSchema = load.parseSchema(meta.schemas)

// class itself is also in the list!
const schemaSubclasses = Array(meta.schemas.length)
for(let i = 0; i < schemaSubclasses.length; i++) schemaSubclasses[i] = {}

for(let i = 0; i < meta.schemas.length; i++) {
    let classI = i
    let baseC = 0
    while(classI != null) {
        schemaSubclasses[classI][i] = baseC
        classI = meta.schemas[classI][2]?.base
        baseC++
    }
}

export function getAsSchema(it, schemaI) {
    var baseC = schemaSubclasses[schemaI][it._schema]
    if(baseC == null) return
    for(; baseC > 0; baseC--) it = it._base
    return it
}

