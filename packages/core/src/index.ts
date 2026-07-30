export type Direction = 'new' | 'unchanged' | 'increased' | 'decreased' | 'removed'

export interface CatalogItem {
  sku: string
  title: string
  price: number
  currency: string
}

export interface PriceChange {
  sku: string
  title: string
  currency: string
  oldPrice: number | null
  newPrice: number | null
  pctChange: number | null
  direction: Direction
}

export interface AlertPayload {
  supplierId: string
  supplierName: string
  sku: string
  title: string
  oldPrice: number
  newPrice: number
  pctChange: number
  currency: string
  runId: string
  catalogUrl?: string
}

export const DEFAULT_THRESHOLD = 0.05
export const PRODUCT = 'MarginWatch by KhyFee'

export function percentChange(oldPrice: number, newPrice: number): number {
  if (oldPrice === 0) return newPrice === 0 ? 0 : 1
  return (newPrice - oldPrice) / oldPrice
}

export function classifyChange(oldPrice: number | null, newPrice: number | null): Direction {
  if (oldPrice == null && newPrice != null) return 'new'
  if (oldPrice != null && newPrice == null) return 'removed'
  if (oldPrice == null || newPrice == null) return 'unchanged'
  if (newPrice > oldPrice) return 'increased'
  if (newPrice < oldPrice) return 'decreased'
  return 'unchanged'
}

export function detectChanges(
  previous: CatalogItem[],
  current: CatalogItem[],
): PriceChange[] {
  const prev = new Map(previous.map((p) => [p.sku, p]))
  const curr = new Map(current.map((c) => [c.sku, c]))
  const skus = new Set([...prev.keys(), ...curr.keys()])
  const out: PriceChange[] = []
  for (const sku of skus) {
    const a = prev.get(sku)
    const b = curr.get(sku)
    const oldPrice = a?.price ?? null
    const newPrice = b?.price ?? null
    const direction = classifyChange(oldPrice, newPrice)
    const pct =
      oldPrice != null && newPrice != null ? percentChange(oldPrice, newPrice) : null
    out.push({
      sku,
      title: b?.title || a?.title || sku,
      currency: b?.currency || a?.currency || 'USD',
      oldPrice,
      newPrice,
      pctChange: pct,
      direction,
    })
  }
  return out.sort((x, y) => x.sku.localeCompare(y.sku))
}

export function shouldAlert(change: PriceChange, threshold = DEFAULT_THRESHOLD): boolean {
  return (
    change.direction === 'increased' &&
    change.pctChange != null &&
    change.pctChange >= threshold &&
    change.oldPrice != null &&
    change.newPrice != null
  )
}

/** Bucket for alert dedupe: supplier+sku+day UTC */
export function alertDedupeKey(supplierId: string, sku: string, at = new Date()): string {
  const day = at.toISOString().slice(0, 10)
  return `${supplierId}|${sku}|${day}`
}

export function buildAlertMessage(p: AlertPayload): { subject: string; body: string } {
  const pct = (p.pctChange * 100).toFixed(1)
  const subject = `MarginWatch: ${p.sku} +${pct}% at ${p.supplierName}`
  const body = [
    PRODUCT,
    '',
    `Supplier: ${p.supplierName} (${p.supplierId})`,
    `SKU: ${p.sku} — ${p.title}`,
    `Price: ${p.oldPrice} → ${p.newPrice} ${p.currency} (+${pct}%)`,
    `Run: ${p.runId}`,
    p.catalogUrl ? `Catalog: ${p.catalogUrl}` : '',
    '',
    'This alert is deterministic automation — no AI.',
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, body }
}
