'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'
import { inBrowser, getOrigin } from '@/lib/browser'

type Props = {
  title: string
  city: string
  slug: string
}

export default function SharePreview({ title, city, slug }: Props) {
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const pathname = usePathname()

  useEffect(() => {
    if (!inBrowser()) return
    const origin = getOrigin()

    // ✅ Use invite route (future deep link ready)
    setShareUrl(`${origin}/sponsor/${slug}`)
  }, [slug])

  const handleShare = async () => {
    if (!shareUrl) return

    const shareText = `Join “${title}” in ${city} 🍻`

    // Native share sheet (best UX on mobile)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareText,
          text: shareText,
          url: shareUrl,
        })
        return
      } catch (err) {
        console.error('[SharePreview] Native share failed:', err)
      }
    }

    // SMS fallback
    if (typeof window !== 'undefined') {
      const smsBody = encodeURIComponent(
        `${shareText}\n\n${shareUrl}`
      )
      window.location.href = `sms:&body=${smsBody}`
      return
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[SharePreview] Copy fallback failed:', err)
    }
  }

  return (
    <div className="mt-4">
      <Button
        onClick={handleShare}
        className="w-full bg-black text-white hover:bg-black/90"
      >
        {copied ? 'Link copied!' : 'Invite your friends'}
      </Button>
    </div>
  )
}