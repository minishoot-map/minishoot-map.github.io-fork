const colliderColors = {
    0 : "0a590320", // destroyable (no)
    4 : "6a97dd20", // water
    6 : "35009920", // deep water
    12: "f9000040", // enemy
    13: "f9000040", // enemy
    14: "c14a0320", // wall
    16: "02002020", // hole
    17: "ff00ff30", // trigger?
    23: "11656360", // static
    25: "4f3c0140", // bridge
    26: "f9005040", // enemy (stationary)
    31: "11656360", // static
    fallback: "9400f920"
}

let colliderColorsS = 'const vec4 layerColors[32] = vec4[32]('
for(let i = 0; i < 32; i++) {
    const c = colliderColors[i] ?? colliderColors.fallback
    let r = parseInt(c.slice(0, 2), 16) / 255
    let g = parseInt(c.slice(2, 4), 16) / 255
    let b = parseInt(c.slice(4, 6), 16) / 255
    let a = parseInt(c.slice(6, 8), 16) / 255
    if(i != 0) colliderColorsS += ',\n'
    colliderColorsS += `vec4(${r}, ${g}, ${b}, ${a})`
}
colliderColorsS += ');';

export default colliderColorsS
