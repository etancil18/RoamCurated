'use client'

import { useMemo, useState } from 'react'

type ShareProfileButtonProps = {
  username: string | null
  fullName?: string | null
  className?: string
}

export default function ShareProfileButton({
  username,
  fullName = null,
  className = '',
}: ShareProfileButtonProps) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const profileUrl = useMemo(() => {
    if (!username) return ''

    if (typeof window === 'undefined') {
      return `/u/${username}`
    }

    return `${window.location.origin}/u/${username}`
  }, [username])

  const shareTitle = fullName
    ? `${fullName} on Roam`
    : username
      ? `@${username} on Roam`
      : 'Roam Profile'

  const shareText = username
    ? `Check out @${username}'s Roam Passport.`
    : 'Check out this Roam Passport.'

  async function handleShare() {
    if (!profileUrl || sharing) return

    setSharing(true)
    setCopied(false)

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: profileUrl,
        })

        return
      }

      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 2200)
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return

      try {
        await navigator.clipboard.writeText(profileUrl)
        setCopied(true)

        window.setTimeout(() => {
          setCopied(false)
        }, 2200)
      } catch (clipboardError) {
        console.error('[ShareProfileButton] Failed to share profile:', clipboardError)
      }
    } finally {
      setSharing(false)
    }
  }

  if (!username) return null

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      disabled={sharing}
      className={[
        'inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-cyan-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true">↗</span>
      <span>
        {sharing ? 'Sharing…' : copied ? 'Copied Link' : 'Share Profile'}
      </span>
    </button>
  )
}