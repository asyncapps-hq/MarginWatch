import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  alertDedupeKey,
  buildAlertMessage,
  detectChanges,
  percentChange,
  shouldAlert,
} from './index.js'

test('percent change', () => {
  assert.equal(percentChange(100, 110), 0.1)
  assert.equal(percentChange(100, 100), 0)
})

test('detect increase and alert threshold', () => {
  const changes = detectChanges(
    [{ sku: 'A1', title: 'Widget', price: 100, currency: 'USD' }],
    [{ sku: 'A1', title: 'Widget', price: 110, currency: 'USD' }],
  )
  assert.equal(changes[0]!.direction, 'increased')
  assert.equal(shouldAlert(changes[0]!, 0.05), true)
  assert.equal(shouldAlert(changes[0]!, 0.2), false)
})

test('new and removed', () => {
  const changes = detectChanges(
    [{ sku: 'OLD', title: 'x', price: 1, currency: 'USD' }],
    [{ sku: 'NEW', title: 'y', price: 2, currency: 'USD' }],
  )
  assert.ok(changes.find((c) => c.sku === 'NEW' && c.direction === 'new'))
  assert.ok(changes.find((c) => c.sku === 'OLD' && c.direction === 'removed'))
})

test('alert message + dedupe', () => {
  const msg = buildAlertMessage({
    supplierId: 'demo',
    supplierName: 'Demo Co',
    sku: 'A1',
    title: 'Widget',
    oldPrice: 100,
    newPrice: 110,
    pctChange: 0.1,
    currency: 'USD',
    runId: 'run1',
  })
  assert.match(msg.subject, /A1/)
  assert.match(msg.body, /100 → 110/)
  assert.equal(alertDedupeKey('demo', 'A1', new Date('2026-07-30T12:00:00Z')), 'demo|A1|2026-07-30')
})
