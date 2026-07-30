import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MarginWatch — B2B Supplier Portal Automator',
  description: 'Track supplier portal price shifts with Playwright session reuse and Postgres deltas.',
  authors: [{ name: 'KhyFee', url: 'https://github.com/KhyFee' }],
  creator: 'KhyFee',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="credit">
          MarginWatch by <a href="https://github.com/KhyFee">KhyFee</a>
        </footer>
      </body>
    </html>
  )
}
