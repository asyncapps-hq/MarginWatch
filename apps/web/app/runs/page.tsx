import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import Link from 'next/link'

function loadStore() {
  const p = path.resolve(process.cwd(), '../../.marginwatch/store/demo-supplier.json')
  if (!existsSync(p)) return { runs: [] as Array<{ runId: string; status: string; at: string; itemCount: number }> }
  return JSON.parse(readFileSync(p, 'utf8')) as { runs: Array<{ runId: string; status: string; at: string; itemCount: number }> }
}

export default function RunsPage() {
  const store = loadStore()
  return (
    <div className="wrap">
      <p>
        <Link href="/">← MarginWatch</Link>
      </p>
      <h1>Runs</h1>
      <ul className="panel">
        {[...store.runs].reverse().map((r) => (
          <li key={r.runId}>
            <Link href={`/runs/${r.runId}`}>
              {r.runId.slice(0, 8)} · {r.status} · {r.itemCount} · {r.at}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
