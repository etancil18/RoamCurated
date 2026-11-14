
'use client'

import { useEffect, useRef } from 'react'

import { logEvent } from '@/lib/logEvent'

type Props = {
  editionCount: number
}

function safeLogEvent(
  eventName: string,
  metadata: Record<string, unknown>
) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    ).catch((error: unknown) => {
      console.warn(
        '[EditionsLibraryAnalytics] Event logging failed:',
        error
      )
    })
  } catch (error) {
    console.warn(
      '[EditionsLibraryAnalytics] Event logging failed:',
      error
    )
  }
}

export default function EditionsLibraryAnalytics({
  editionCount,
}: Props) {
  const pageViewLoggedRef = useRef(false)

  useEffect(() => {
    if (!pageViewLoggedRef.current) {
      pageViewLoggedRef.current = true

      safeLogEvent('editions_library_viewed', {
        page: 'editions_library',
        pathname: '/editions',
        edition_count: editionCount,
        has_published_editions: editionCount > 0,
      })
    }

    function handleEditionClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) {
        return
      }

      const link = event.target.closest<HTMLAnchorElement>(
        'a[data-roam-edition-id]'
      )

      if (!link) {
        return
      }

      const editionId = link.dataset.roamEditionId

      if (!editionId) {
        return
      }

      const position = Number(
        link.dataset.roamEditionPosition
      )

      safeLogEvent('editions_library_edition_clicked', {
        page: 'editions_library',
        pathname: '/editions',
        edition_id: editionId,
        edition_position:
          Number.isInteger(position) && position > 0
            ? position
            : null,
        edition_count: editionCount,
        city: link.dataset.roamEditionCity || null,
        credit_mode:
          link.dataset.roamEditionCreditMode || null,
        destination: link.getAttribute('href'),
      })
    }

    document.addEventListener('click', handleEditionClick)

    return () => {
      document.removeEventListener(
        'click',
        handleEditionClick
      )
    }
  }, [editionCount])

  return null
}
