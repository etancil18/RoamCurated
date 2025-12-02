// hooks/useFavorites.ts
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/clientOnly'
import type { Venue } from '@/types/venue'

/**
 * Matches the actual shape Supabase returns from `.select('data, city')`
 */
interface FavoriteRow {
  data: Partial<Venue> | null
  city: string | null
}

export function useFavorites(city: 'atl' | 'nyc') {
  const [favorites, setFavorites] = useState<(Venue & { city: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFavorites() {
      const { data, error } = await supabaseBrowser
        .from('favorites')
        .select('data, city')
        .eq('city', city)

      console.log('[useFavorites] fetched rows for city:', city, data)

      if (error) {
        console.error('[useFavorites] Error fetching favorites:', error)
        setFavorites([])
        setLoading(false)
        return
      }

      if (Array.isArray(data)) {
        const mapped = data.map((row) => {
          const venueData = (row.data ?? {}) as Partial<Venue>
          return {
            ...venueData,
            city: row.city ?? city,
          }
        }) as (Venue & { city: string })[]

        setFavorites(mapped)
      } else {
        setFavorites([])
      }

      setLoading(false)
    }

    fetchFavorites()
  }, [city])

  return { favorites, loading }
}
