#!/usr/bin/env node
/**
 * Merge card-id → relative path mappings into lib/card-art-manifest.json.
 *
 * Paths are relative to public/card-art/ (e.g. character folder + file).
 * Example map entry: "123": "bear/rare.webp"
 *
 * Usage:
 *   node scripts/link-card-art.mjs                    # merge scripts/card-art-map.partial.json if present
 *   node scripts/link-card-art.mjs path/to/map.json   # merge that file
 *
 * The partial map can contain only new/changed IDs; existing manifest keys are preserved
 * unless overwritten by the incoming file.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const manifestPath = join(root, 'lib/card-art-manifest.json')
const defaultPartial = join(root, 'scripts/card-art-map.partial.json')

const inputPath = process.argv[2] ?? (existsSync(defaultPartial) ? defaultPartial : null)

let existing = {}
try {
  existing = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch {
  existing = {}
}

if (!inputPath || !existsSync(inputPath)) {
  console.error(
    'No mapping file. Create scripts/card-art-map.partial.json (see scripts/card-art-map.example.json) or pass a path:\n' +
      '  node scripts/link-card-art.mjs ./my-map.json'
  )
  process.exit(1)
}

const incoming = JSON.parse(readFileSync(inputPath, 'utf8'))
const merged = { ...existing, ...incoming }
const sortedKeys = Object.keys(merged).sort((a, b) => Number(a) - Number(b))
const sorted = {}
for (const k of sortedKeys) sorted[k] = merged[k]

writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8')
console.log(`Updated ${manifestPath} (${Object.keys(sorted).length} entries).`)
