import './globals.css'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { SupabaseProvider } from '../components/SupabaseProvider'
import Navbar from '../components/Navbar'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Roam App',
  description: 'Itinerary generator and map for ATL & NYC',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`min-h-screen bg-white text-black antialiased ${geistSans.variable} ${geistMono.variable}`}
      >
        <Navbar />
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  )
}
