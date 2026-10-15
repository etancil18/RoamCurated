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

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { DateTime } from 'luxon'

config({ path: '.env.local', quiet: true })

const args = process.argv.slice(2)
const snapshotCheck = args.includes('--snapshot-check')
const scheduled = args.includes('--scheduled')
const apply = args.includes('--apply') || scheduled
const full = args.includes('--full') || scheduled
const dryRun = args.includes('--dry-run')

const eventArgs = args.filter(arg =>
  arg.startsWith('--event-id=')
)

const eventId = eventArgs.length === 1
  ? eventArgs[0].slice('--event-id='.length)
  : null

if (
  args.some(arg =>
    !['--apply', '--dry-run', '--full', '--scheduled', '--snapshot-check'].includes(arg) &&
    !arg.startsWith('--event-id=')
  ) ||
  eventArgs.length > 1 ||
  (snapshotCheck && args.length !== 1) ||
  (apply && dryRun) ||
  (scheduled && (args.includes('--apply') ||
                 args.includes('--full') ||
                 eventId)) ||
  (full && eventId) ||
  (apply && !full && !eventId) ||
  (!apply && (full || eventId)) ||
  (eventArgs.length === 1 && !eventId)
) {
  throw new Error(
    'Usage: node scripts/findlocal-import.mjs ' +
    '[--dry-run] | --snapshot-check | --apply --event-id=ID | --apply --full | --scheduled'
  )
}

const apiKey = process.env.FINDLOCAL_API_KEY
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!apiKey) {
  throw new Error('Missing FINDLOCAL_API_KEY')
}

if ((apply || snapshotCheck) && (!supabaseUrl || !serviceKey)) {
  throw new Error('Missing Supabase server credentials')
}

const supabase = (apply || snapshotCheck)
  ? createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })
  : null

const cities = [
  {
    roam: 'atl',
    api: 'atlanta',
    timezone: 'America/New_York',
  },
  {
    roam: 'nyc',
    api: 'new-york',
    timezone: 'America/New_York',
  },
  {
    roam: 'london',
    api: 'london',
    timezone: 'Europe/London',
  },
]

function localTimestamp(date, time, zone) {
  if (!date || !time) return null

  const parsed = DateTime.fromISO(
    `${date}T${time}`,
    { zone }
  )

  return parsed.isValid
    ? parsed.toUTC().toISO()
    : null
}

function validateProviderUrls(event) {
  for (const field of [
    'root_url',
    'detail_page_url',
    'ticket_page_url',
  ]) {
    const value = event[field]

    if (value == null || value === '') continue

    if (typeof value !== 'string' ||
        value !== value.trim()) {
      throw new Error(`Invalid ${field}`)
    }

    let parsed

    try {
      parsed = new URL(value)
    } catch {
      throw new Error(`Invalid ${field}`)
    }

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      /[\\[\\]<>]/.test(value) ||
      /\\s/.test(value)
    ) {
      throw new Error(`Invalid ${field}`)
    }
  }
}

function normalizeEvent(event, city) {
  validateProviderUrls(event)
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('Invalid event object')
  }

  if (event.id === null || event.id === undefined ||
      String(event.id).trim() === '') {
    throw new Error('Missing event ID')
  }

  if (typeof event.title !== 'string' ||
      !event.title.trim()) {
    throw new Error('Missing event title')
  }

  const startsAt = localTimestamp(
    event.event_date,
    event.start_time,
    city.timezone
  )

  if (!startsAt) {
    throw new Error('Invalid or missing start date/time')
  }

  let endsAt = null

  if (event.end_time) {
    endsAt = localTimestamp(
      event.event_date,
      event.end_time,
      city.timezone
    )

    if (!endsAt) {
      throw new Error('Invalid end date/time')
    }

    // The provider may omit an explicit date for
    // events that finish after midnight.
    if (Date.parse(endsAt) <= Date.parse(startsAt)) {
      endsAt = DateTime.fromISO(
        endsAt
      ).plus({ days: 1 }).toUTC().toISO()
    }
  }

  if (event.updated_at &&
      !DateTime.fromISO(
        String(event.updated_at),
        { setZone: true }
      ).isValid) {
    throw new Error('Invalid provider updated_at')
  }

  return {
    p_city: city.roam,
    p_timezone: city.timezone,
    p_event: event,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  }
}

const snapshotPages = new Map()
let useSnapshot = false

async function fetchPage(city, page) {
  if (useSnapshot) {
    const key = `${city.api}:${page}`

    if (!snapshotPages.has(key)) {
      throw new Error(
        `Snapshot missing ${key}; refusing another provider fetch`
      )
    }

    return snapshotPages.get(key)
  }

  const url = new URL(
    'https://' + 'findlocal.community' + '/api/events'
  )

  url.searchParams.set('city', city.api)
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
    `${city.api} page ${page}`
  )

  if (!response.ok) {
    throw new Error(
      `${city.api} page ${page}: HTTP ${response.status}`
    )
  }

  const result = await response.json()

  if (!Array.isArray(result?.data)) {
    throw new Error(
      `${city.api} page ${page}: Unexpected API format`
    )
  }

  if (
    result.meta?.total !== undefined &&
    (!Number.isSafeInteger(Number(result.meta.total)) ||
     Number(result.meta.total) < 0)
  ) {
    throw new Error(
      `${city.api} page ${page}: Invalid total count`
    )
  }

  return result
}

const summary = {
  mode: apply ? 'APPLY' : 'DRY RUN',
  fetched: 0,
  valid: 0,
  failed: 0,
  skippedMissingStartTime: 0,
  skippedMissingSourceUrl: 0,
  acknowledgedSourceReviews: 0,
  acknowledgedPerformerReviews: 0,
  manualReviewRequired: 0,
  outcomes: {},
  cities: {},
}

async function processCity(city) {
  console.log(`\nChecking ${city.api}...`)

  let fetched = 0
  let valid = 0
  let failed = 0
  let skippedMissingStartTime = 0
  let skippedMissingSourceUrl = 0
  let expectedTotal = null
  const seen = new Set()

  // Validate the complete city feed before writing
  // any events from that city.
  const records = []
  const missingTimeRecords = []
  const missingSourceIds = []

  for (let page = 1; page <= 100; page++) {
    const result = await fetchPage(city, page)
    const events = result.data

    if (expectedTotal === null &&
        result.meta?.total !== undefined &&
        result.meta?.total !== null) {
      expectedTotal = Number(result.meta.total)
    }

    if (events.length === 0) {
      if (expectedTotal !== null &&
          fetched < expectedTotal) {
        throw new Error(
          `${city.api}: Feed ended at ${fetched}, expected ${expectedTotal}`
        )
      }
      break
    }

    for (const event of events) {
      fetched++

      const id = event?.id === undefined ||
        event?.id === null
        ? null
        : String(event.id)

      if (id === null || seen.has(id)) {
        failed++
        console.error(
          `${city.api}: Missing or duplicate event ID: ${id}`
        )
        continue
      }

      seen.add(id)

      if (eventId && id !== eventId) {
        continue
      }

      if (
        apply &&
        eventId &&
        JSON.stringify(event) !== preflightPayload
      ) {
        failed++
        console.error(
          `${city.api} event ${id}: Provider payload changed after preflight`
        )
        continue
      }

      // Date-only events cannot be assigned a trustworthy
      // start timestamp. Record and skip them explicitly.
      if (
        event &&
        typeof event === 'object' &&
        event.start_time == null &&
        typeof event.event_date === 'string' &&
        event.event_date.trim() &&
        typeof event.title === 'string' &&
        event.title.trim()
      ) {
        try {
          validateProviderUrls(event)
        } catch (error) {
          failed++
          console.error(
            `${city.api} event ${id}: ${error.message}`
          )
          continue
        }

        skippedMissingStartTime++
        missingTimeRecords.push({
          p_city: city.roam,
          p_event: event,
        })
        continue
      }

      try {
        const urls = [
          event.root_url,
          event.detail_page_url,
          event.ticket_page_url,
        ]

        if (!urls.some(value =>
          typeof value === 'string' &&
          /^https?:\/\//i.test(value.trim())
        )) {
          skippedMissingSourceUrl++
          missingSourceIds.push(id)
          continue
        }

        records.push(normalizeEvent(event, city))
        valid++
      } catch (error) {
        failed++
        console.error(
          `${city.api} event ${id}: ${error.message}`
        )
      }
    }

    console.log(
      `${city.api} page ${page}: ${events.length} fetched`
    )

    if (expectedTotal !== null &&
        fetched >= expectedTotal) {
      if (fetched > expectedTotal) {
        throw new Error(
          `${city.api}: Fetched more than expected total`
        )
      }
      break
    }

    if (page === 100) {
      throw new Error(
        `${city.api}: Pagination exceeded 100 pages`
      )
    }
  }

  summary.fetched += fetched
  summary.valid += valid
  summary.failed += failed
  summary.skippedMissingStartTime += skippedMissingStartTime
  summary.skippedMissingSourceUrl += skippedMissingSourceUrl

  summary.cities[city.roam] = {
    fetched,
    valid,
    failed,
    skippedMissingStartTime,
    skippedMissingSourceUrl,
  }

  if (!apply) {
    console.log(
      `${city.api}: ${valid} valid, ${skippedMissingStartTime} missing start times, ${failed} invalid; no writes`
    )
    return
  }

  let cityAcknowledgedSourceReviews = 0

  if (missingSourceIds.length > 0) {
    const { data: stored, error } = await supabase
      .from('external_event_staging')
      .select(
        'external_event_id,import_status,sync_review_reason'
      )
      .eq('provider', 'findlocal')
      .in('external_event_id', missingSourceIds)

    if (error) throw new Error(error.message)

    const byId = new Map(
      stored.map(row => [
        String(row.external_event_id),
        row,
      ])
    )

    for (const id of missingSourceIds) {
      const row = byId.get(id)

      if (!row || row.import_status !== 'published') {
        continue
      }

      if (
        row.sync_review_reason ===
        'provider_source_url_missing'
      ) {
        summary.acknowledgedSourceReviews++
        cityAcknowledgedSourceReviews++
      } else {
        failed++
        summary.failed++
        console.error(
          `${city.api} event ${id}: New published missing-source issue`
        )
      }
    }
  }

  summary.cities[city.roam].acknowledgedSourceReviews =
    cityAcknowledgedSourceReviews

  if (failed > 0) {
    console.error(
      `${city.api}: Skipping writes because review is required`
    )
    return
  }

  if (failed > 0) {
    console.error(
      `${city.api}: Skipping writes because validation failed`
    )
    return
  }

  // Process missing-time records through the separate
  // guarded RPC. Never invent a start timestamp.
  for (const record of missingTimeRecords) {
    const id = String(record.p_event.id)

    try {
      const { data, error } = await supabase.rpc(
        'flag_findlocal_missing_start_time',
        record
      )

      if (error) throw new Error(error.message)

      if (typeof data !== 'string' || !data) {
        throw new Error('Unexpected missing-time RPC result')
      }

      summary.outcomes[data] =
        (summary.outcomes[data] ?? 0) + 1

      if (data === 'review_equal_version_missing_time') {
        summary.manualReviewRequired++
      }
    } catch (error) {
      summary.failed++
      summary.cities[city.roam].failed++

      console.error(
        `${city.api} missing-time event ${id}: ${error.message}`
      )
    }
  }

  for (const record of records) {
    const id = String(record.p_event.id)

    try {
      const { data, error } = await supabase.rpc(
        'sync_findlocal_event',
        record
      )

      if (error) {
        const knownPerformerConflict =
          id === 'a471dec4-a3b7-4354-bba9-55ed905c6716' &&
          error.message.includes(
            'Conflicting payload at identical provider version'
          )

        if (knownPerformerConflict) {
          summary.manualReviewRequired++
          console.warn(
            `${city.api} event ${id}: manual performer review required`
          )
          continue
        }

        throw new Error(error.message)
      }

      if (typeof data !== 'string' || !data) {
        throw new Error('Unexpected RPC result')
      }

      summary.outcomes[data] =
        (summary.outcomes[data] ?? 0) + 1

      if (data === 'skipped_manual_review') {
        const { data: review, error: reviewError } =
          await supabase
            .from('external_event_staging')
            .select('import_status,sync_review_reason')
            .eq('provider', 'findlocal')
            .eq('external_event_id', id)
            .single()

        if (reviewError) {
          throw new Error(reviewError.message)
        }

        if (
          review.import_status === 'published' &&
          review.sync_review_reason ===
            'provider_equal_version_performers_conflict'
        ) {
          summary.acknowledgedPerformerReviews++
        } else {
          summary.manualReviewRequired++
        }
      }

    } catch (error) {
      summary.failed++
      summary.cities[city.roam].failed++

      console.error(
        `${city.api} event ${id}: ${error.message}`
      )
    }
  }

  console.log(`${city.api}: synchronization calls completed`)
}

// A targeted apply must verify the entire provider feed
// before any database write is permitted.
let preflightPayload = null

async function preflightTarget() {
  if (!apply || !eventId) return

  let matches = 0

  for (const city of cities) {
    let fetched = 0
    let expected = null
    let completed = false

    for (let page = 1; page <= 100; page++) {
      const result = await fetchPage(city, page)
      const events = result.data

      if (result.meta?.total != null) {
        const total = Number(result.meta.total)

        if (expected === null) expected = total
        else if (total !== expected) {
          throw new Error(
            `${city.api}: Pagination total changed during preflight`
          )
        }
      }

      for (const event of events) {
        fetched++

        if (String(event?.id) !== eventId) continue

        matches++
        preflightPayload = JSON.stringify(event)

        if (event.start_time == null ||
            String(event.start_time).trim() === '') {
          validateProviderUrls(event)
        } else {
          normalizeEvent(event, city)
        }
      }

      if (expected !== null && fetched >= expected) {
        if (fetched !== expected) {
          throw new Error(`${city.api}: Pagination count mismatch`)
        }
        completed = true
        break
      }

      if (events.length === 0) {
        if (expected !== null && fetched !== expected) {
          throw new Error(`${city.api}: Incomplete pagination`)
        }
        completed = true
        break
      }
    }

    if (!completed) {
      throw new Error(
        `${city.api}: Preflight pagination did not complete`
      )
    }
  }

  if (matches !== 1) {
    throw new Error(
      `Targeted apply requires exactly one event; found ${matches}`
    )
  }

  console.log(
    `Target preflight passed: exactly one occurrence of ${eventId}`
  )
}

await preflightTarget()

// Capture the provider feed once. Nothing may be written until
// the complete snapshot and published-source exceptions pass.
async function captureFullSnapshot() {
  console.log(
    'Capturing and validating one complete Find Local snapshot...'
  )

  const providerIds = new Set()
  const missingSourceIds = []
  let totalFetched = 0

  for (const city of cities) {
    let fetched = 0
    let expected = null
    let completed = false

    for (let page = 1; page <= 100; page++) {
      const result = await fetchPage(city, page)
      const events = result.data
      const reportedTotal = Number(result.meta?.total)

      if (
        !Number.isSafeInteger(reportedTotal) ||
        reportedTotal < 0
      ) {
        throw new Error(
          `${city.api}: Missing or invalid pagination total`
        )
      }

      if (expected === null) {
        expected = reportedTotal
      } else if (expected !== reportedTotal) {
        throw new Error(
          `${city.api}: Pagination total changed`
        )
      }

      if (events.length > 500) {
        throw new Error(`${city.api}: Invalid page size`)
      }

      const key = `${city.api}:${page}`

      if (snapshotPages.has(key)) {
        throw new Error(`Duplicate snapshot page ${key}`)
      }

      snapshotPages.set(key, result)

      for (const event of events) {
        fetched++
        totalFetched++

        if (
          !event ||
          typeof event !== 'object' ||
          Array.isArray(event) ||
          event.id == null ||
          !String(event.id).trim()
        ) {
          throw new Error(`${city.api}: Invalid event identity`)
        }

        const id = String(event.id)

        if (providerIds.has(id)) {
          throw new Error(
            `Duplicate provider event ID across feed: ${id}`
          )
        }

        providerIds.add(id)

        if (
          typeof event.title !== 'string' ||
          !event.title.trim() ||
          typeof event.event_date !== 'string' ||
          !event.event_date.trim()
        ) {
          throw new Error(
            `${city.api} event ${id}: Missing title or event date`
          )
        }

        // Validate every supplied URL, including those on
        // records without a usable source.
        validateProviderUrls(event)

        if (
          event.start_time == null ||
          String(event.start_time).trim() === ''
        ) {
          if (
            !DateTime.fromISO(
              event.event_date,
              { zone: city.timezone }
            ).isValid
          ) {
            throw new Error(
              `${city.api} event ${id}: Invalid event date`
            )
          }

          if (
            !event.updated_at ||
            !DateTime.fromISO(
              String(event.updated_at),
              { setZone: true }
            ).isValid
          ) {
            throw new Error(
              `${city.api} event ${id}: Invalid provider version`
            )
          }

          continue
        }

        const hasSource = [
          event.root_url,
          event.detail_page_url,
          event.ticket_page_url,
        ].some(value =>
          typeof value === 'string' &&
          (value.trim().startsWith('https://') || value.trim().startsWith('http://'))
        )

        if (!hasSource) {
          missingSourceIds.push(id)
          continue
        }

        normalizeEvent(event, city)
      }

      console.log(
        `Snapshot ${city.api} page ${page}: ` +
        `${events.length} events`
      )

      if (fetched === expected) {
        completed = true
        break
      }

      if (fetched > expected || events.length === 0) {
        throw new Error(
          `${city.api}: Incomplete or inconsistent pagination`
        )
      }
    }

    if (!completed || fetched !== expected) {
      throw new Error(
        `${city.api}: Snapshot incomplete (${fetched}/${expected})`
      )
    }
  }

  // Fail closed for previously published events losing source
  // provenance unless they have the exact acknowledged marker.
  let acknowledged = 0
  const unexpectedPublished = []

  for (let offset = 0;
       offset < missingSourceIds.length;
       offset += 100) {
    const ids = missingSourceIds.slice(offset, offset + 100)

    const { data, error } = await supabase
      .from('external_event_staging')
      .select(
        'external_event_id,import_status,sync_review_reason'
      )
      .eq('provider', 'findlocal')
      .in('external_event_id', ids)

    if (error) {
      throw new Error(
        `Snapshot source-review lookup failed: ${error.message}`
      )
    }

    const byId = new Map(
      data.map(row => [
        String(row.external_event_id),
        row,
      ])
    )

    for (const id of ids) {
      const row = byId.get(id)

      if (!row || row.import_status !== 'published') {
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
  }

  console.log('Find Local snapshot validation:')
  console.log(JSON.stringify({
    fetched: totalFetched,
    pages: snapshotPages.size,
    missingSource: missingSourceIds.length,
    acknowledgedPublishedSourceReviews: acknowledged,
    unexpectedPublishedSourceReviews: unexpectedPublished,
  }, null, 2))

  if (unexpectedPublished.length > 0) {
    throw new Error(
      'New published missing-source events require manual review'
    )
  }

  if (totalFetched === 0) {
    throw new Error('Empty provider snapshot')
  }

  useSnapshot = true

  console.log(
    'PASS: Single snapshot validated; no event writes yet.'
  )
}

if ((apply && full && !eventId) || snapshotCheck) {
  await captureFullSnapshot()
}

if (snapshotCheck) {
  // Replay the exact cached API pages through the existing
  // city processor. No apply RPCs are permitted.
  for (const city of cities) {
    await processCity(city)
  }

  const accountedFor =
    summary.valid +
    summary.skippedMissingStartTime +
    summary.skippedMissingSourceUrl

  if (
    summary.failed !== 0 ||
    summary.fetched === 0 ||
    accountedFor !== summary.fetched ||
    summary.fetched !==
      [...snapshotPages.values()].reduce(
        (total, page) => total + page.data.length, 0
      )
  ) {
    throw new Error(
      'Snapshot replay failed validation or accounting'
    )
  }

  console.log(
    'SNAPSHOT REPLAY PASS: All cached events processed; no database writes.'
  )
  process.exit(0)
}

let scheduledRunId = null

if (scheduled) {
  const { data, error } = await supabase.rpc(
    'begin_findlocal_scheduled_sync'
  )

  if (error) throw new Error(error.message)

  if (data === null) {
    console.log(
      'Scheduled sync not due or already running. No API ingestion.'
    )
    process.exit(0)
  }

  scheduledRunId = data
  console.log(`Scheduled run acquired: ${scheduledRunId}`)
}

console.log(
  `Find Local mode: ${summary.mode}`
)

if (!apply) {
  console.log('Dry run: Supabase writes are disabled.')
}

let fatalError = null

for (const city of cities) {
  try {
    await processCity(city)
  } catch (error) {
    fatalError = true
    summary.cities[city.roam] = {
      ...(summary.cities[city.roam] ?? {}),
      fatalError: error.message,
    }

    console.error(
      `${city.api}: ${error.message}`
    )

    // Do not continue after incomplete pagination.
    break
  }
}

summary.pendingPerformerReviews =
  summary.outcomes.pending_performers_review ?? 0

summary.venueConflictQuarantines =
  summary.outcomes.venue_conflict_quarantined ?? 0

console.log('\nFind Local summary:')
console.log(JSON.stringify(summary, null, 2))

const completedRpcCalls = Object.values(
  summary.outcomes
).reduce((sum, count) => sum + count, 0)

const targetIncomplete =
  apply &&
  eventId &&
  completedRpcCalls + summary.manualReviewRequired !== 1

if (targetIncomplete) {
  console.error(
    `Targeted import incomplete: ${completedRpcCalls} RPC outcomes`
  )
}

const runFailed =
  fatalError ||
  summary.failed > 0 ||
  targetIncomplete ||
  (apply && summary.manualReviewRequired > 0)

if (scheduledRunId) {
  const { data, error } = await supabase.rpc(
    'finish_findlocal_scheduled_sync',
    {
      p_run_id: scheduledRunId,
      p_success: !runFailed,
      p_summary: summary,
      p_error_message: runFailed
        ? 'Importer reported incomplete or failed synchronization'
        : null,
    }
  )

  if (error) {
    console.error(
      `Failed to finish scheduled run: ${error.message}`
    )
    process.exitCode = 1
  } else if (
    data !== (runFailed ? 'failed' : 'succeeded')
  ) {
    console.error(
      `Unexpected scheduled completion result: ${data}`
    )
    process.exitCode = 1
  } else {
    console.log(`Scheduled run recorded: ${data}`)
  }
}

if (runFailed || process.exitCode === 1) {
  console.error('Find Local run FAILED.')
  process.exitCode = 1
} else {
  console.log(
    apply
      ? 'Find Local synchronization completed. No automatic publication.'
      : 'Dry run completed. No database changes.'
  )
}
