import type { UserConfig } from 'vite'
import { normalizePath } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default {
    plugins: [
        viteStaticCopy({
            targets: [
                { src: 'data-raw/objects/objects.bp', dest: 'data' },
                { src: 'data-raw/markers/markers.png', dest: 'data' },
                { src: 'data-processed/polygons.bp', dest: 'data' },
                { src: 'data-processed/backgrounds', dest: 'data' },
            ],
        })
    ]
} satisfies UserConfig
