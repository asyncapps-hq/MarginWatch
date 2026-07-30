import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import Link from 'next/link'

function loadStore() {
  const candidates = [
    path.resolve(process.cwd(), '../../.marginwatch/store/demo-supplier.json'),
    path.resolve(process.cwd(), '.marginwatch/store/demo-supplier.json'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, 'utf8')) as {
          runs: Array<{ runId: string; status: string; itemCount: number; at: string }>
          changes: Array<{ sku: string; direction: string; pctChange: number | null; oldPrice: number | null; newPrice: number | null }>
          alerts: Array<{ sku: string; channel: string; path?: string }>
          previous: Array<{ sku: string; price: number }>
        }
      } catch {
        /* continue */
      }
    }
  }
  return { runs: [], changes: [], alerts: [], previous: [] }
}

export default function HomePage() {
  const store = loadStore()
  const increases = store.changes.filter((c) => c.direction === 'increased').slice(-10).reverse()
  const runs = [...store.runs].slice(-5).reverse()
  return (
    <div className="wrap">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="logo">
          Margin<span>Watch</span>
        </div>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/runs">Runs</Link>
          <a className="btn" href="https://github.com/KhyFee/MarginWatch">
            GitHub
          </a>
        </nav>
      </header>
      <section style={{ padding: '2.5rem 0 1rem' }}>
        <p className="muted">B2B Supplier Portal Automator</p>
        <h1 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(2rem,5vw,3.2rem)', margin: '.3rem 0 1rem' }}>
          Catch supplier price shifts before they eat your margin.
        </h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          Playwright logs into supplier portals with cookie session reuse, diffs prices in Postgres, and emails when
          increases exceed 5%. Deterministic — no AI.
        </p>
        <pre className="panel">{`npx marginwatch demo
# bump price → scrape → .marginwatch/outbox/*.eml`}</pre>
      </section>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Recent increases</h2>
        {increases.length === 0 ? (
          <p className="muted">No local runs yet. Run <code>marginwatch demo</code>.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Old</th>
                <th>New</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {increases.map((c, i) => (
                <tr key={i}>
                  <td>{c.sku}</td>
                  <td>{c.oldPrice}</td>
                  <td>{c.newPrice}</td>
                  <td className="up">{c.pctChange != null ? `+${(c.pctChange * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Last runs</h2>
        <ul>
          {runs.map((r) => (
            <li key={r.runId}>
              <Link href={`/runs/${r.runId}`}>
                {r.at} · {r.status} · {r.itemCount} items
              </Link>
            </li>
          ))}
        </ul>
        {store.alerts[0] && (
          <p className="muted">
            Latest alert channel: {store.alerts[store.alerts.length - 1]!.channel}
            {store.alerts[store.alerts.length - 1]!.path ? ` → ${store.alerts[store.alerts.length - 1]!.path}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
