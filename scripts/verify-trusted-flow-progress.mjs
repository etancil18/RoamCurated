import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv(filename) {
  const path = resolve(process.cwd(), filename)

  if (!existsSync(path)) return

  const contents = readFileSync(path, 'utf8')

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/
    )

    if (!match) continue

    const [, key, rawValue] = match

    if (process.env[key] !== undefined) continue

    let value = rawValue.trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

// Use existing shell variables first, then local Next.js env files.
loadEnv('.env.local')
loadEnv('.env')

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'FAIL: Missing server-side Supabase configuration.'
  )
  process.exit(1)
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

const { data, error } = await supabase
  .from('active_flow_progress')
  .select('id')
  .limit(1)

if (error) {
  console.error(
    'FAIL: Trusted progress read failed:',
    error.message
  )
  process.exit(1)
}

console.log(
  'PASS: Trusted progress read succeeded.'
)
console.log(
  `Returned rows: ${data?.length ?? 0}`
)