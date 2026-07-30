import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { buildAlertMessage, type AlertPayload } from '@marginwatch/core'
import { dataDir } from './store.js'

export async function dispatchAlert(payload: AlertPayload): Promise<{ channel: 'email' | 'outbox'; path?: string }> {
  const { subject, body } = buildAlertMessage(payload)
  if (process.env.RESEND_API_KEY && process.env.ALERT_TO) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.ALERT_FROM || 'MarginWatch <onboarding@resend.dev>',
        to: [process.env.ALERT_TO],
        subject,
        text: body,
      }),
    })
    if (res.ok) return { channel: 'email' }
  }

  // ponytail: SMTP raw send skipped — outbox always works for demo/CI
  const id = createHash('sha1').update(`${payload.runId}:${payload.sku}:${subject}`).digest('hex').slice(0, 12)
  const file = path.join(dataDir(), 'outbox', `${id}.eml`)
  const eml = [`Subject: ${subject}`, `To: ${process.env.ALERT_TO || 'procurement@example.com'}`, '', body].join('\n')
  await writeFile(file, eml, 'utf8')
  console.error(`Alert outbox: ${file}`)
  return { channel: 'outbox', path: file }
}
