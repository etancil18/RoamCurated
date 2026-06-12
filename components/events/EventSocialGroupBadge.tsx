'use client'

import Link from 'next/link'

type EventSocialGroupBadgeProps = {
  socialGroupId?: string | null
  socialGroupName?: string | null
  socialGroupSlug?: string | null
  logoUrl?: string | null
  size?: 'sm' | 'md'
}

export default function EventSocialGroupBadge({
  socialGroupId,
  socialGroupName,
  socialGroupSlug,
  logoUrl,
  size = 'sm',
}: EventSocialGroupBadgeProps) {
  if (!socialGroupId && !socialGroupName) return null

  const label = socialGroupName ?? 'Social Group'
  const href = socialGroupSlug ? `/social-groups/${socialGroupSlug}` : null

  const wrapperClasses =
    size === 'md'
      ? 'gap-2 rounded-full px-3 py-1.5 text-sm'
      : 'gap-1.5 rounded-full px-2 py-1 text-xs'

  const logoClasses =
    size === 'md' ? 'h-5 w-5' : 'h-4 w-4'

  const content = (
    <span
      className={`
        inline-flex items-center
        border border-cyan-500/30
        bg-cyan-500/10
        font-medium text-cyan-300
        ${wrapperClasses}
      `}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className={`${logoClasses} rounded-full object-cover`}
        />
      ) : (
        <span aria-hidden="true">👥</span>
      )}

      <span>Hosted by {label}</span>
    </span>
  )

  if (!href) return content

  return (
    <Link
      href={href}
      className="inline-flex transition hover:opacity-80"
    >
      {content}
    </Link>
  )
}