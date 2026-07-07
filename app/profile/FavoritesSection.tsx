'use client'

import { useEffect, useState } from 'react'
import FavoritesList from '@/components/FavoritesList'
import { supabaseBrowser } from '@/lib/supabase/client'
import { parseFavoriteList, parseRouteList } from '@/lib/parsers/favorite'
import { removeSavedRouteAction } from '@/app/favorites/actions'
import type { CombinedFavorite } from '@/types/ui'
import type { FavoriteRecord, SavedRouteRecord } from '@/types/supabase'

export default function FavoritesSection() {
  const [favorites, setFavorites] = useState<CombinedFavorite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadFavorites() {
      const supabase = supabaseBrowser()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      try {
        const [{ data: venueFavsRaw }, { data: savedRoutesRaw }] =
          await Promise.all([
            supabase
              .from('favorites')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false }),

            supabase
              .from('saved_routes')
              .select('id, name, stops, city, slug, created_at, source_url, user_id')
              .eq('user_id', user.id),
          ])

        const venueFavs = parseFavoriteList(
          (venueFavsRaw ?? []) as FavoriteRecord[]
        ).filter((v): v is NonNullable<typeof v> => v !== null)

        const savedRoutes = parseRouteList(
          (savedRoutesRaw ?? []) as SavedRouteRecord[]
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

        setFavorites(
          [...mappedRoutes, ...mappedVenues].sort((a, b) => {
            const dateA = new Date(a.record.created_at || '').getTime()
            const dateB = new Date(b.record.created_at || '').getTime()
            return dateB - dateA
          })
        )
      } catch (err) {
        console.error('[FavoritesSection] Load error:', err)
        setError('Unable to load saved items.')
      } finally {
        setLoading(false)
      }
    }

    loadFavorites()
  }, [])

  async function handleDeleteCrawl(routeId: string) {
    await removeSavedRouteAction(routeId)
    setFavorites((prev) =>
      prev.filter((item) => item.type !== 'route' || item.record.id !== routeId)
    )
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading saved items…</p>
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>
  }

  return (
    <FavoritesList
      favorites={favorites}
      onDeleteCrawl={handleDeleteCrawl}
    />
  )
}