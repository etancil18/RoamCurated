import { NextResponse } from 'next/server'
import { getFavorites } from '@/lib/supabase/favorites'

export async function GET() {
  try {
    const data = await getFavorites()
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('[API /favorites/list] Error:', error.message || error)
    const isAuthError = error.message?.toLowerCase().includes('not authenticated')

    return NextResponse.json(
      {
        success: false,
        message: isAuthError ? 'Not authenticated' : 'Failed to fetch favorites',
      },
      { status: isAuthError ? 401 : 500 }
    )
  }
}
