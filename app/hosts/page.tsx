'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function HostsPage() {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)

    const res = await fetch('/api/hosts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, city, address, website }),
    })

    const data = await res.json()

    setLoading(false)

    if (data.url) {
      setLink(data.url)
    }
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">

      <h1 className="text-3xl font-bold">
        Create a Roam Neighborhood Guide
      </h1>

      <p className="text-muted-foreground">
        Give your guests the best local spots around your property.
      </p>

      <div className="space-y-4">

        <Input
          placeholder="Property Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          placeholder="City (example: atlanta)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        <Input
          placeholder="Property Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <Input
          placeholder="Website (optional)"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />

        <Button
          className="w-full"
          onClick={submit}
          disabled={loading}
        >
          {loading ? 'Creating Guide...' : 'Create Guide'}
        </Button>

      </div>

      {link && (
        <div className="p-4 border rounded-lg">

          <p className="font-medium">
            Your guide is ready:
          </p>

          <a
            href={link}
            className="text-blue-600 underline"
          >
            {link}
          </a>

        </div>
      )}

    </main>
  )
}