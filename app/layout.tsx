// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'
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
  // 🧠 Initialize Supabase with server cookies
  const supabase = createServerComponentClient<Database>({ cookies: () => cookies() })

  // ✅ Fetch current session (SSR-safe)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return (
    <html lang="en">
      <body
        className={`min-h-screen bg-white text-black antialiased ${geistSans.variable} ${geistMono.variable}`}
      >
        {/* ✅ Wrap entire app (including Navbar) in Supabase context */}
        <SupabaseProvider initialSession={session}>
          <Navbar />
          <main className="w-full h-full">{children}</main>
        </SupabaseProvider>
      </body>
    </html>
  )
}
