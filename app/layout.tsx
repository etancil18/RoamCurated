import './globals.css'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { createServerClient } from '@/lib/supabase/server'
import { SupabaseProvider } from '@/components/SupabaseProvider'
import Navbar from '@/components/Navbar'

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
    icon: '/favicon-new.ico',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return (
    <html lang="en">
      <head>
        {/* Manually ensure favicon loads in all environments */}
        <link rel="icon" href="/favicon-new.ico" sizes="any" />
      </head>
      <body
        className={`min-h-screen bg-white text-black antialiased ${geistSans.variable} ${geistMono.variable}`}
      >
        <SupabaseProvider initialSession={session}>
          <Navbar />
          <main className="w-full h-full">{children}</main>
        </SupabaseProvider>
      </body>
    </html>
  )
}
