import { chromium, type Page } from 'playwright'
import type { CatalogItem } from '@marginwatch/core'
import { ensureDirs, loadSessionIfFresh, saveSessionMeta, sessionPath } from './store.js'

export interface ScrapeConfig {
  supplierId: string
  baseUrl: string
  username: string
  password: string
}

async function needsLogin(page: Page) {
  if (page.url().includes('/login')) return true
  const catalog = page.getByTestId('catalog-table')
  return !(await catalog.count())
}

async function login(page: Page, cfg: ScrapeConfig) {
  await page.goto(new URL('/login', cfg.baseUrl).toString(), { waitUntil: 'domcontentloaded' })
  await page.getByTestId('username').fill(cfg.username)
  await page.getByTestId('password').fill(cfg.password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/catalog|\/$/, { timeout: 10_000 }).catch(() => undefined)
}

export async function scrapeCatalog(cfg: ScrapeConfig): Promise<{ items: CatalogItem[]; usedSession: boolean; reauthed: boolean }> {
  await ensureDirs()
  const statePath = sessionPath(cfg.supplierId)
  const existing = await loadSessionIfFresh(cfg.supplierId)
  let usedSession = Boolean(existing)
  let reauthed = false

  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext(existing ? { storageState: existing } : {})
    const page = await context.newPage()
    await page.goto(new URL('/catalog', cfg.baseUrl).toString(), { waitUntil: 'domcontentloaded' })

    if (await needsLogin(page)) {
      reauthed = true
      usedSession = false
      await login(page, cfg)
      if (await needsLogin(page)) {
        throw new Error('auth_failed')
      }
      await context.storageState({ path: statePath })
      await saveSessionMeta(cfg.supplierId, statePath)
    } else if (!existing) {
      await context.storageState({ path: statePath })
      await saveSessionMeta(cfg.supplierId, statePath)
    }

    await page.getByTestId('catalog-table').waitFor({ timeout: 10_000 })
    const items = await page.$$eval('[data-testid="sku-row"]', (rows) =>
      rows.map((row) => {
        const el = row as HTMLElement
        const priceText = el.querySelector('[data-testid="price"]')?.textContent || '0'
        return {
          sku: el.querySelector('[data-testid="sku"]')?.textContent?.trim() || '',
          title: el.querySelector('[data-testid="title"]')?.textContent?.trim() || '',
          price: Number(priceText.replace(/[^0-9.]/g, '')),
          currency: el.querySelector('[data-testid="currency"]')?.textContent?.trim() || 'USD',
        }
      }),
    )
    if (!items.length) throw new Error('parse_failed')
    return { items: items.filter((i) => i.sku), usedSession, reauthed }
  } finally {
    await browser.close()
  }
}

/** Smoke scrape against a static file:// fixture (no network). */
export async function scrapeStaticFixture(htmlPath: string): Promise<CatalogItem[]> {
  const { pathToFileURL } = await import('node:url')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(htmlPath).href)
    await page.getByTestId('login-submit').click()
    await page.getByTestId('catalog-table').waitFor({ state: 'visible' })
    const items = await page.$$eval('[data-testid="sku-row"]', (rows) =>
      rows.map((row) => {
        const el = row as HTMLElement
        return {
          sku: el.querySelector('[data-testid="sku"]')?.textContent?.trim() || '',
          title: el.querySelector('[data-testid="title"]')?.textContent?.trim() || '',
          price: Number((el.querySelector('[data-testid="price"]')?.textContent || '0').replace(/[^0-9.]/g, '')),
          currency: el.querySelector('[data-testid="currency"]')?.textContent?.trim() || 'USD',
        }
      }),
    )
    return items
  } finally {
    await browser.close()
  }
}
