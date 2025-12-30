'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts'
import RangeSelector from 'components/dash/RangeSelector'

type Props = {
  venueId: string
}

type Metrics = {
  favorites: number
  followers: number
  eventLikes: number
  crawlInclusions: number
  crawlInclusionTimeline: { date: string; count: number }[]
  crawlThemeBreakdown: { theme: string; count: number }[]
}

export default function DashboardMetrics({ venueId }: Props) {
  const [metrics, setMetrics] = useState<Metrics>({
    favorites: 0,
    followers: 0,
    eventLikes: 0,
    crawlInclusions: 0,
    crawlInclusionTimeline: [],
    crawlThemeBreakdown: [],
  })

  const [range, setRange] = useState({ range: '7d', start: '', end: '' })

  useEffect(() => {
    const fetchMetrics = async () => {
      let query = `venue_id=${venueId}`

      if (range.range === 'custom') {
        if (range.start && range.end) {
          query += `&range=custom&start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`
        } else {
          // fallback to 30-day default if custom selected but missing dates
          query += `&range=30day`
        }
      } else {
        query += `&range=${range.range}`
      }

      try {
        const res = await fetch(`/api/dash/metrics?${query}`)
        if (!res.ok) {
          console.error('❌ Metrics fetch failed:', await res.text())
          return
        }

        const json = await res.json()
        console.log('📦 Raw metrics API response:', json)

        const normalized: Metrics = {
          favorites: json.favorites ?? 0,
          followers: json.followers ?? 0, 
          eventLikes: json.eventLikes ?? 0,
          crawlInclusions: json.crawlInclusions ?? 0,
          crawlInclusionTimeline: json.crawlInclusionTimeline ?? [],
          crawlThemeBreakdown: json.crawlThemeBreakdown ?? [],
        }

        console.log('🧠 Normalized metrics state:', normalized)
        setMetrics(normalized)
      } catch (err) {
        console.error('🔥 Error fetching metrics:', err)
      }
    }

    fetchMetrics()
  }, [venueId, range])

  // 🔍 Render‑time diagnostics (SAFE)
  console.log('📊 Chart data lengths:', {
    timeline: metrics.crawlInclusionTimeline.length,
    breakdown: metrics.crawlThemeBreakdown.length,
  })

  if (metrics.crawlInclusionTimeline.length === 0) {
    console.warn('⚠️ Line chart skipped: crawlInclusionTimeline empty')
  }

  if (metrics.crawlThemeBreakdown.length === 0) {
    console.warn('⚠️ Bar chart skipped: crawlThemeBreakdown empty')
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Metrics</h2>
        <RangeSelector onChange={setRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Favorites" value={metrics.favorites} />
        <MetricCard label="Followers" value={metrics.followers} />  
        <MetricCard label="Event Likes" value={metrics.eventLikes} />
        <MetricCard label="Crawl Inclusions" value={metrics.crawlInclusions} />
      </div>

      {/* 📈 Line Chart */}
      {metrics.crawlInclusionTimeline.length > 0 && (
        <ChartCard title="Crawl Inclusions Over Time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.crawlInclusionTimeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#6366F1"
                strokeWidth={2}
                name="Inclusions"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* 📊 Bar Chart */}
      {metrics.crawlThemeBreakdown.length > 0 && (
        <ChartCard title="Crawl Theme Breakdown">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.crawlThemeBreakdown}>
              <XAxis dataKey="theme" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="text-md font-medium text-gray-800 dark:text-gray-100 mb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}
