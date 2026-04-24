'use client'

import React from 'react'
import Link from 'next/link'
import {
  Globe,
  Instagram,
  Facebook,
  Twitter,
  Music,
  Link as LinkIcon,
} from 'lucide-react'
import { logEvent } from '@/lib/logEvent'

type Props = {
  contact?: string[] | null
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(logEvent(eventName, metadata))
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

const getSocialMeta = (url: string): {
  label: string
  icon: React.ReactElement
  platform: string
} => {
  const lower = url.toLowerCase()

  if (lower.includes('instagram.com')) {
    return {
      label: 'Follow on Instagram',
      icon: <Instagram size={16} />,
      platform: 'instagram',
    }
  } else if (lower.includes('facebook.com')) {
    return {
      label: 'View on Facebook',
      icon: <Facebook size={16} />,
      platform: 'facebook',
    }
  } else if (lower.includes('tiktok.com')) {
    return {
      label: 'Watch on TikTok',
      icon: <Music size={16} />,
      platform: 'tiktok',
    }
  } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return {
      label: 'Follow on Twitter/X',
      icon: <Twitter size={16} />,
      platform: 'twitter',
    }
  } else if (lower.includes('linktr.ee')) {
    return {
      label: 'View Linktree',
      icon: <LinkIcon size={16} />,
      platform: 'linktree',
    }
  }

  return {
    label: 'Visit Website',
    icon: <Globe size={16} />,
    platform: 'website',
  }
}

export default function SocialLinks({ contact }: Props) {
  if (!contact || contact.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Connect with them
      </h2>

      <div className="flex flex-wrap gap-4">
        {contact.map((rawUrl) => {
          const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
          const { label, icon, platform } = getSocialMeta(url)

          return (
            <Link
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                safeLogEvent('venue_social_click', {
                  url,
                  platform,
                  label,
                })
              }
              className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {icon}
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}