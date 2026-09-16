import type { Metadata } from 'next'
import { Inter, Barlow_Condensed } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const barlow = Barlow_Condensed({ weight: ['500', '600', '700', '800'], subsets: ['latin'], variable: '--font-barlow' })

export const metadata: Metadata = {
  title: 'NFL Locks',
  description: "Weekly all-or-nothing NFL pick'em",
  // Installing to the Home Screen is what unlocks push notifications on iOS.
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'NFL Locks', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
}

export const viewport = {
  themeColor: '#0A0E13',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${barlow.variable} font-sans min-h-screen bg-ink text-text antialiased`}>
        {children}
      </body>
    </html>
  )
}
