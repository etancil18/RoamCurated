import { createServerClient } from '@/lib/supabase/server'
import { getFavorites as getVenueFavorites } from '@/lib/supabase/favorites'
import { getSavedRoutes } from '@/lib/supabase/routes'
import FavoritesList from '@/components/FavoritesList'

import type { CombinedFavorite } from '@/types/ui'
import { parseFavoriteList, parseRouteList } from '@/lib/parsers/favorite'

import { removeSavedRouteAction } from './actions'  // ← NEW: delete crawl server action
type UUID = string & { __uuidBrand: never }


export default async function FavoritesPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    return (
      <main className="min-h-screen p-8 bg-white text-black">
        <h1 className="text-2xl font-bold mb-4">My Favorites</h1>
        <p className="text-gray-500">
          Please log in to view your saved routes and favorite venues.
        </p>
      </main>
    )
  }

  let combined: CombinedFavorite[] = []

  try {
    const [venueFavsRaw, savedRoutesRaw] = await Promise.all([
      getVenueFavorites(),
      getSavedRoutes(user.id as UUID),
    ])

    const savedRoutes = parseRouteList(savedRoutesRaw)

    const venueFavs = parseFavoriteList(venueFavsRaw).filter(
      (v): v is NonNullable<typeof v> => v !== null
    )

    const mappedVenues: CombinedFavorite[] = venueFavs.map((v) => ({
      type: 'venue',
      record: v,
      data: v.data,
    }))

    const mappedRoutes: CombinedFavorite[] = savedRoutes.map((r) => ({
      type: 'route',
      record: r,
      data: r.stops,
    }))

    combined = [...mappedRoutes, ...mappedVenues].sort((a, b) => {
      const dateA = new Date(a.record.created_at || '').getTime()
      const dateB = new Date(b.record.created_at || '').getTime()
      return dateB - dateA
    })
  } catch (error: any) {
    console.error('[FavoritesPage] Load error:', error)
    return (
      <main className="min-h-screen p-8 bg-white text-black">
        <h1 className="text-2xl font-bold mb-4">My Favorites</h1>
        <p className="text-red-600">Unable to load data. Please try again later.</p>
      </main>
    )
  }

  // --- NEW: wired delete handler for saved crawls ---
  async function handleDeleteCrawl(routeId: string) {
    'use server'

    try {
      await removeSavedRouteAction(routeId)
      console.log('🗑️ Deleted crawl:', routeId)
    } catch (e) {
      console.error('❌ Failed to delete crawl:', e)
    }
  }

  return (
    <main className="min-h-screen p-8 bg-white text-black">
      <h1 className="text-2xl font-bold mb-4">My Favorites</h1>

      <FavoritesList
        favorites={combined}
        onDeleteCrawl={handleDeleteCrawl}  // ← PASS DELETE HANDLER TO COMPONENT
      />
    </main>
  )
}
