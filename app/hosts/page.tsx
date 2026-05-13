'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QRCodeSVG } from 'qrcode.react'
import { logEvent } from '@/lib/logEvent'

const HOST_CITY_OPTIONS = [
  { value: 'atl', label: 'Atlanta' },
  { value: 'nyc', label: 'New York City' },
  { value: 'porto', label: 'Porto' },
  { value: 'lisbon', label: 'Lisbon' },
] as const

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(logEvent(eventName, metadata))
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

export default function HostsPage() {
  const [name,setName] = useState('')
  const [city,setCity] = useState('')
  const [address,setAddress] = useState('')
  const [website,setWebsite] = useState('')
  const [link,setLink] = useState<string | null>(null)
  const [loading,setLoading] = useState(false)
  const [welcomeDescription, setWelcomeDescription] = useState('')

  useEffect(() => {
    safeLogEvent('host_guide_page_viewed')
  }, [])

  async function submit(){
    safeLogEvent('host_guide_create_clicked', {
      city,
      has_name: Boolean(name.trim()),
      has_address: Boolean(address.trim()),
      has_website: Boolean(website.trim()),
      has_welcome_description: Boolean(welcomeDescription.trim()),
    })

    setLoading(true)

    try {
      const res = await fetch('/api/hosts/create',{
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ name,city,address,website,welcomeDescription }),
      })

      const data = await res.json()

      setLoading(false)

      if(data.url){
        try{
          const baseUrl =
            process.env.NEXT_PUBLIC_SITE_URL ||
            'https://roam-curated.vercel.app'

          const resolvedUrl = new URL(data.url, baseUrl)

          const parts = resolvedUrl.pathname.split('/')

          const city = parts[2]
          const slug = parts[3]

          const redirectLink =
            city && slug
              ? `${baseUrl}/open/property/${city}/${slug}`
              : resolvedUrl.toString()

          setLink(redirectLink)

          safeLogEvent('host_guide_created', {
            city,
            slug,
            guide_url: redirectLink,
          })

        } catch {
          const baseUrl =
            process.env.NEXT_PUBLIC_SITE_URL ||
            'https://roam-curated.vercel.app'

          const fallbackLink = `${baseUrl}${data.url.startsWith('/') ? data.url : `/${data.url}`}`

          setLink(fallbackLink)

          safeLogEvent('host_guide_created', {
            city,
            guide_url: fallbackLink,
            used_fallback_url_resolution: true,
          })
        }
      } else {
        safeLogEvent('host_guide_create_failed', {
          city,
          status: res.status,
          response: data,
        })
      }
    } catch (error) {
      setLoading(false)

      safeLogEvent('host_guide_create_error', {
        city,
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  function copyLink(){
    if(!link) return

    navigator.clipboard.writeText(link)

    safeLogEvent('host_guide_link_copied', {
      city,
      guide_url: link,
    })
  }

  function printGuideCard(){
    if(!link) return

    safeLogEvent('host_guide_qr_card_print_clicked', {
      city,
      guide_url: link,
    })

    const qrUrl =
      `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(link)}`

    const title = name || 'Your Neighborhood Guide'

    const printWindow = window.open('', '_blank')

    if(!printWindow) return

    printWindow.document.write(`
      <html>
      <head>
        <title>Roam Guide</title>

        <style>
          body{
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            display:flex;
            align-items:center;
            justify-content:center;
            height:100vh;
            margin:0;
            background:white;
          }

          .card{
            text-align:center;
            padding:40px;
            border:1px solid #ddd;
            border-radius:12px;
            width:420px;
          }

          h1{
            font-size:26px;
            margin-bottom:8px;
          }

          p{
            color:#555;
            margin-bottom:20px;
          }

          img{
            width:260px;
            height:260px;
          }

          .footer{
            margin-top:20px;
            font-size:14px;
            color:#777;
          }

        </style>

      </head>

      <body>

        <div class="card">

          <h1>${title}</h1>

          <p>
            Scan for your neighborhood guide
          </p>

          <img src="${qrUrl}" />

          <div class="footer">
            roamapp.io
          </div>

        </div>

        <script>
          window.onload = function(){
            window.print()
          }
        </script>

      </body>
      </html>
    `)

    printWindow.document.close()
  }

  return (
    <main className="mx-auto max-w-xl space-y-8 px-5 pb-8 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] sm:px-6">
      <div className="space-y-4 rounded-2xl border border-border bg-card/70 p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">
            For hosts, rentals, and boutique stays
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Create a Roam Neighborhood Guide
          </h1>

          <p className="text-base leading-7 text-muted-foreground">
            Create a shareable neighborhood guide for your guests with curated
            places to eat, drink, explore, and experience nearby. Roam turns
            your property into a more helpful, local-feeling stay.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/70 p-3">
            <p className="text-sm font-medium text-foreground">
              Curated local picks
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Restaurants, coffee, drinks, and nearby gems.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background/70 p-3">
            <p className="text-sm font-medium text-foreground">
              Guest-ready QR
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Print it or place it in your welcome book.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background/70 p-3">
            <p className="text-sm font-medium text-foreground">
              No app required
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Guests open the guide instantly on their phone.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Input
          placeholder="Property Name"
          value={name}
          onChange={(e)=>setName(e.target.value)}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">
            City
          </label>

          <select
            value={city}
            onChange={(e)=>{
              const nextCity = e.target.value
              setCity(nextCity)
              safeLogEvent('host_guide_city_selected', { city: nextCity })
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">Select a city</option>
            {HOST_CITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <p className="text-xs text-muted-foreground">
            Choose the main city your property belongs to. For places in
            Brooklyn, Queens, or Manhattan, select New York City.
          </p>
        </div>

        <Input
          placeholder="Property Address (example: 111 Main Street, ATLANTA, GA 30305)"
          value={address}
          onChange={(e)=>setAddress(e.target.value)}
        />

        <Input
          placeholder="Website (optional)"
          value={website}
          onChange={(e)=>setWebsite(e.target.value)}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Welcome Description (optional)
          </label>

          <textarea
            value={welcomeDescription}
            onChange={(e)=>setWelcomeDescription(e.target.value)}
            placeholder="Welcome to our place..."
            rows={5}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <Button
          className="w-full"
          onClick={submit}
          disabled={loading || !city}
        >
          {loading ? 'Creating Guide...' : 'Create Guide'}
        </Button>
      </div>

      {link && (
        <div className="space-y-5 rounded-lg border border-border bg-card/70 p-5 sm:p-6">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Your guide is ready
            </p>

            <p className="text-sm text-muted-foreground">
              Share this with guests so they can explore the neighborhood.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={link} readOnly />

            <Button variant="outline" onClick={copyLink}>
              Copy
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              onClick={()=>{
                safeLogEvent('host_guide_open_clicked', {
                  city,
                  guide_url: link,
                })
                window.open(link,'_blank')
              }}
            >
              Open Guide
            </Button>

            <Button
              variant="secondary"
              className="flex-1"
              onClick={printGuideCard}
            >
              Download QR Card
            </Button>
          </div>

          <div className="flex flex-col items-center gap-3 border-t border-border pt-4">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={link} size={180} level="H" />
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Guests can scan this QR code to open the guide instantly.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}