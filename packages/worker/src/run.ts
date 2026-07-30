import { randomUUID } from 'node:crypto'
import {
  DEFAULT_THRESHOLD,
  alertDedupeKey,
  detectChanges,
  shouldAlert,
  type CatalogItem,
} from '@marginwatch/core'
import { dispatchAlert } from './alerts.js'
import { scrapeCatalog } from './scrape.js'
import { ensureDirs, readStore, writeStore } from './store.js'

export interface RunResult {
  runId: string
  status: 'ok' | 'auth_failed' | 'parse_failed' | 'partial'
  itemCount: number
  changes: ReturnType<typeof detectChanges>
  alerts: Array<{ sku: string; channel: string; path?: string }>
  usedSession: boolean
  reauthed: boolean
  error?: string
}

export async function runSupplier(opts: {
  supplierId?: string
  supplierName?: string
  baseUrl?: string
  threshold?: number
}): Promise<RunResult> {
  await ensureDirs()
  const supplierId = opts.supplierId || 'demo-supplier'
  const supplierName = opts.supplierName || 'SEA Parts Demo'
  const baseUrl = (opts.baseUrl || process.env.PORTAL_URL || 'http://127.0.0.1:4010').replace(/\/$/, '')
  const threshold = opts.threshold ?? Number(process.env.MARGINWATCH_THRESHOLD || DEFAULT_THRESHOLD)
  const username = process.env.PORTAL_USER || 'buyer'
  const password = process.env.PORTAL_PASS || 'demo-pass'
  const runId = randomUUID()
  const store = await readStore(supplierId)

  try {
    const { items, usedSession, reauthed } = await scrapeCatalog({
      supplierId,
      baseUrl,
      username,
      password,
    })
    const changes = detectChanges(store.previous, items)
    const alerts: RunResult['alerts'] = []
    for (const c of changes) {
      if (!shouldAlert(c, threshold) || c.oldPrice == null || c.newPrice == null || c.pctChange == null) continue
      const key = alertDedupeKey(supplierId, c.sku)
      if (store.dedupe.includes(key)) continue
      const sent = await dispatchAlert({
        supplierId,
        supplierName,
        sku: c.sku,
        title: c.title,
        oldPrice: c.oldPrice,
        newPrice: c.newPrice,
        pctChange: c.pctChange,
        currency: c.currency,
        runId,
        catalogUrl: `${baseUrl}/catalog`,
      })
      store.dedupe.push(key)
      store.alerts.push({ ...c, ...sent, runId, at: new Date().toISOString() })
      alerts.push({ sku: c.sku, channel: sent.channel, path: sent.path })
    }
    store.previous = items
    store.changes.push(...changes.map((c) => ({ ...c, runId })))
    store.runs.push({
      runId,
      status: 'ok',
      itemCount: items.length,
      at: new Date().toISOString(),
      usedSession,
      reauthed,
    })
    await writeStore(supplierId, store)
    return { runId, status: 'ok', itemCount: items.length, changes, alerts, usedSession, reauthed }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = msg.includes('auth') ? 'auth_failed' : msg.includes('parse') ? 'parse_failed' : 'partial'
    store.runs.push({ runId, status, error: msg, at: new Date().toISOString() })
    await writeStore(supplierId, store)
    return {
      runId,
      status,
      itemCount: 0,
      changes: [],
      alerts: [],
      usedSession: false,
      reauthed: false,
      error: msg,
    }
  }
}

export function seedPrevious(items: CatalogItem[]) {
  return items
}
