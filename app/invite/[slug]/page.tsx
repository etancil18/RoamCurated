import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

type Props = {
  params: { slug: string }
}

export default async function InviteRedirect({ params }: Props) {
  const { slug } = params

  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || ''

  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent)

  if (isMobile) {
    redirect('https://apps.apple.com/')
  }

  redirect(`/sponsor/${slug}`)
}