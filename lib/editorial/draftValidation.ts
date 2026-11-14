
export type EditorialEditionType =
  | 'featured_collection'
  | 'roam_curated'

export type EditorialDraftInput = {
  edition_type: EditorialEditionType
  title: string
  subtitle: string | null
  description: string | null
  city: string | null
  theme_key: string | null
}

type ValidationResult =
  | {
      ok: true
      data: Partial<EditorialDraftInput>
    }
  | {
      ok: false
      error: string
    }

const ALLOWED_FIELDS = new Set([
  'edition_type',
  'title',
  'subtitle',
  'description',
  'city',
  'theme_key',
])

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

export function validateEditorialDraft(
  input: unknown,
  mode: 'create' | 'update',
): ValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      error: 'A JSON object is required.',
    }
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_FIELDS.has(key)) {
      return {
        ok: false,
        error: `Field "${key}" is not editable through this endpoint.`,
      }
    }
  }

  const data: Partial<EditorialDraftInput> = {}

  if (
    mode === 'create' ||
    Object.prototype.hasOwnProperty.call(
      input,
      'edition_type',
    )
  ) {
    if (
      input.edition_type !== 'featured_collection' &&
      input.edition_type !== 'roam_curated'
    ) {
      return {
        ok: false,
        error: 'Invalid edition_type.',
      }
    }

    data.edition_type = input.edition_type
  }

  if (
    mode === 'create' ||
    Object.prototype.hasOwnProperty.call(input, 'title')
  ) {
    if (typeof input.title !== 'string') {
      return {
        ok: false,
        error: 'Title is required.',
      }
    }

    const title = input.title.trim()

    if (title.length < 1 || title.length > 160) {
      return {
        ok: false,
        error: 'Title must be 1–160 characters.',
      }
    }

    data.title = title
  }

  const optionalFields = [
    ['subtitle', 300],
    ['description', 2000],
    ['city', 160],
    ['theme_key', 80],
  ] as const

  for (const [field, maxLength] of optionalFields) {
    const supplied = Object.prototype.hasOwnProperty.call(
      input,
      field,
    )

    if (!supplied) {
      if (mode === 'create') {
        data[field] = null
      }

      continue
    }

    const value = input[field]

    if (value !== null && typeof value !== 'string') {
      return {
        ok: false,
        error: `${field} must be a string or null.`,
      }
    }

    const normalized =
      typeof value === 'string'
        ? value.trim() || null
        : null

    if (
      normalized !== null &&
      normalized.length > maxLength
    ) {
      return {
        ok: false,
        error: `${field} must be ${maxLength} characters or fewer.`,
      }
    }

    data[field] = normalized
  }

  if (
    mode === 'update' &&
    Object.keys(data).length === 0
  ) {
    return {
      ok: false,
      error: 'No editable fields were supplied.',
    }
  }

  return {
    ok: true,
    data,
  }
}
