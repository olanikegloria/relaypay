import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
/** Relative import — bundled URL; replaces missing /icon-*.png and /apple-icon.png in public/. */
import appIcon from '../public/icon.svg'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const iconUrl = typeof appIcon === 'object' && appIcon !== null && 'src' in appIcon ? appIcon.src : String(appIcon)

export const metadata: Metadata = {
  title: 'RelayPay Customer Service',
  description: 'Professional customer service and CRM platform with voice support',
  generator: 'v0.app',
  icons: {
    icon: [{ url: iconUrl, type: 'image/svg+xml' }],
    apple: iconUrl,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1A3A5C',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${inter.className} antialiased bg-background text-foreground`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
