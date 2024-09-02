import { defineConfig } from 'vite'
import { normalizePath } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import ViteRestart from 'vite-plugin-restart'

import json5 from 'json5'

import { join } from 'node:path'
import * as fs from 'node:fs'

const configPath = './config.json'

var userDefsS
try {
    userDefsS = fs.readFileSync(configPath)
}
catch(e) {
    console.warn('Config is not defined. Defaults will be used')
    userDefs = {}
}

var userDefs = {}
try {
    if(userDefsS) userDefs = json5.parse(userDefsS)
}
catch(e) {
    console.warn('Could not parse config. Defaults will be used')
    console.warn(e)
}

var defaultDefs = {
    __use_default_in_builds: true,

    worker: true,

    worker_markers: true,
    worker_colliders: true,

    setup_markers: true,
    setup_colliders: true,
    setup_circular: true,

    render_markers: true,
    render_colliders: true,
    render_circular: true,

    backgrounds_setup_images: true,
    backgrounds_mipmap_levels: 10,

    markers_mipmap_levels: 6,
}

var defines = {}
for(const k in defaultDefs) {
    const v = userDefs[k] ?? defaultDefs[k]
    defines[k] = v
}

export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => {
    const useDefault = defines.__use_default_in_builds
    if(command === 'build' && useDefault) {
        console.warn('Using default config for build')
        defines = { ...defaultDefs }
    }
    for(const k in defines) defines['__' + k] = JSON.stringify(defines[k])
    delete defines.__use_default_in_builds

    return {
        root: './src',
        build: { outDir: '../dist', emptyOutDir: true },
        define: defines,
        plugins: [
            viteStaticCopy({
                targets: [
                    { src: 'data-raw/objects/objects.bp', dest: 'data' },
                    { src: 'data-raw/markers/markers.png', dest: 'data' },
                    { src: 'data-processed/polygons.bp', dest: 'data' },
                    { src: 'data-processed/backgrounds', dest: 'data' },
                ],
            }),
            ViteRestart({
                restart: [configPath]
            }),
        ],
    }
})
