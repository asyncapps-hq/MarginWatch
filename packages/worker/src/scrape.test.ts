import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scrapeStaticFixture } from './scrape.js'

test('static fixture scrape', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
  const html = path.join(root, 'fixtures', 'portal.html')
  const items = await scrapeStaticFixture(html)
  assert.ok(items.length >= 2)
  assert.equal(items[0]!.sku, 'SEA-BOLT-M6')
  assert.equal(items[0]!.price, 12.5)
})
