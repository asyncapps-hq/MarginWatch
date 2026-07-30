import express from 'express'
import cookieParser from 'cookie-parser'

const PORT = Number(process.env.PORT || 4010)
const USER = process.env.PORTAL_USER || 'buyer'
const PASS = process.env.PORTAL_PASS || 'demo-pass'
const CHAOS = process.env.PORTAL_CHAOS === '1'

type Row = { sku: string; title: string; price: number; currency: string }

const catalog: Row[] = [
  { sku: 'SEA-BOLT-M6', title: 'M6 Stainless Bolt Pack', price: 12.5, currency: 'USD' },
  { sku: 'SEA-BRG-6204', title: 'Bearing 6204-2RS', price: 4.2, currency: 'USD' },
  { sku: 'SEA-CBL-USB', title: 'USB-C Cable 2m', price: 3.8, currency: 'USD' },
]

const sessions = new Set<string>()

function layout(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
body{font-family:Georgia,serif;margin:2rem;background:#f6f1e8;color:#1c1914}
input,button{font:inherit;padding:.5rem .7rem;margin:.25rem 0}
table{border-collapse:collapse;width:100%;background:#fff}
td,th{border:1px solid #ddd;padding:.5rem;text-align:left}
.brand{font-weight:800;letter-spacing:-.02em}
</style></head><body>
<p class="brand">SEA Parts Supplier Portal</p>
${body}
<p style="opacity:.6;font-size:.85rem">MarginWatch demo portal by KhyFee</p>
</body></html>`
}

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(cookieParser())

function authed(req: express.Request) {
  const sid = req.cookies?.mw_session
  return Boolean(sid && sessions.has(sid))
}

app.get('/', (_req, res) => res.redirect('/catalog'))

app.get('/login', (_req, res) => {
  res.type('html').send(
    layout(
      'Login',
      `<h1>Supplier login</h1>
<form method="post" action="/login" data-testid="login-form">
<label>User <input name="username" data-testid="username" value="${USER}"/></label><br/>
<label>Pass <input name="password" type="password" data-testid="password"/></label><br/>
<button type="submit" data-testid="login-submit">Sign in</button>
</form>`,
    ),
  )
})

app.post('/login', (req, res) => {
  const u = String(req.body.username || '')
  const p = String(req.body.password || '')
  if (u !== USER || p !== PASS) {
    res.status(401).type('html').send(layout('Login failed', '<p data-testid="login-error">Invalid credentials</p><a href="/login">Try again</a>'))
    return
  }
  const sid = `s_${Math.random().toString(36).slice(2)}`
  sessions.add(sid)
  res.cookie('mw_session', sid, { httpOnly: true, sameSite: 'lax' })
  res.redirect('/catalog')
})

app.post('/logout', (req, res) => {
  const sid = req.cookies?.mw_session
  if (sid) sessions.delete(sid)
  res.clearCookie('mw_session')
  res.redirect('/login')
})

app.get('/catalog', (req, res) => {
  if (!authed(req)) return res.redirect('/login')
  const priceClass = CHAOS ? 'cost-cell' : 'price'
  const rows = catalog
    .map(
      (r) =>
        `<tr data-testid="sku-row" data-sku="${r.sku}">
<td data-testid="sku">${r.sku}</td>
<td data-testid="title">${r.title}</td>
<td class="${priceClass}" data-testid="price">${r.price.toFixed(2)}</td>
<td data-testid="currency">${r.currency}</td>
</tr>`,
    )
    .join('')
  res.type('html').send(
    layout(
      'Catalog',
      `<h1 data-testid="catalog-heading">Wholesale catalog</h1>
<table data-testid="catalog-table">
<thead><tr><th>SKU</th><th>Title</th><th>Price</th><th>Currency</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p><a href="/admin/prices">Admin: mutate prices</a></p>`,
    ),
  )
})

app.get('/admin/prices', (req, res) => {
  if (!authed(req)) return res.redirect('/login')
  const rows = catalog
    .map(
      (r) =>
        `<tr>
<td>${r.sku}</td>
<td><form method="post" action="/admin/prices" style="display:flex;gap:.5rem;align-items:center">
<input type="hidden" name="sku" value="${r.sku}"/>
<input name="price" type="number" step="0.01" value="${r.price}" data-testid="admin-price-${r.sku}"/>
<button type="submit" data-testid="admin-save-${r.sku}">Save</button>
</form></td></tr>`,
    )
    .join('')
  res.type('html').send(layout('Admin prices', `<h1>Mutate prices (demo)</h1><table>${rows}</table>`))
})

app.post('/admin/prices', (req, res) => {
  if (!authed(req)) return res.redirect('/login')
  const sku = String(req.body.sku || '')
  const price = Number(req.body.price)
  const row = catalog.find((r) => r.sku === sku)
  if (row && Number.isFinite(price)) row.price = price
  res.redirect('/admin/prices')
})

app.get('/api/catalog.json', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' })
  res.json({ items: catalog })
})

app.listen(PORT, () => {
  console.error(`SEA Parts portal on http://127.0.0.1:${PORT} (user=${USER}) — MarginWatch by KhyFee`)
})
