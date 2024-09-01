import meta from './data-processed/meta.json'
import * as load from './load.js'

export { meta }
export const parsedSchema = load.parseSchema(meta.schemas)

// class itself is also in the list!
const schemaBaseClasses = Array(meta.schemas.length)
for(let i = 0; i < schemaBaseClasses.length; i++) schemaBaseClasses[i] = {}

for(let i = 0; i < meta.schemas.length; i++) {
    let classI = i
    let baseC = 0
    while(classI != null) {
        schemaBaseClasses[i][classI] = baseC
        classI = meta.schemas[classI][2]?.base
        baseC++
    }
}

export function getAsSchema(it, schemaI) {
    var baseC = schemaBaseClasses[it._schema][schemaI]
    if(baseC == null) return
    for(; baseC > 0; baseC--) it = it._base
    return it
}

