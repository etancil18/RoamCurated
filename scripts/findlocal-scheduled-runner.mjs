import { spawn } from 'node:child_process'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const args = process.argv.slice(2)
const allowed = args.length === 1 &&
  args[0] === '--check-only'

if (args.length > 0 && !allowed) {
  throw new Error(
    'Usage: node scripts/findlocal-scheduled-runner.mjs [--check-only]'
  )
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

function runScript(script, argumentsList = [], timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [script, ...argumentsList],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      }
    )

    let output = ''
    let runId = null
    let expired = false

    const timer = timeoutMs > 0
      ? setTimeout(() => {
          expired = true
          console.error('Importer exceeded 20-minute limit')
          child.kill('SIGTERM')

          setTimeout(() => {
            if (child.exitCode === null) {
              child.kill('SIGKILL')
            }
          }, 5000).unref()
        }, timeoutMs)
      : null

    child.stdout.on('data', chunk => {
      const text = chunk.toString()
      output += text
      process.stdout.write(text)

      const match = output.match(
        /Scheduled run acquired:\s*([0-9a-f-]{36})/i
      )

      if (match) runId = match[1]
    })

    child.stderr.on('data', chunk => {
      process.stderr.write(chunk)
    })

    child.on('error', error => {
      if (timer) clearTimeout(timer)
      reject(error)
    })

    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer)

      resolve({
        success: code === 0 && !expired,
        code,
        signal,
        runId,
        expired,
      })
    })
  })
}

async function markUnexpectedFailure(runId, reason) {
  if (!runId) {
    console.warn(
      'No acquired run ID observed; database lease recovery applies.'
    )
    return
  }

  const { data: run, error: readError } = await supabase
    .from('findlocal_sync_runs')
    .select('status')
    .eq('id', runId)
    .single()

  if (readError) throw readError

  if (run.status !== 'running') return

  const { error } = await supabase.rpc(
    'finish_findlocal_scheduled_sync',
    {
      p_run_id: runId,
      p_success: false,
      p_summary: {},
      p_error_message: reason,
    }
  )

  if (error) throw error

  console.log(`Recorded unexpected failure: ${runId}`)
}

async function main() {
  if (!allowed) {
    const { data: runs, error } = await supabase
      .from('findlocal_sync_runs')
      .select('status,finished_at')
      .eq('run_type', 'scheduled')
      .in('status', ['running', 'succeeded'])
      .order('started_at', { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)

    if (runs.some(run => run.status === 'running')) {
      console.log(
        'Scheduled synchronization already running; no work.'
      )
      return
    }

    const latestSuccess = runs
      .filter(run => run.status === 'succeeded')
      .map(run => Date.parse(run.finished_at))
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0]

    if (
      latestSuccess !== undefined &&
      Date.now() - latestSuccess < 72 * 60 * 60 * 1000
    ) {
      console.log(
        'Last successful scheduled run is less than 72 hours old.'
      )
      return
    }
  }

  if (allowed) {
    console.log('Running read-only Find Local preflight...')

    const preflight = await runScript(
      'scripts/findlocal-preflight.mjs'
    )

    if (!preflight.success) {
      throw new Error('Preflight failed; synchronization blocked')
    }

    console.log(
      'CHECK ONLY PASS: No scheduled run acquired and no event writes.'
    )
    return
  }

  console.log(
    'Starting gated scheduled import with mandatory preflight...'
  )

  const importRun = await runScript(
    'scripts/findlocal-import.mjs',
    ['--scheduled'],
    20 * 60 * 1000
  )

  if (!importRun.success) {
    await markUnexpectedFailure(
      importRun.runId,
      `Importer terminated: code=${importRun.code}, ` +
      `signal=${importRun.signal}, timeout=${importRun.expired}`
    )

    throw new Error('Scheduled importer failed')
  }

  console.log('Scheduled importer exited successfully.')
}

main().catch(error => {
  console.error('SCHEDULED RUNNER FAILED:', error.message)
  process.exitCode = 1
})
