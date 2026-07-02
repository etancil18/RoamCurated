'use client'

import { Button } from '@/components/ui/button'
import { logEvent } from '@/lib/logEvent'

type FlowReadyActionsProps = {
  city?: 'atl' | 'nyc' | 'lisbon' | 'porto' | 'london' | 'la' | null
  stopCount?: number
  onStart?: () => void
  onRetry?: () => void
  onHost?: () => void
  className?: string
}

export default function FlowReadyActions({
  city = null,
  stopCount = 0,
  onStart,
  onRetry,
  onHost,
  className = '',
}: FlowReadyActionsProps) {
  const safeStopCount = Math.max(0, stopCount)
  const availableXp = safeStopCount * 25 + 100

  return (
    <div
      className={[
        'rounded-2xl border border-indigo-500/40 bg-indigo-50/95 p-3 shadow-lg backdrop-blur-md dark:bg-indigo-950/90',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Flow Ready
        </p>

        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
          {safeStopCount} stops • +{availableXp} XP available
        </p>

        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Start this route, retry it, or publish it as a crawl.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          className="h-9 text-xs bg-indigo-600 text-white hover:bg-indigo-700"
          onClick={() => {
            onStart?.()
            logEvent('generated_flow_started', {
              metadata: { city, stops: safeStopCount },
            })
          }}
          disabled={!onStart}
        >
          ▶ Start
        </Button>

        <Button
          variant="outline"
          className="h-9 text-xs border-indigo-500 text-indigo-700 dark:text-indigo-300"
          onClick={() => {
            onRetry?.()
            logEvent('generated_route_retry_clicked', {
              metadata: { city, stops: safeStopCount },
            })
          }}
          disabled={!onRetry}
        >
          Retry
        </Button>

        <Button
          variant="outline"
          className="h-9 text-xs border-indigo-500 text-indigo-700 dark:text-indigo-300"
          onClick={() => {
            onHost?.()
            logEvent('generated_flow_host_clicked', {
              metadata: { city, stops: safeStopCount },
            })
          }}
          disabled={!onHost}
        >
          Host
        </Button>
      </div>
    </div>
  )
}