
const API_KEY = process.env.FINDLOCAL_API_KEY

if (!API_KEY) {
  throw new Error(
    'FINDLOCAL_API_KEY is missing from .env.local'
  )
}

const cities = [
  { roam: 'atl', findlocal: 'atlanta' },
  { roam: 'nyc', findlocal: 'new-york' },
  { roam: 'london', findlocal: 'london' },
]

const results = []

for (const city of cities) {
  const url = new URL('https://findlocal.community/api/events')

  url.searchParams.set('city', city.findlocal)
  url.searchParams.set('when', 'week')
  url.searchParams.set('limit', '10')
  url.searchParams.set('page', '1')

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `${city.findlocal}: HTTP ${response.status}`
    )
  }

  const payload = await response.json()

  results.push({
    roam_city: city.roam,
    findlocal_city: city.findlocal,
    total_events_next_7_days: payload.meta?.total,
    returned: payload.data?.length ?? 0,
    estimated_calls_at_500_per_page:
      Math.ceil((payload.meta?.total ?? 0) / 500),
    synced_at: payload.meta?.synced_at,
  })

  console.log(`\n${city.findlocal} sample events:`)

  console.table(
    (payload.data ?? []).slice(0, 5).map(e => ({
      title: e.title,
      venue: e.venue_name,
      date: e.event_date,
      time: e.start_time,
      category: e.category,
      external_id: e.id,
    }))
  )
}

console.log('\nFIND LOCAL CITY COVERAGE')
console.table(results)

console.log(
  '\nEstimated calls for one full 7-day import:',
  results.reduce(
    (sum, city) =>
      sum + city.estimated_calls_at_500_per_page,
    0
  )
)
