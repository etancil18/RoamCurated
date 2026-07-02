'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QRCodeSVG } from 'qrcode.react'
import { logEvent } from '@/lib/logEvent'
import FeaturedPropertyGuidePreview from '@/components/property/FeaturedPropertyGuidePreview'

const HOST_CITY_OPTIONS = [
  { value: 'atl', label: 'Atlanta' },
  { value: 'nyc', label: 'New York City' },
  { value: 'porto', label: 'Porto' },
  { value: 'lisbon', label: 'Lisbon' },
] as const

const FEATURED_GUIDE_IMAGE_SRC = '/images/host-guide-preview-colony-square.png'

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(logEvent(eventName, metadata))
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

export default function HostsPage() {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [welcomeDescription, setWelcomeDescription] = useState('')
  const [featuredPreviewAvailable, setFeaturedPreviewAvailable] = useState(false)

  useEffect(() => {
    safeLogEvent('host_guide_page_viewed')
  }, [])

  useEffect(() => {
    let cancelled = false

    async function checkFeaturedPreviewImage() {
      try {
        const res = await fetch(FEATURED_GUIDE_IMAGE_SRC, {
          method: 'HEAD',
          cache: 'no-store',
        })

        if (!cancelled) {
          setFeaturedPreviewAvailable(res.ok)
        }
      } catch {
        if (!cancelled) {
          setFeaturedPreviewAvailable(false)
        }
      }
    }

    void checkFeaturedPreviewImage()

    return () => {
      cancelled = true
    }
  }, [])

  async function submit() {
    safeLogEvent('host_guide_create_clicked', {
      city,
      has_name: Boolean(name.trim()),
      has_address: Boolean(address.trim()),
      has_website: Boolean(website.trim()),
      has_welcome_description: Boolean(welcomeDescription.trim()),
    })

    setLoading(true)

    try {
      const res = await fetch('/api/hosts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, city, address, website, welcomeDescription }),
      })

      const data = await res.json()
      setLoading(false)

      if (data.url) {
        try {
          const baseUrl =
            process.env.NEXT_PUBLIC_SITE_URL ||
            'https://roam-curated.vercel.app'

          const resolvedUrl = new URL(data.url, baseUrl)
          const parts = resolvedUrl.pathname.split('/')
          const resolvedCity = parts[2]
          const slug = parts[3]

          const redirectLink =
            resolvedCity && slug
              ? `${baseUrl}/open/property/${resolvedCity}/${slug}`
              : resolvedUrl.toString()

          setLink(redirectLink)

          safeLogEvent('host_guide_created', {
            city: resolvedCity,
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

  function copyLink() {
    if (!link) return

    navigator.clipboard.writeText(link)

    safeLogEvent('host_guide_link_copied', {
      city,
      guide_url: link,
    })
  }

  function printGuideCard() {
    if (!link) return

    safeLogEvent('host_guide_qr_card_print_clicked', {
      city,
      guide_url: link,
    })

    const qrUrl =
      `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(link)}`

    const title = name || 'Your Neighborhood Guide'
    const printWindow = window.open('', '_blank')

    if (!printWindow) return

    printWindow.document.write(`
      <html>
      <head>
        <title>Roam Guide</title>
        <style>
          body{
            font-family:-apple-system,BlinkMacSystemFont,sans-serif;
            display:flex;
            align-items:center;
            justify-content:center;
            height:100vh;
            margin:0;
            background:#020617;
            color:white;
          }
          .card{
            text-align:center;
            padding:44px;
            border:1px solid rgba(255,255,255,.16);
            border-radius:28px;
            width:420px;
            background:linear-gradient(135deg,#020617,#111827,#020617);
            box-shadow:0 30px 90px rgba(0,0,0,.45);
          }
          h1{font-size:28px;margin-bottom:8px;}
          p{color:#cbd5e1;margin-bottom:22px;}
          img{
            width:260px;
            height:260px;
            background:white;
            padding:14px;
            border-radius:22px;
          }
          .footer{
            margin-top:22px;
            font-size:13px;
            letter-spacing:.28em;
            color:#94a3b8;
            text-transform:uppercase;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${title}</h1>
          <p>Scan for your curated neighborhood guide</p>
          <img src="${qrUrl}" />
          <div class="footer">Roam</div>
        </div>
        <script>window.onload=function(){window.print()}</script>
      </body>
      </html>
    `)

    printWindow.document.close()
  }

  return (
    <main className="min-h-screen overflow-hidden bg-black px-4 pb-12 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[-12%] top-[-12%] h-72 w-72 rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="absolute right-[-12%] top-[10%] h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[25%] h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl space-y-8">
        <section
          className={[
            'grid gap-5 lg:items-stretch',
            featuredPreviewAvailable
              ? 'lg:grid-cols-[0.95fr_1.05fr]'
              : 'lg:grid-cols-1',
          ].join(' ')}
        >
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
              For hosts, rentals, boutique stays
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Turn your stay into a local experience.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Roam creates a curated neighborhood guide guests can open instantly:
              nearby food, drinks, walks, hidden gems, and ready-to-go routes around
              your property.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <Benefit title="Instant QR access" body="Place it in your welcome book, lobby, or guest message." />
              <Benefit title="Suggested routes" body="Give guests ready-to-go nearby plans instead of a static list." />
              <Benefit title="No app required" body="Guests open the guide directly from their phone." />
            </div>
          </div>

          {featuredPreviewAvailable ? (
            <FeaturedPropertyGuidePreview
              title="Colony Square"
              city="Atlanta"
              guideUrl="/open/property/atl/colony-square"
              imageSrc={FEATURED_GUIDE_IMAGE_SRC}
            />
          ) : null}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/[0.07] p-5 shadow-2xl backdrop-blur-xl sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              Build your guest guide
            </p>

            <h2 className="mt-3 text-3xl font-black text-white">
              Property details
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              This is the primary setup step. Add the basics and Roam will create
              a shareable guide your guests can scan or open before arrival.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Input
                placeholder="Property Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 border-white/10 bg-black/45 text-white placeholder:text-slate-500"
              />

              <select
                value={city}
                onChange={(e) => {
                  const nextCity = e.target.value
                  setCity(nextCity)
                  safeLogEvent('host_guide_city_selected', { city: nextCity })
                }}
                className="h-12 w-full rounded-md border border-white/10 bg-black/45 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Select a city</option>
                {HOST_CITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Input
                placeholder="Property Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-12 border-white/10 bg-black/45 text-white placeholder:text-slate-500 sm:col-span-2"
              />

              <Input
                placeholder="Website (optional)"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="h-12 border-white/10 bg-black/45 text-white placeholder:text-slate-500 sm:col-span-2"
              />

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-semibold text-slate-100">
                  Welcome Description <span className="text-slate-500">(optional)</span>
                </label>

                <textarea
                  value={welcomeDescription}
                  onChange={(e) => setWelcomeDescription(e.target.value)}
                  placeholder="Welcome to our place..."
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-black/45 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />

                <p className="text-xs leading-5 text-slate-400">
                  For Brooklyn, Queens, or Manhattan, select New York City.
                </p>
              </div>

              <Button
                className="h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-sm font-black text-white hover:from-indigo-400 hover:to-cyan-400 sm:col-span-2"
                onClick={submit}
                disabled={loading || !city}
              >
                {loading ? 'Creating Guide...' : 'Create Guest Guide'}
              </Button>
            </div>
          </div>

          {link ? (
            <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/[0.08] p-6 shadow-2xl backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
                Your guide is live
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                Ready to share with guests.
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                Copy the link, open the guide, or download a QR card for your property.
              </p>

              <div className="mt-6 flex flex-col gap-2">
                <Input
                  value={link}
                  readOnly
                  className="border-white/10 bg-black/45 text-white"
                />

                <div className="grid gap-2 sm:grid-cols-3">
                  <Button variant="outline" onClick={copyLink} className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                    Copy
                  </Button>

                  <Button
                    className="bg-emerald-500 font-bold text-black hover:bg-emerald-400"
                    onClick={() => {
                      safeLogEvent('host_guide_open_clicked', {
                        city,
                        guide_url: link,
                      })
                      window.open(link, '_blank')
                    }}
                  >
                    Open
                  </Button>

                  <Button
                    variant="secondary"
                    className="bg-white text-black hover:bg-slate-200"
                    onClick={printGuideCard}
                  >
                    QR Card
                  </Button>
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/35 p-5">
                <div className="rounded-2xl bg-white p-4">
                  <QRCodeSVG value={link} size={180} level="H" />
                </div>

                <p className="max-w-xs text-center text-xs leading-5 text-slate-400">
                  Guests can scan this QR code to open the guide instantly.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-300">
                Host outcomes
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                What this improves
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Roam gives your guests a local layer without adding more work for you.
              </p>

              <div className="mt-5 grid flex-1 gap-3">
                <Outcome title="Fewer repetitive guest texts" body="Send one polished guide instead of rewriting recommendations." />
                <Outcome title="Better neighborhood discovery" body="Help guests find places that fit the moment." />
                <Outcome title="A more memorable stay" body="Make the surrounding city feel like part of the property." />
                <Outcome title="More useful than a PDF" body="Guests get a live guide with routes, maps, and nearby context." />
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Benefit({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-300">{body}</p>
    </div>
  )
}

function Outcome({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-300">{body}</p>
    </div>
  )
}