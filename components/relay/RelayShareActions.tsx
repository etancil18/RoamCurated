'use client'

import {
  useCallback,
  useMemo,
  useState,
} from 'react'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayShareActionsProps = {
  /**
   * Canonical public artifact URL.
   *
   * This should resolve to the existing public artifact route,
   * for example:
   *
   * /competitions/artifact/[artifactId]
   *
   * Do not pass a team URL, relay execution URL, or replay URL.
   */
  href:
    string

  title:
    string

  text?:
    string | null

  className?:
    string

  compact?:
    boolean

  showCopy?:
    boolean

  showNativeShare?:
    boolean
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayShareActions({
  href,
  title,
  text =
    null,
  className,
  compact =
    false,
  showCopy =
    true,
  showNativeShare =
    true,
}: RelayShareActionsProps) {
  const [
    copyState,
    setCopyState,
  ] =
    useState<
      | 'idle'
      | 'copied'
      | 'error'
    >(
      'idle'
    )


  const absoluteHref =
    useMemo(
      () =>
        resolveCanonicalShareUrl(
          href
        ),
      [
        href,
      ]
    )


  const canNativeShare =
    typeof navigator !==
      'undefined' &&
    typeof navigator.share ===
      'function'


  const handleNativeShare =
    useCallback(
      async () => {
        if (
          !absoluteHref ||
          !canNativeShare
        ) {
          return
        }


        try {
          await navigator.share({
            title,
            text:
              text ??
              undefined,
            url:
              absoluteHref,
          })
        } catch (
          error
        ) {
          /*
           * Native share rejection is commonly user cancellation.
           * Do not surface cancellation as an error state.
           */
          if (
            isAbortError(
              error
            )
          ) {
            return
          }


          console.error(
            '[relay/share] Native share failed:',
            error
          )
        }
      },
      [
        absoluteHref,
        canNativeShare,
        text,
        title,
      ]
    )


  const handleCopy =
    useCallback(
      async () => {
        if (
          !absoluteHref
        ) {
          setCopyState(
            'error'
          )

          return
        }


        try {
          await copyText(
            absoluteHref
          )

          setCopyState(
            'copied'
          )


          window.setTimeout(
            () => {
              setCopyState(
                'idle'
              )
            },
            1800
          )
        } catch (
          error
        ) {
          console.error(
            '[relay/share] Copy failed:',
            error
          )

          setCopyState(
            'error'
          )
        }
      },
      [
        absoluteHref,
      ]
    )


  if (
    !absoluteHref
  ) {
    return null
  }


  const renderNativeShare =
    showNativeShare &&
    canNativeShare


  const renderCopy =
    showCopy


  if (
    !renderNativeShare &&
    !renderCopy
  ) {
    return null
  }


  return (
    <div
      className={[
        'flex',
        'flex-wrap',
        'items-center',
        'gap-2',
        className,
      ]
        .filter(
          Boolean
        )
        .join(
          ' '
        )}
      data-relay-share-actions
    >
      {renderNativeShare ? (
        <button
          type="button"
          onClick={
            handleNativeShare
          }
          className={[
            'inline-flex',
            'items-center',
            'justify-center',
            'rounded-full',
            'border',
            'border-violet-300/16',
            'bg-violet-300/[0.055]',
            'font-semibold',
            'text-violet-50',
            'transition',
            'hover:border-violet-300/26',
            'hover:bg-violet-300/[0.09]',
            'focus-visible:outline-none',
            'focus-visible:ring-2',
            'focus-visible:ring-violet-300/35',
            'focus-visible:ring-offset-2',
            'focus-visible:ring-offset-[#070707]',
            compact
              ? 'min-h-9 px-3 text-xs'
              : 'min-h-11 px-5 text-sm',
          ].join(
            ' '
          )}
        >
          <ShareIcon
            compact={
              compact
            }
          />

          <span className="ml-2">
            Share
          </span>
        </button>
      ) : null}


      {renderCopy ? (
        <button
          type="button"
          onClick={
            handleCopy
          }
          aria-live="polite"
          className={[
            'inline-flex',
            'items-center',
            'justify-center',
            'rounded-full',
            'border',
            'font-semibold',
            'transition',
            'focus-visible:outline-none',
            'focus-visible:ring-2',
            'focus-visible:ring-white/25',
            'focus-visible:ring-offset-2',
            'focus-visible:ring-offset-[#070707]',
            copyState ===
            'copied'
              ? 'border-emerald-300/14 bg-emerald-300/[0.045] text-emerald-50'
              : copyState ===
                  'error'
                ? 'border-red-300/14 bg-red-300/[0.035] text-red-100/70'
                : 'border-white/[0.09] bg-black/15 text-white/52 hover:border-white/[0.15] hover:bg-white/[0.04] hover:text-white/72',
            compact
              ? 'min-h-9 px-3 text-xs'
              : 'min-h-11 px-5 text-sm',
          ].join(
            ' '
          )}
        >
          <CopyIcon
            compact={
              compact
            }
          />

          <span className="ml-2">
            {getCopyLabel(
              copyState
            )}
          </span>
        </button>
      ) : null}
    </div>
  )
}


/* ============================================================
 * SHARE URL
 * ============================================================
 */

function resolveCanonicalShareUrl(
  href:
    string
): string | null {
  const normalizedHref =
    href.trim()


  if (
    !normalizedHref
  ) {
    return null
  }


  try {
    /*
     * Absolute URL already supplied.
     */
    return new URL(
      normalizedHref
    ).toString()
  } catch {
    /*
     * Relative canonical artifact route.
     *
     * This component is client-only, so window.location.origin is
     * available after hydration.
     */
    if (
      typeof window ===
      'undefined'
    ) {
      return normalizedHref
    }


    try {
      return new URL(
        normalizedHref,
        window.location.origin
      ).toString()
    } catch {
      return null
    }
  }
}


/* ============================================================
 * COPY
 * ============================================================
 */

async function copyText(
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


  fallbackCopyText(
    value
  )
}


function fallbackCopyText(
  value:
    string
): void {
  if (
    typeof document ===
    'undefined'
  ) {
    throw new Error(
      'Clipboard is unavailable.'
    )
  }


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

  textarea.style.left =
    '-9999px'

  textarea.style.top =
    '0'


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


  if (
    !copied
  ) {
    throw new Error(
      'Clipboard copy failed.'
    )
  }
}


/* ============================================================
 * ERROR
 * ============================================================
 */

function isAbortError(
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


/* ============================================================
 * LABEL
 * ============================================================
 */

function getCopyLabel(
  state:
    | 'idle'
    | 'copied'
    | 'error'
): string {
  switch (
    state
  ) {
    case 'copied':
      return 'Copied'

    case 'error':
      return 'Copy failed'

    case 'idle':
      return 'Copy link'
  }
}


/* ============================================================
 * ICONS
 * ============================================================
 */

function ShareIcon({
  compact,
}: {
  compact:
    boolean
}) {
  const size =
    compact
      ? 14
      : 16


  return (
    <svg
      aria-hidden="true"
      width={
        size
      }
      height={
        size
      }
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <path
        d="M12 16V4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="M8 8L12 4L16 8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M5 13V19C5 19.5523 5.44772 20 6 20H18C18.5523 20 19 19.5523 19 19V13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}


function CopyIcon({
  compact,
}: {
  compact:
    boolean
}) {
  const size =
    compact
      ? 14
      : 16


  return (
    <svg
      aria-hidden="true"
      width={
        size
      }
      height={
        size
      }
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <rect
        x="8"
        y="8"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M16 8V6C16 5.44772 15.5523 5 15 5H6C5.44772 5 5 5.44772 5 6V15C5 15.5523 5.44772 16 6 16H8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}


export default RelayShareActions