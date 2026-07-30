import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import Link from 'next/link'

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = path.resolve(process.cwd(), '../../.marginwatch/store/demo-supplier.json')
  const store = existsSync(p)
    ? (JSON.parse(readFileSync(p, 'utf8')) as {
        runs: Array<{ runId: string; status: string; at: string; itemCount: number; error?: string }>
        changes: Array<{ runId: string; sku: string; direction: string; pctChange: number | null }>
      })
    : { runs: [], changes: [] }
  const run = store.runs.find((r) => r.runId === id)
  const changes = store.changes.filter((c) => c.runId === id)
  return (
    <div className="wrap">
      <p>
        <Link href="/runs">← Runs</Link>
      </p>
      <h1>Run {id.slice(0, 8)}</h1>
      {!run ? (
        <p className="muted">Not found in local store</p>
      ) : (
        <div className="panel">
          <p>
            Status: <strong>{run.status}</strong> · items {run.itemCount} · {run.at}
          </p>
          {run.error && <pre>{run.error}</pre>}
          <ul>
            {changes.map((c, i) => (
              <li key={i}>
                {c.sku} · {c.direction}
                {c.pctChange != null ? ` · ${(c.pctChange * 100).toFixed(1)}%` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
