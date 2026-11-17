
'use client'

import { useEffect, useState } from 'react'
import { Check, Share2 } from 'lucide-react'

type Props = {
  path: string
  title: string
  description?: string
}

type ShareStatus = 'idle' | 'copied' | 'error'

async function copyUrl(url: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      // Fall through to the legacy clipboard method.
    }
  }

  const input = document.createElement('textarea')

  input.value = url
  input.readOnly = true
  input.style.position = 'fixed'
  input.style.opacity = '0'
  input.style.pointerEvents = 'none'

  document.body.appendChild(input)

  try {
    input.focus()
    input.select()

    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    input.remove()
  }
}

export default function ShareEditionLink({
  path,
  title,
  description,
}: Props) {
  const [status, setStatus] = useState<ShareStatus>('idle')

  useEffect(() => {
    if (status === 'idle') return

    const timeout = window.setTimeout(() => {
      setStatus('idle')
    }, 2500)

    return () => window.clearTimeout(timeout)
  }, [status])

  async function handleShare() {
    const url = new URL(path, window.location.origin).href

    setStatus('idle')

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        })

        return
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        // Sharing was unavailable or failed.
        // Offer the copy-link fallback instead.
      }
    }

    const copied = await copyUrl(url)

    setStatus(copied ? 'copied' : 'error')
  }

  const isCopied = status === 'copied'

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleShare()}
        aria-label={
          isCopied
            ? 'Link copied'
            : `Share ${title}`
        }
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 text-[11px] font-semibold text-[#d2ab86] transition hover:border-[#d2ab86]/50 hover:bg-white/[0.08] hover:text-[#f1d0af] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]"
      >
        {isCopied ? (
          <Check
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        ) : (
          <Share2
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        )}

        <span>
          {isCopied ? 'Copied' : 'Share'}
        </span>
      </button>

      <span
        role="status"
        aria-live="polite"
        className={
          status === 'error'
            ? 'text-[11px] text-red-300'
            : 'sr-only'
        }
      >
        {status === 'copied'
          ? 'Link copied to clipboard.'
          : status === 'error'
            ? 'Unable to copy link.'
            : ''}
      </span>
    </div>
  )
}
