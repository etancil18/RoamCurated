import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const apiKey = process.env.FINDLOCAL_API_KEY
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!apiKey || !url || !key) {
  throw new Error('Missing API or Supabase credentials')
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
})

const ignoredFields = new Set([
  'last_seen_at',
  'series_count',
])

const safetyFields = new Set([
  'event_date',
  'start_time',
  'end_time',
  'status',
  'cancelled',
  'canceled',
  'latitude',
  'longitude',
  'lat',
  'lon',
  'venue',
  'venue_name',
  'location',
  'address',
  'city',
  'root_url',
  'detail_page_url',
  'ticket_page_url',
])

function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonical(value[key])])
    )
  }

  return value
}

function changedFields(previous, incoming) {
  const keys = new Set([
    ...Object.keys(previous ?? {}),
    ...Object.keys(incoming ?? {}),
  ])

  return [...keys]
    .filter(field => !ignoredFields.has(field))
    .filter(field =>
      JSON.stringify(canonical(previous?.[field])) !==
      JSON.stringify(canonical(incoming?.[field]))
    )
    .sort()
}

async function providerRecords() {
  const events = new Map()

  for (const city of ['atlanta', 'new-york', 'london']) {
    let fetched = 0
    let total = null

    for (let page = 1; page <= 100; page++) {
      const endpoint = new URL(
        'https://findlocal.community/api/events'
      )

      endpoint.searchParams.set('city', city)
      endpoint.searchParams.set('when', 'week')
      endpoint.searchParams.set('limit', '500')
      endpoint.searchParams.set('page', String(page))

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        throw new Error(
          `${city} page ${page}: HTTP ${response.status}`
        )
      }

      const body = await response.json()

      if (!Array.isArray(body.data)) {
        throw new Error(`${city}: Invalid response`)
      }

      const reportedTotal = Number(body.meta?.total)

      if (!Number.isSafeInteger(reportedTotal)) {
        throw new Error(`${city}: Invalid total`)
      }

      if (total === null) total = reportedTotal
      else if (total !== reportedTotal) {
        throw new Error(`${city}: Pagination total changed`)
      }

      for (const event of body.data) {
        if (!event?.id) throw new Error('Missing provider ID')

        const id = String(event.id)

        if (events.has(id)) {
          throw new Error(`Duplicate provider ID ${id}`)
        }

        events.set(id, event)
        fetched++
      }

      if (fetched === total) break

      if (fetched > total || body.data.length === 0) {
        throw new Error(`${city}: Incomplete pagination`)
      }
    }

    if (fetched !== total) {
      throw new Error(`${city}: Incomplete feed`)
    }
  }

  return events
}

async function main() {
  const incoming = await providerRecords()

  const ids = [...incoming.keys()]
  const differences = []

  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await supabase
      .from('external_event_staging')
      .select(
        'external_event_id,city,import_status,provider_updated_at,raw_payload'
      )
      .eq('provider', 'findlocal')
      .in('external_event_id', ids.slice(offset, offset + 100))

    if (error) throw new Error(error.message)

    for (const row of data) {
      const id = String(row.external_event_id)
      const event = incoming.get(id)

      if (!event?.updated_at ||
          !row.provider_updated_at) continue

      if (
        Date.parse(event.updated_at) !==
        Date.parse(row.provider_updated_at)
      ) {
        continue
      }

      const fields = changedFields(row.raw_payload, event)

      if (fields.length === 0) continue

      differences.push({
        eventId: id,
        city: row.city,
        importStatus: row.import_status,
        fields,
        safetyCriticalFields:
          fields.filter(field => safetyFields.has(field)),
      })
    }
  }

  const fieldCounts = {}

  for (const record of differences) {
    for (const field of record.fields) {
      fieldCounts[field] = (fieldCounts[field] ?? 0) + 1
    }
  }

  console.log(JSON.stringify({
    equalVersionDifferences: differences.length,
    fieldCounts,
    records: differences,
  }, null, 2))
}

main().catch(error => {
  console.error('DIFF FAILED:', error.message)
  process.exitCode = 1
})
