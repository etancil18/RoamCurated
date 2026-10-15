async function fetchWithRetry(url, options, label) {
  const retryable = new Set([429, 500, 502, 503, 504])
  const delays = [1000, 2000, 4000, 8000]

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000),
      })

      if (
        response.ok ||
        !retryable.has(response.status) ||
        attempt === delays.length
      ) {
        return response
      }

      console.warn(
        `${label}: HTTP ${response.status}; retry ${attempt + 1}/${delays.length}`
      )
    } catch (error) {
      if (attempt === delays.length) throw error

      console.warn(
        `${label}: ${error.message}; retry ${attempt + 1}/${delays.length}`
      )
    }

    await new Promise(resolve =>
      setTimeout(resolve, delays[attempt])
    )
  }

  throw new Error(`${label}: retries exhausted`)
}

import { spawn } from 'node:child_process'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const apiKey = process.env.FINDLOCAL_API_KEY
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!apiKey || !supabaseUrl || !serviceKey) {
  throw new Error('Missing Find Local or Supabase credentials')
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

async function runDryRun() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['scripts/findlocal-import.mjs'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      stdout += chunk
      process.stdout.write(chunk)
    })

    child.stderr.on('data', chunk => {
      stderr += chunk
      process.stderr.write(chunk)
    })

    child.on('error', reject)

    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(
          `Importer dry run failed with exit code ${code}`
        ))
        return
      }

      const marker = 'Find Local summary:\n'
      const start = stdout.lastIndexOf(marker)

      if (start < 0) {
        reject(new Error('Dry-run summary not found'))
        return
      }

      const after = stdout.slice(start + marker.length)
      const end = after.indexOf('\nDry run completed.')

      if (end < 0) {
        reject(new Error('Dry-run completion marker missing'))
        return
      }

      try {
        resolve(JSON.parse(after.slice(0, end)))
      } catch (error) {
        reject(new Error(
          `Could not parse dry-run summary: ${error.message}`
        ))
      }
    })
  })
}

async function findMissingSourceIds() {
  const ids = new Set()
  const seenEvents = new Set()

  for (const city of ['atlanta', 'new-york', 'london']) {
    let fetched = 0
    let expected = null

    for (let page = 1; page <= 100; page++) {
      const url = new URL(
        'https://findlocal.community/api/events'
      )

      url.searchParams.set('city', city)
      url.searchParams.set('when', 'week')
      url.searchParams.set('limit', '500')
      url.searchParams.set('page', String(page))

      const response = await fetchWithRetry(
        url,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        },
        `${city} page ${page}`
      )

      if (!response.ok) {
        throw new Error(
          `${city}, page ${page}: HTTP ${response.status}`
        )
      }

      const body = await response.json()

      if (!Array.isArray(body.data)) {
        throw new Error(`${city}: Invalid API response`)
      }

      const pageTotal = Number(body.meta?.total)

      if (!Number.isSafeInteger(pageTotal) ||
          pageTotal < 0) {
        throw new Error(`${city}: Missing total count`)
      }

      if (expected === null) {
        expected = pageTotal
      } else if (expected !== pageTotal) {
        throw new Error(
          `${city}: Total changed during pagination`
        )
      }

      if (body.data.length > 500) {
        throw new Error(`${city}: Invalid page size`)
      }

      for (const event of body.data) {
        fetched++

        if (!event.id) {
          throw new Error(`${city}: Event missing ID`)
        }

        const id = String(event.id)

        if (seenEvents.has(id)) {
          throw new Error(`Duplicate provider ID: ${id}`)
        }

        seenEvents.add(id)

        if (!event.start_time) continue

        const hasSource = [
          event.root_url,
          event.detail_page_url,
          event.ticket_page_url,
        ].some(value =>
          typeof value === 'string' &&
          /^https?:\/\//i.test(value.trim())
        )

        if (!hasSource) ids.add(id)
      }

      if (fetched >= expected) break

      if (body.data.length === 0) {
        throw new Error(`${city}: Incomplete pagination`)
      }
    }

    if (fetched !== expected) {
      throw new Error(
        `${city}: Expected ${expected}, received ${fetched}`
      )
    }
  }

  return {
    ids: [...ids],
    fetched: seenEvents.size,
  }
}

async function main() {
  const summary = await runDryRun()

  if (
    summary.mode !== 'DRY RUN' ||
    summary.failed !== 0 ||
    summary.fetched <= 0 ||
    summary.valid +
      summary.skippedMissingStartTime +
      summary.skippedMissingSourceUrl !==
      summary.fetched
  ) {
    throw new Error('Dry-run accounting failed')
  }

  const provider = await findMissingSourceIds()

  if (
    provider.fetched !== summary.fetched ||
    provider.ids.length !== summary.skippedMissingSourceUrl
  ) {
    throw new Error(
      'Provider feed changed between preflight passes'
    )
  }

  const rows = []

  for (let i = 0; i < provider.ids.length; i += 100) {
    const { data, error } = await supabase
      .from('external_event_staging')
      .select(
        'external_event_id,import_status,sync_review_reason'
      )
      .eq('provider', 'findlocal')
      .in(
        'external_event_id',
        provider.ids.slice(i, i + 100)
      )

    if (error) throw new Error(error.message)

    rows.push(...data)
  }

  const stored = new Map(
    rows.map(row => [
      String(row.external_event_id),
      row,
    ])
  )

  let acknowledged = 0
  let unpublished = 0
  const unexpectedPublished = []

  for (const id of provider.ids) {
    const row = stored.get(id)

    if (!row || row.import_status !== 'published') {
      unpublished++
      continue
    }

    if (
      row.sync_review_reason ===
      'provider_source_url_missing'
    ) {
      acknowledged++
    } else {
      unexpectedPublished.push(id)
    }
  }

  console.log('\nFind Local preflight result:')
  console.log(JSON.stringify({
    fetched: summary.fetched,
    valid: summary.valid,
    missingTime: summary.skippedMissingStartTime,
    missingSource: provider.ids.length,
    acknowledgedPublishedSourceReviews: acknowledged,
    unpublishedOrUnstagedMissingSource: unpublished,
    unexpectedPublishedSourceReviews:
      unexpectedPublished,
  }, null, 2))

  if (unexpectedPublished.length > 0) {
    throw new Error(
      'New published missing-source events require review'
    )
  }

  console.log(
    'PASS: Complete feed accounted for; no unacknowledged published missing-source records'
  )
}

main().catch(error => {
  console.error('PREFLIGHT FAILED:', error.message)
  process.exitCode = 1
})
