// pages/_app.tsx

import { useState } from 'react'
import { AppProps } from 'next/app'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import '@/app/globals.css'

export default function MyApp({ Component, pageProps }: AppProps) {
  const [supabaseClient] = useState(() => supabaseBrowser())

  return (
    <SessionContextProvider supabaseClient={supabaseClient} initialSession={pageProps.initialSession}>
      <Component {...pageProps} />
    </SessionContextProvider>
  )
}