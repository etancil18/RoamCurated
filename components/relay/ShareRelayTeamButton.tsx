'use client'

import {
  useState,
} from 'react'

import type {
  RelayTeamId,
} from '@/lib/relay/types'


/* ============================================================
 * PROPS
 * ============================================================
 */

type ShareRelayTeamButtonProps = {
  teamId:
    RelayTeamId

  teamName?:
    string | null

  relayTitle?:
    string | null

  className?:
    string
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export default function ShareRelayTeamButton({
  teamId,
  teamName,
  relayTitle,
  className,
}: ShareRelayTeamButtonProps) {
  const [
    status,
    setStatus,
  ] =
    useState<
      'idle' |
      'copied' |
      'error'
    >(
      'idle'
    )

  const [
    isSharing,
    setIsSharing,
  ] =
    useState(
      false
    )


  async function handleShare() {
    if (isSharing) {
      return
    }

    setStatus(
      'idle'
    )

    setIsSharing(
      true
    )

    try {
      const url =
        buildCanonicalTeamUrl(
          teamId
        )

      const title =
        buildShareTitle(
          teamName,
          relayTitle
        )

      const text =
        buildShareText(
          teamName,
          relayTitle
        )


      if (
        typeof navigator !==
          'undefined' &&
        typeof navigator.share ===
          'function'
      ) {
        try {
          await navigator.share({
            title,
            text,
            url,
          })

          return
        } catch (
          shareError
        ) {
          if (
            isShareCancellation(
              shareError
            )
          ) {
            return
          }

          /*
           * If the native share sheet exists but fails for a
           * non-cancellation reason, fall through to copy-link.
           */
        }
      }


      await copyTextToClipboard(
        url
      )

      setStatus(
        'copied'
      )

      window.setTimeout(
        () => {
          setStatus(
            (
              currentStatus
            ) =>
              currentStatus ===
                'copied'
                ? 'idle'
                : currentStatus
          )
        },
        2200
      )
    } catch (
      error
    ) {
      console.error(
        '[ShareRelayTeamButton] Team sharing failed:',
        error
      )

      setStatus(
        'error'
      )
    } finally {
      setIsSharing(
        false
      )
    }
  }


  const label =
    status ===
      'copied'
      ? 'Link copied'
      : isSharing
        ? 'Sharing…'
        : 'Share team'


  return (
    <div
      className={[
        'inline-flex',
        'flex-col',
        'items-start',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        onClick={
          handleShare
        }
        disabled={
          isSharing
        }
        aria-live="polite"
        className={[
          'inline-flex',
          'min-h-10',
          'items-center',
          'justify-center',
          'rounded-full',
          'border',
          'border-white/10',
          'bg-white/[0.04]',
          'px-4',
          'text-xs',
          'font-semibold',
          'text-white/75',
          'transition',
          'hover:border-white/20',
          'hover:bg-white/[0.07]',
          'hover:text-white',
          'disabled:cursor-not-allowed',
          'disabled:opacity-50',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-white/35',
          'focus-visible:ring-offset-2',
          'focus-visible:ring-offset-[#070707]',
        ].join(' ')}
      >
        {label}
      </button>

      {status ===
      'error' ? (
        <p
          role="alert"
          className="mt-2 text-[11px] leading-4 text-red-300"
        >
          Could not share this team link.
        </p>
      ) : null}
    </div>
  )
}


/* ============================================================
 * CANONICAL URL
 * ============================================================
 */

function buildCanonicalTeamUrl(
  teamId:
    RelayTeamId
): string {
  const path =
    `/competitions/team/${teamId}`

  if (
    typeof window ===
    'undefined'
  ) {
    return path
  }

  return new URL(
    path,
    window.location.origin
  ).toString()
}


/* ============================================================
 * SHARE COPY
 * ============================================================
 */

function buildShareTitle(
  teamName:
    string | null | undefined,
  relayTitle:
    string | null | undefined
): string {
  const normalizedTeamName =
    teamName
      ?.trim() ||
    null

  const normalizedRelayTitle =
    relayTitle
      ?.trim() ||
    null


  if (
    normalizedTeamName &&
    normalizedRelayTitle
  ) {
    return `${normalizedTeamName} · ${normalizedRelayTitle}`
  }


  if (normalizedTeamName) {
    return normalizedTeamName
  }


  if (normalizedRelayTitle) {
    return normalizedRelayTitle
  }


  return 'Roam Relay team'
}


function buildShareText(
  teamName:
    string | null | undefined,
  relayTitle:
    string | null | undefined
): string {
  const normalizedTeamName =
    teamName
      ?.trim() ||
    null

  const normalizedRelayTitle =
    relayTitle
      ?.trim() ||
    null


  if (
    normalizedTeamName &&
    normalizedRelayTitle
  ) {
    return `Join ${normalizedTeamName} for ${normalizedRelayTitle} on Roam.`
  }


  if (normalizedTeamName) {
    return `Join ${normalizedTeamName} on Roam.`
  }


  if (normalizedRelayTitle) {
    return `Join my team for ${normalizedRelayTitle} on Roam.`
  }


  return 'Join my Roam Relay team.'
}


/* ============================================================
 * CLIPBOARD
 * ============================================================
 */

async function copyTextToClipboard(
  value:
    string
): Promise<void> {
  if (
    typeof navigator !==
      'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText ===
      'function'
  ) {
    await navigator.clipboard.writeText(
      value
    )

    return
  }


  /*
   * Fallback for older browsers / restricted clipboard contexts.
   */
  const textarea =
    document.createElement(
      'textarea'
    )

  textarea.value =
    value

  textarea.setAttribute(
    'readonly',
    ''
  )

  textarea.style.position =
    'fixed'

  textarea.style.opacity =
    '0'

  textarea.style.pointerEvents =
    'none'

  document.body.appendChild(
    textarea
  )

  textarea.select()


  const copied =
    document.execCommand(
      'copy'
    )

  document.body.removeChild(
    textarea
  )


  if (!copied) {
    throw new Error(
      'Clipboard copy failed.'
    )
  }
}


/* ============================================================
 * NATIVE SHARE CANCELLATION
 * ============================================================
 */

function isShareCancellation(
  error:
    unknown
): boolean {
  return (
    error instanceof
      DOMException &&
    error.name ===
      'AbortError'
  )
}