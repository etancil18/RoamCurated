
'use client'

import { useEffect, useRef } from 'react'

import { logEvent } from '@/lib/logEvent'

type Props = {
  editionId: string
  city: string | null
  creditMode: string
  placeCount: number
  hasCreatorProfile: boolean
}

function safeLogEvent(
  eventName: string,
  metadata: Record<string, unknown>,
) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      }),
    ).catch((error: unknown) => {
      console.warn(
        '[EditionReaderAnalytics] Event logging failed:',
        error,
      )
    })
  } catch (error) {
    console.warn(
      '[EditionReaderAnalytics] Event logging failed:',
      error,
    )
  }
}

export default function EditionReaderAnalytics({
  editionId,
  city,
  creditMode,
  placeCount,
  hasCreatorProfile,
}: Props) {
  const lastLoggedEditionRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastLoggedEditionRef.current !== editionId) {
      lastLoggedEditionRef.current = editionId

      safeLogEvent('edition_reader_viewed', {
        page: 'edition_reader',
        edition_id: editionId,
        city,
        credit_mode: creditMode,
        place_count: placeCount,
        has_creator_profile: hasCreatorProfile,
      })
    }

    function handleCreatorProfileClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) {
        return
      }

      const link = event.target.closest<HTMLAnchorElement>(
        'a[data-roam-edition-creator-profile]',
      )

      if (!link) {
        return
      }

      safeLogEvent('edition_creator_profile_clicked', {
        page: 'edition_reader',
        edition_id: editionId,
        city,
        credit_mode: creditMode,
        destination: link.getAttribute('href'),
      })
    }

    document.addEventListener(
      'click',
      handleCreatorProfileClick,
    )

    return () => {
      document.removeEventListener(
        'click',
        handleCreatorProfileClick,
      )
    }
  }, [
    editionId,
    city,
    creditMode,
    placeCount,
    hasCreatorProfile,
  ])

  return null
}
