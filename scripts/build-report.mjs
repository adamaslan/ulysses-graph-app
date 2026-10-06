#!/usr/bin/env node
// Usage: node scripts/build-report.mjs <dist> [baseDist]
// Prints a markdown table of built assets (raw + gzip), with deltas against
// baseDist when given. Also writes <dist>/build-info.json from GITHUB_* env.
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'

const [distDir, baseDir] = process.argv.slice(2)
if (!distDir || !existsSync(distDir)) {
  console.error(`dist directory not found: ${distDir}`)
  process.exit(1)
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

// Vite content-hashes filenames; strip the hash so base and head line up.
const stableName = (path) => path.replace(/-[A-Za-z0-9_]{8}(\.\w+)$/, '$1')

function collect(dir) {
  const sizes = new Map()
  for (const file of walk(dir)) {
    const rel = relative(dir, file)
    if (rel === 'build-info.json') continue
    const body = readFileSync(file)
    sizes.set(stableName(rel), {
      name: rel,
      raw: statSync(file).size,
      gzip: gzipSync(body).length,
    })
  }
  return sizes
}

const kb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`
const delta = (now, before) => {
  if (before === undefined) return 'new'
  const diff = now - before
  if (diff === 0) return '±0'
  return `${diff > 0 ? '+' : '−'}${kb(Math.abs(diff))}`
}

const head = collect(distDir)
const base = baseDir && existsSync(baseDir) ? collect(baseDir) : null

const rows = [...head.entries()].sort(([a], [b]) => a.localeCompare(b))
const lines = [
  `| Asset | Size | Gzip |${base ? ' Δ gzip |' : ''}`,
  `|---|---:|---:|${base ? '---:|' : ''}`,
]
let totalRaw = 0
let totalGzip = 0
let baseGzip = 0
for (const [key, asset] of rows) {
  totalRaw += asset.raw
  totalGzip += asset.gzip
  const before = base?.get(key)
  baseGzip += before?.gzip ?? 0
  lines.push(
    `| \`${asset.name}\` | ${kb(asset.raw)} | ${kb(asset.gzip)} |${base ? ` ${delta(asset.gzip, before?.gzip)} |` : ''}`,
  )
}
if (base) {
  for (const [key, asset] of base) {
    if (head.has(key)) continue
    baseGzip += asset.gzip
    lines.push(`| ~~\`${asset.name}\`~~ | – | – | removed |`)
  }
}
lines.push(
  `| **Total** | **${kb(totalRaw)}** | **${kb(totalGzip)}** |${base ? ` **${delta(totalGzip, baseGzip)}** |` : ''}`,
)
console.log(lines.join('\n'))

const env = process.env
writeFileSync(
  join(distDir, 'build-info.json'),
  JSON.stringify(
    {
      sha: env.GITHUB_SHA ?? null,
      ref: env.GITHUB_REF_NAME ?? null,
      runId: env.GITHUB_RUN_ID ?? null,
      runUrl:
        env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
          ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
          : null,
      builtAt: new Date().toISOString(),
      assets: rows.length,
      totalGzipBytes: totalGzip,
    },
    null,
    2,
  ) + '\n',
)
