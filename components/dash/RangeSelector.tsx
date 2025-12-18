'use client'

import { useState } from 'react'

const RANGE_OPTIONS = [
  { label: '24 Hours', value: '24h' },
  { label: 'Past Week', value: '7d' },
  { label: 'Past Month', value: '30d' },
  { label: 'Custom Range', value: 'custom' },
]

type Props = {
  onChange: (value: { range: string; start: string; end: string }) => void
}

export default function RangeSelector({ onChange }: Props) {
  const [selected, setSelected] = useState('7d')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  return (
    <div className="flex gap-2 items-center">
      <select
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value)
          onChange({ range: e.target.value, start: '', end: '' })
        }}
        className="p-2 border rounded"
      >
        {RANGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {selected === 'custom' && (
        <>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => {
              setStart(e.target.value)
              onChange({ range: 'custom', start: e.target.value, end })
            }}
            className="p-2 border rounded"
          />
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value)
              onChange({ range: 'custom', start, end: e.target.value })
            }}
            className="p-2 border rounded"
          />
        </>
      )}
    </div>
  )
}
