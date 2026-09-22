import type { CSSProperties, ReactElement } from 'react'

import {
  buildCollectionShareContext,
  getCollectionShareCreatorHandle,
  type PublicCollectionShareData,
} from '@/lib/creator/collectionShare'

export type CollectionShareArtworkVariant =
  | 'story'
  | 'og'

export type CollectionShareArtworkProps = {
  data: PublicCollectionShareData
  variant: CollectionShareArtworkVariant
}

type ArtworkTheme = {
  width: number
  height: number
  outerPadding: number
  contentGap: number
  brandSize: number
  eyebrowSize: number
  titleSize: number
  contextSize: number
  creatorSize: number
  footerSize: number
  radius: number
}

const STORY_THEME: ArtworkTheme = {
  width: 1080,
  height: 1920,
  outerPadding: 72,
  contentGap: 34,
  brandSize: 30,
  eyebrowSize: 28,
  titleSize: 82,
  contextSize: 34,
  creatorSize: 30,
  footerSize: 24,
  radius: 42,
}

const OG_THEME: ArtworkTheme = {
  width: 1200,
  height: 630,
  outerPadding: 54,
  contentGap: 22,
  brandSize: 24,
  eyebrowSize: 20,
  titleSize: 58,
  contextSize: 26,
  creatorSize: 22,
  footerSize: 18,
  radius: 30,
}

const COLORS = {
  ink: '#161814',
  mutedInk: '#62675d',
  cream: '#f4f0e6',
  paper: '#fbf8f0',
  moss: '#68715c',
  darkMoss: '#32392f',
  line: 'rgba(22, 24, 20, 0.12)',
  white: '#ffffff',
} as const

export function CollectionShareArtwork({
  data,
  variant,
}: CollectionShareArtworkProps): ReactElement {
  const theme =
    variant === 'story'
      ? STORY_THEME
      : OG_THEME

  const creatorHandle =
    getCollectionShareCreatorHandle(
      data.creator.username
    )

  const creatorLabel =
    normalizeText(
      data.creator.displayName
    ) ??
    creatorHandle ??
    'Roam creator'

  const context =
    buildCollectionShareContext({
      city: data.city,
      venueCount: data.venueCount,
    })

  if (variant === 'og') {
    return (
      <CollectionOgArtwork
        data={data}
        theme={theme}
        creatorLabel={creatorLabel}
        creatorHandle={creatorHandle}
        context={context}
      />
    )
  }

  return (
    <CollectionStoryArtwork
      data={data}
      theme={theme}
      creatorLabel={creatorLabel}
      creatorHandle={creatorHandle}
      context={context}
    />
  )
}

function CollectionStoryArtwork({
  data,
  theme,
  creatorLabel,
  creatorHandle,
  context,
}: {
  data: PublicCollectionShareData
  theme: ArtworkTheme
  creatorLabel: string
  creatorHandle: string | null
  context: string
}): ReactElement {
  const title = normalizeTitle(data.title)
  const city = normalizeText(data.city)
  const coverImageUrl =
    normalizeArtworkImageUrl(
      data.coverImageUrl
    )

  return (
    <div
      style={{
        ...rootStyle(theme),
        background:
          'linear-gradient(155deg, #f7f3e9 0%, #eee8da 58%, #e3ddcf 100%)',
      }}
    >
      <DecorativeStoryGlow />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <ArtworkHeader
          theme={theme}
          city={city}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 62,
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              color: COLORS.moss,
              fontSize: theme.eyebrowSize,
              fontWeight: 700,
              letterSpacing: '0.14em',
              lineHeight: 1.15,
              textTransform: 'uppercase',
            }}
          >
            {creatorLabel}&apos;s Collection
          </div>

          <div
            style={{
              display: 'flex',
              color: COLORS.ink,
              fontSize: getStoryTitleSize(
                title,
                theme.titleSize
              ),
              fontWeight: 700,
              letterSpacing: '-0.045em',
              lineHeight: 0.98,
              marginTop: 24,
              maxWidth: 900,
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: 'flex',
              color: COLORS.mutedInk,
              fontSize: theme.contextSize,
              fontWeight: 500,
              letterSpacing: '-0.015em',
              lineHeight: 1.25,
              marginTop: 28,
              maxWidth: 860,
            }}
          >
            {context}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            marginTop: 54,
            minHeight: 0,
            width: '100%',
          }}
        >
          <CollectionCover
            imageUrl={coverImageUrl}
            title={title}
            city={city}
            radius={theme.radius}
            variant="story"
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 42,
            width: '100%',
          }}
        >
          <CreatorIdentity
            creatorLabel={creatorLabel}
            creatorHandle={creatorHandle}
            size={theme.creatorSize}
          />

          <ArtworkFooter
            fontSize={theme.footerSize}
          />
        </div>
      </div>
    </div>
  )
}

function CollectionOgArtwork({
  data,
  theme,
  creatorLabel,
  creatorHandle,
  context,
}: {
  data: PublicCollectionShareData
  theme: ArtworkTheme
  creatorLabel: string
  creatorHandle: string | null
  context: string
}): ReactElement {
  const title = normalizeTitle(data.title)
  const city = normalizeText(data.city)
  const coverImageUrl =
    normalizeArtworkImageUrl(
      data.coverImageUrl
    )

  return (
    <div
      style={{
        ...rootStyle(theme),
        background:
          'linear-gradient(135deg, #f7f3e9 0%, #ebe5d7 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          width: 430,
          height: 430,
          borderRadius: 430,
          background:
            'rgba(104, 113, 92, 0.10)',
          right: -150,
          top: -180,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
            paddingRight: 48,
          }}
        >
          <ArtworkHeader
            theme={theme}
            city={city}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              minHeight: 0,
              paddingTop: 24,
              paddingBottom: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                color: COLORS.moss,
                fontSize: theme.eyebrowSize,
                fontWeight: 700,
                letterSpacing: '0.12em',
                lineHeight: 1.1,
                textTransform: 'uppercase',
              }}
            >
              {creatorLabel}&apos;s Collection
            </div>

            <div
              style={{
                display: 'flex',
                color: COLORS.ink,
                fontSize: getOgTitleSize(
                  title,
                  theme.titleSize
                ),
                fontWeight: 700,
                letterSpacing: '-0.045em',
                lineHeight: 0.98,
                marginTop: 16,
                maxWidth: 610,
              }}
            >
              {title}
            </div>

            <div
              style={{
                display: 'flex',
                color: COLORS.mutedInk,
                fontSize: theme.contextSize,
                fontWeight: 500,
                letterSpacing: '-0.015em',
                lineHeight: 1.22,
                marginTop: 20,
                maxWidth: 590,
              }}
            >
              {context}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <CreatorIdentity
              creatorLabel={creatorLabel}
              creatorHandle={creatorHandle}
              size={theme.creatorSize}
            />

            <ArtworkFooter
              fontSize={theme.footerSize}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            width: 420,
            height: '100%',
            flexShrink: 0,
          }}
        >
          <CollectionCover
            imageUrl={coverImageUrl}
            title={title}
            city={city}
            radius={theme.radius}
            variant="og"
          />
        </div>
      </div>
    </div>
  )
}

function ArtworkHeader({
  theme,
  city,
}: {
  theme: ArtworkTheme
  city: string | null
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
      }}
    >
      <RoamWordmark
        fontSize={theme.brandSize}
      />

      {city ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: `1px solid ${COLORS.line}`,
            borderRadius: 999,
            color: COLORS.mutedInk,
            fontSize:
              theme.footerSize,
            fontWeight: 600,
            lineHeight: 1,
            padding:
              theme.width === STORY_THEME.width
                ? '14px 20px'
                : '10px 15px',
          }}
        >
          {city}
        </div>
      ) : null}
    </div>
  )
}

function RoamWordmark({
  fontSize,
}: {
  fontSize: number
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        color: COLORS.ink,
        fontSize,
        fontWeight: 800,
        letterSpacing: '-0.04em',
        lineHeight: 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: Math.round(
            fontSize * 0.72
          ),
          height: Math.round(
            fontSize * 0.72
          ),
          borderRadius: 999,
          background: COLORS.moss,
          marginRight: Math.round(
            fontSize * 0.36
          ),
        }}
      />
      ROAM
    </div>
  )
}

function CreatorIdentity({
  creatorLabel,
  creatorHandle,
  size,
}: {
  creatorLabel: string
  creatorHandle: string | null
  size: number
}): ReactElement {
  const initial =
    getCreatorInitial(
      creatorLabel,
      creatorHandle
    )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: Math.round(
            size * 1.8
          ),
          height: Math.round(
            size * 1.8
          ),
          borderRadius: 999,
          background: COLORS.darkMoss,
          color: COLORS.white,
          flexShrink: 0,
          fontSize: Math.round(
            size * 0.72
          ),
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {initial}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginLeft: Math.round(
            size * 0.52
          ),
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            color: COLORS.ink,
            fontSize: size,
            fontWeight: 650,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
          }}
        >
          {creatorLabel}
        </div>

        {creatorHandle &&
        creatorHandle !== creatorLabel ? (
          <div
            style={{
              display: 'flex',
              color: COLORS.mutedInk,
              fontSize: Math.round(
                size * 0.76
              ),
              fontWeight: 500,
              lineHeight: 1.1,
              marginTop: Math.round(
                size * 0.22
              ),
            }}
          >
            {creatorHandle}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ArtworkFooter({
  fontSize,
}: {
  fontSize: number
}): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        color: COLORS.mutedInk,
        fontSize,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        marginLeft: 24,
      }}
    >
      Curated on Roam
    </div>
  )
}

function CollectionCover({
  imageUrl,
  title,
  city,
  radius,
  variant,
}: {
  imageUrl: string | null
  title: string
  city: string | null
  radius: number
  variant: CollectionShareArtworkVariant
}): ReactElement {
  const isStory =
    variant === 'story'

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight:
          isStory
            ? 720
            : undefined,
        overflow: 'hidden',
        borderRadius: radius,
        background:
          'linear-gradient(145deg, #777f69 0%, #454c40 55%, #2f352d 100%)',
        boxShadow:
          isStory
            ? '0 28px 80px rgba(36, 39, 33, 0.16)'
            : '0 20px 54px rgba(36, 39, 33, 0.15)',
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          width={
            isStory ? 936 : 420
          }
          height={
            isStory ? 860 : 522
          }
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <CollectionCoverFallback
          title={title}
          city={city}
          variant={variant}
        />
      )}

      <div
        style={{
          display: 'flex',
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(15, 18, 14, 0.02) 38%, rgba(15, 18, 14, 0.44) 100%)',
        }}
      />

      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: isStory ? 34 : 24,
          bottom: isStory ? 34 : 24,
          alignItems: 'center',
          borderRadius: 999,
          background:
            'rgba(247, 243, 233, 0.92)',
          color: COLORS.ink,
          fontSize: isStory
            ? 22
            : 17,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          padding: isStory
            ? '14px 19px'
            : '11px 15px',
        }}
      >
        {city
          ? `Roam · ${city}`
          : 'Roam Collection'}
      </div>
    </div>
  )
}

function CollectionCoverFallback({
  title,
  city,
  variant,
}: {
  title: string
  city: string | null
  variant: CollectionShareArtworkVariant
}): ReactElement {
  const isStory =
    variant === 'story'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'absolute',
        inset: 0,
        padding:
          isStory
            ? 54
            : 34,
        background:
          'linear-gradient(145deg, #7b836d 0%, #555d4d 48%, #343b32 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          width:
            isStory
              ? 180
              : 110,
          height:
            isStory
              ? 180
              : 110,
          borderRadius: 999,
          border:
            '1px solid rgba(255, 255, 255, 0.20)',
          background:
            'rgba(255, 255, 255, 0.07)',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '90%',
          paddingBottom:
            isStory
              ? 72
              : 48,
        }}
      >
        {city ? (
          <div
            style={{
              display: 'flex',
              color:
                'rgba(255, 255, 255, 0.72)',
              fontSize:
                isStory
                  ? 24
                  : 17,
              fontWeight: 650,
              letterSpacing:
                '0.12em',
              lineHeight: 1,
              textTransform:
                'uppercase',
            }}
          >
            {city}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            color: COLORS.white,
            fontSize:
              isStory
                ? 54
                : 34,
            fontWeight: 700,
            letterSpacing:
              '-0.04em',
            lineHeight: 1.02,
            marginTop:
              city
                ? isStory
                  ? 18
                  : 12
                : 0,
          }}
        >
          {title}
        </div>
      </div>
    </div>
  )
}

function DecorativeStoryGlow(): ReactElement {
  return (
    <>
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          width: 620,
          height: 620,
          borderRadius: 620,
          background:
            'rgba(104, 113, 92, 0.10)',
          right: -280,
          top: -220,
        }}
      />

      <div
        style={{
          display: 'flex',
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: 420,
          background:
            'rgba(180, 165, 132, 0.10)',
          left: -240,
          bottom: 180,
        }}
      />
    </>
  )
}

function rootStyle(
  theme: ArtworkTheme
): CSSProperties {
  return {
    display: 'flex',
    position: 'relative',
    width: theme.width,
    height: theme.height,
    overflow: 'hidden',
    padding: theme.outerPadding,
    boxSizing: 'border-box',
    color: COLORS.ink,
    fontFamily:
      'Arial, Helvetica, sans-serif',
  }
}

function normalizeTitle(
  value: string
): string {
  return (
    normalizeText(value) ??
    'A Collection Worth Knowing'
  )
}

function normalizeText(
  value: string | null
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized || null
}

function normalizeArtworkImageUrl(
  value: string | null
): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  try {
    const parsed = new URL(
      normalized
    )

    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

function getCreatorInitial(
  creatorLabel: string,
  creatorHandle: string | null
): string {
  const source =
    creatorLabel ||
    creatorHandle ||
    'R'

  const normalized = source
    .replace(/^@+/, '')
    .trim()

  return (
    normalized
      .charAt(0)
      .toUpperCase() || 'R'
  )
}

function getStoryTitleSize(
  title: string,
  defaultSize: number
): number {
  if (title.length > 80) {
    return 58
  }

  if (title.length > 56) {
    return 66
  }

  if (title.length > 34) {
    return 74
  }

  return defaultSize
}

function getOgTitleSize(
  title: string,
  defaultSize: number
): number {
  if (title.length > 80) {
    return 40
  }

  if (title.length > 56) {
    return 46
  }

  if (title.length > 34) {
    return 52
  }

  return defaultSize
}