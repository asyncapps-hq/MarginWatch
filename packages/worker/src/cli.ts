#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRODUCT } from '@marginwatch/core'
import { runSupplier } from './run.js'
import { dataDir, ensureDirs } from './store.js'

const [cmd, ...rest] = process.argv.slice(2)

async function main() {
  switch (cmd) {
    case 'doctor':
      return doctor()
    case 'run':
      return doRun(rest)
    case 'demo':
      return demo()
    case 'help':
    case undefined:
      return help()
    default:
      console.error(`Unknown: ${cmd}`)
      help()
      process.exit(3)
  }
}

function help() {
  console.log(`${PRODUCT}

Usage:
  marginwatch doctor
  marginwatch run [--supplier id]
  marginwatch demo
`)
}

async function doctor() {
  await ensureDirs()
  console.log(
    JSON.stringify(
      {
        banner: PRODUCT,
        node: process.version,
        dataDir: dataDir(),
        portalUrl: process.env.PORTAL_URL || 'http://127.0.0.1:4010',
        threshold: process.env.MARGINWATCH_THRESHOLD || '0.05',
        smtp: Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY),
        supabase: Boolean(process.env.SUPABASE_SECRET_KEY),
      },
      null,
      2,
    ),
  )
}

async function doRun(args: string[]) {
  let supplierId = 'demo-supplier'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--supplier') supplierId = args[++i] || supplierId
  }
  console.error(PRODUCT)
  const result = await runSupplier({ supplierId })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.status === 'ok' ? 0 : 2)
}

async function demo() {
  console.error(PRODUCT)
  console.error('Starting portal + seeding baseline + bumping price + scraping…')
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
  const portalEntry = path.join(root, 'apps', 'portal', 'src', 'server.ts')
  const portal = spawn(process.execPath, ['--import', 'tsx', portalEntry], {
    cwd: root,
    env: { ...process.env, PORT: '4010', PORTAL_USER: 'buyer', PORTAL_PASS: 'demo-pass' },
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: false,
  })
  await waitForPortal('http://127.0.0.1:4010/login')
  try {
    // baseline scrape
    await runSupplier({ baseUrl: 'http://127.0.0.1:4010' })
    // bump bolt price +10% via admin API-ish: login cookie dance with fetch is hard; use second scrape after mutate via page... 
    // ponytail: mutate store baseline then scrape after HTTP admin
    await bumpPriceViaHttp('SEA-BOLT-M6', 13.75)
    const result = await runSupplier({ baseUrl: 'http://127.0.0.1:4010' })
    console.log(JSON.stringify(result, null, 2))
    const alerted = result.alerts.length > 0
    if (!alerted) {
      console.error('Expected an alert for SEA-BOLT-M6 increase')
      process.exit(2)
    }
    console.error(`Demo OK — session reuse: first usedSession may be false, second=${result.usedSession || result.reauthed === false}`)
  } finally {
    portal.kill('SIGTERM')
  }
}

async function bumpPriceViaHttp(sku: string, price: number) {
  const login = await fetch('http://127.0.0.1:4010/login', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `username=buyer&password=demo-pass`,
  })
  const setCookie =
    typeof login.headers.getSetCookie === 'function'
      ? login.headers.getSetCookie()
      : [login.headers.get('set-cookie') || '']
  const cookie = setCookie.map((c) => c.split(';')[0]).filter(Boolean).join('; ')
  const res = await fetch('http://127.0.0.1:4010/admin/prices', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie,
    },
    body: `sku=${encodeURIComponent(sku)}&price=${price}`,
  })
  if (res.status >= 400) throw new Error(`bump failed: ${res.status}`)
}

async function waitForPortal(url: string) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(url)
      if (r.ok || r.status === 200) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('portal did not start')
}

main().catch((e) => {
  console.error(e)
  process.exit(3)
})
