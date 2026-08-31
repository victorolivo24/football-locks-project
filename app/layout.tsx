import type { Metadata } from 'next'
import { Inter, Righteous } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const righteous = Righteous({ weight: '400', subsets: ['latin'], variable: '--font-righteous' })

export const metadata: Metadata = {
  title: 'NFL Pick\'em',
  description: 'Weekly NFL Pick\'em for friends',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${righteous.variable} font-sans min-h-screen football-field antialiased`}>
        {children}
      </body>
    </html>
  )
}
