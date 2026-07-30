import { mkdir, readFile, writeFile, access, stat } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { CatalogItem } from '@marginwatch/core'

export function dataDir() {
  return path.resolve(process.env.MARGINWATCH_DATA_DIR || '.marginwatch')
}

export function sessionPath(supplierId: string) {
  return path.join(dataDir(), 'sessions', `${supplierId}.json`)
}

export async function ensureDirs() {
  await mkdir(path.join(dataDir(), 'sessions'), { recursive: true })
  await mkdir(path.join(dataDir(), 'outbox'), { recursive: true })
  await mkdir(path.join(dataDir(), 'store'), { recursive: true })
}

export async function loadSessionIfFresh(supplierId: string, maxAgeMs = 12 * 60 * 60 * 1000) {
  const p = sessionPath(supplierId)
  try {
    const st = await stat(p)
    if (Date.now() - st.mtimeMs > maxAgeMs) return null
    await access(p)
    return p
  } catch {
    return null
  }
}

export async function saveSessionMeta(supplierId: string, filePath: string) {
  const raw = await readFile(filePath)
  const checksum = createHash('sha256').update(raw).digest('hex')
  await writeFile(
    path.join(dataDir(), 'sessions', `${supplierId}.meta.json`),
    JSON.stringify({ supplierId, path: filePath, checksum, updatedAt: new Date().toISOString() }, null, 2),
  )
}

export interface LocalStore {
  previous: CatalogItem[]
  runs: unknown[]
  changes: unknown[]
  alerts: unknown[]
  dedupe: string[]
}

export async function readStore(supplierId: string): Promise<LocalStore> {
  const p = path.join(dataDir(), 'store', `${supplierId}.json`)
  try {
    return JSON.parse(await readFile(p, 'utf8')) as LocalStore
  } catch {
    return { previous: [], runs: [], changes: [], alerts: [], dedupe: [] }
  }
}

export async function writeStore(supplierId: string, store: LocalStore) {
  const p = path.join(dataDir(), 'store', `${supplierId}.json`)
  await writeFile(p, JSON.stringify(store, null, 2))
}
