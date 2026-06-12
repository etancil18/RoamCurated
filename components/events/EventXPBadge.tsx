'use client'

type EventXPBadgeProps = {
  xpReward?: number | null
  size?: 'sm' | 'md'
}

export default function EventXPBadge({
  xpReward = 25,
  size = 'sm',
}: EventXPBadgeProps) {
  const xp = typeof xpReward === 'number' ? xpReward : 25

  const classes =
    size === 'md'
      ? 'px-3 py-1.5 text-sm'
      : 'px-2 py-1 text-xs'

  return (
    <div
      className={`
        inline-flex items-center gap-1
        rounded-full
        border border-amber-500/30
        bg-amber-500/10
        text-amber-300
        font-medium
        ${classes}
      `}
    >
      <span>⚡</span>
      <span>+{xp} XP</span>
    </div>
  )
}