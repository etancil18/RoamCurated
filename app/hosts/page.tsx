'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QRCodeSVG } from 'qrcode.react'

export default function HostsPage() {

  const [name,setName] = useState('')
  const [city,setCity] = useState('')
  const [address,setAddress] = useState('')
  const [website,setWebsite] = useState('')
  const [link,setLink] = useState<string | null>(null)
  const [loading,setLoading] = useState(false)
  const [welcomeDescription, setWelcomeDescription] = useState('')

  async function submit(){

    setLoading(true)

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

      } catch {

        const baseUrl =
          process.env.NEXT_PUBLIC_SITE_URL ||
          'https://roam-curated.vercel.app'

        setLink(`${baseUrl}${data.url.startsWith('/') ? data.url : `/${data.url}`}`)

      }

    }

  }

  function copyLink(){

    if(!link) return

    navigator.clipboard.writeText(link)

  }

  /* ------------------------------------------------ */
  /* Printable guide card                             */
  /* ------------------------------------------------ */

  function printGuideCard(){

    if(!link) return

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

    <main className="max-w-xl mx-auto p-6 space-y-8">

      <div className="space-y-2">

        <h1 className="text-3xl font-bold">
          Create a Roam Neighborhood Guide
        </h1>

        <p className="text-muted-foreground">
          Generate a local guide your guests can open instantly.
        </p>

      </div>

      <div className="space-y-4">

        <Input
          placeholder="Property Name"
          value={name}
          onChange={(e)=>setName(e.target.value)}
        />

        <Input
          placeholder="City (example: atlanta)"
          value={city}
          onChange={(e)=>setCity(e.target.value)}
        />

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
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none"
          />
        </div>

        <Button
          className="w-full"
          onClick={submit}
          disabled={loading}
        >
          {loading ? 'Creating Guide...' : 'Create Guide'}
        </Button>

      </div>

      {link && (

        <div className="border rounded-lg p-6 space-y-5">

          <div className="space-y-1">

            <p className="font-semibold">
              Your guide is ready
            </p>

            <p className="text-sm text-muted-foreground">
              Share this with guests so they can explore the neighborhood.
            </p>

          </div>

          <div className="flex gap-2">

            <Input value={link} readOnly />

            <Button variant="outline" onClick={copyLink}>
              Copy
            </Button>

          </div>

          <div className="flex gap-2">

            <Button
              className="flex-1"
              onClick={()=>window.open(link,'_blank')}
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

          <div className="flex flex-col items-center gap-3 pt-4 border-t">

            <QRCodeSVG value={link} size={180} level="H" />

            <p className="text-xs text-muted-foreground text-center">
              Guests can scan this QR code to open the guide instantly.
            </p>

          </div>

        </div>

      )}

    </main>

  )

}