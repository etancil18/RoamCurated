'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { inBrowser, getOrigin } from '@/lib/browser'

export default function SharePreview() {
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const pathname = usePathname()

  useEffect(() => {
    if (!inBrowser()) return
    const origin = getOrigin()
    setShareUrl(`${origin}${pathname}`)
  }, [pathname])

  const handleCopy = async () => {
    if (!shareUrl) return
    if (inBrowser()) {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="mt-6 space-y-3 border p-4 rounded-xl bg-muted dark:bg-gray-800 dark:border-gray-700">
      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
        📢 Share This Crawl
      </h3>
      <p className="text-sm text-muted-foreground dark:text-gray-300">
        Invite your friends — just send them this link:
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={shareUrl}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm text-gray-900 dark:bg-gray-900 dark:text-white dark:border-gray-600"
        />
        <Button onClick={handleCopy} variant="outline" size="sm">
          {copied ? 'Copied!' : <Copy className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  )
}
