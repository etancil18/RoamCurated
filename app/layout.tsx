export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    icon: '/favicon.ico',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ✅ Create Supabase client (await required since it calls cookies())
  const supabase = await createServerClient()

  // ✅ Fetch the current session securely (SSR-safe)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return (
    <html lang="en">
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
