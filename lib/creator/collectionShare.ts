/* =========================================================
 * Public contracts
 * ======================================================= */

export type PublicCollectionShareCreator = {
  username: string
  displayName: string | null
}

export type PublicCollectionShareData = {
  collectionId: string
  title: string
  slug: string
  description: string | null
  city: string | null
  venueCount: number
  coverImageUrl: string | null
  creator: PublicCollectionShareCreator
}

export type BuildCollectionShareTitleParams = {
  title: string
  creatorDisplayName: string | null
  creatorUsername: string
}

export type BuildCollectionShareTextParams = {
  title: string
  creatorDisplayName: string | null
  creatorUsername: string
  city: string | null
  venueCount: number
}

export type BuildCollectionPublicPathParams = {
  username: string
  slug: string
}

export type BuildCollectionStoryPathParams = {
  username: string
  slug: string
}

/* =========================================================
 * Share title
 * ======================================================= */

export function buildCollectionShareTitle({
  title,
  creatorDisplayName,
  creatorUsername,
}: BuildCollectionShareTitleParams): string {
  const normalizedTitle = normalizeRequiredText(title)

  const creatorName = getCollectionShareCreatorName({
    displayName: creatorDisplayName,
    username: creatorUsername,
  })

  if (!normalizedTitle) {
    return creatorName
      ? `${creatorName}'s Collection | Roam`
      : 'Collection | Roam'
  }

  return creatorName
    ? `${normalizedTitle} — ${creatorName}'s Collection | Roam`
    : `${normalizedTitle} | Roam`
}

/* =========================================================
 * Share text
 * ======================================================= */

export function buildCollectionShareText({
  title,
  creatorDisplayName,
  creatorUsername,
  city,
  venueCount,
}: BuildCollectionShareTextParams): string {
  const normalizedTitle = normalizeRequiredText(title)

  const creatorName = getCollectionShareCreatorName({
    displayName: creatorDisplayName,
    username: creatorUsername,
  })

  const normalizedCity = normalizeOptionalText(city)

  const normalizedVenueCount = normalizeVenueCount(
    venueCount
  )

  const collectionName =
    normalizedTitle ?? 'this Collection'

  const curatorText = creatorName
    ? ` by ${creatorName}`
    : ''

  const contextText = buildCollectionShareContext({
    city: normalizedCity,
    venueCount: normalizedVenueCount,
  })

  return contextText
    ? `Explore ${collectionName}${curatorText} on Roam — ${contextText}.`
    : `Explore ${collectionName}${curatorText} on Roam.`
}

/* =========================================================
 * Public paths
 * ======================================================= */

export function buildCollectionPublicPath({
  username,
  slug,
}: BuildCollectionPublicPathParams): string {
  const normalizedUsername = normalizeUsername(username)
  const normalizedSlug = normalizeSlug(slug)

  if (!normalizedUsername || !normalizedSlug) {
    return ''
  }

  return `/u/${encodeURIComponent(
    normalizedUsername
  )}/collections/${encodeURIComponent(
    normalizedSlug
  )}`
}

export function buildCollectionStoryPath({
  username,
  slug,
}: BuildCollectionStoryPathParams): string {
  const publicPath = buildCollectionPublicPath({
    username,
    slug,
  })

  return publicPath
    ? `${publicPath}/story`
    : ''
}

/* =========================================================
 * Creator presentation
 * ======================================================= */

export function getCollectionShareCreatorName({
  displayName,
  username,
}: {
  displayName: string | null
  username: string
}): string | null {
  const normalizedDisplayName = normalizeOptionalText(
    displayName
  )

  if (normalizedDisplayName) {
    return normalizedDisplayName
  }

  return getCollectionShareCreatorHandle(username)
}

export function getCollectionShareCreatorHandle(
  username: string
): string | null {
  const normalizedUsername = normalizeUsername(username)

  return normalizedUsername
    ? `@${normalizedUsername}`
    : null
}

/* =========================================================
 * Collection presentation
 * ======================================================= */

export function buildCollectionVenueCountLabel(
  venueCount: number
): string {
  const normalizedVenueCount = normalizeVenueCount(
    venueCount
  )

  return `${normalizedVenueCount.toLocaleString(
    'en-US'
  )} ${
    normalizedVenueCount === 1
      ? 'place'
      : 'places'
  }`
}

export function buildCollectionShareEyebrow({
  creatorDisplayName,
  creatorUsername,
}: {
  creatorDisplayName: string | null
  creatorUsername: string
}): string {
  const creatorName = getCollectionShareCreatorName({
    displayName: creatorDisplayName,
    username: creatorUsername,
  })

  return creatorName
    ? `${creatorName}'s Collection`
    : 'Roam Collection'
}

export function buildCollectionShareContext({
  city,
  venueCount,
}: {
  city: string | null
  venueCount: number
}): string {
  const normalizedCity = normalizeOptionalText(city)

  const countLabel = buildCollectionVenueCountLabel(
    venueCount
  )

  if (normalizedCity) {
    return `${countLabel} worth knowing in ${normalizedCity}`
  }

  return `${countLabel} worth knowing`
}

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeUsername(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  let decoded: string

  try {
    decoded = decodeURIComponent(value)
  } catch {
    return null
  }

  const normalized = decoded
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')

  if (
    !normalized ||
    normalized.length > 100 ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    /[\r\n]/.test(normalized)
  ) {
    return null
  }

  return normalized
}

function normalizeSlug(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  let decoded: string

  try {
    decoded = decodeURIComponent(value)
  } catch {
    return null
  }

  const normalized = decoded
    .trim()
    .toLowerCase()

  if (
    !normalized ||
    normalized.length > 160 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeRequiredText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = normalizeWhitespace(value)

  return normalized || null
}

function normalizeOptionalText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = normalizeWhitespace(value)

  return normalized || null
}

function normalizeWhitespace(
  value: string
): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeVenueCount(
  value: unknown
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(value)
  )
}