// lib/supabase/route-handler.ts

import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import type { NextRequest } from 'next/server';

export function supabaseRouteHandler(req: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value ?? null;
        },
        set() {
          // No-op — route handlers can't set cookies
        },
        remove() {
          // No-op — route handlers can't remove cookies
        },
      },
    }
  );
}
