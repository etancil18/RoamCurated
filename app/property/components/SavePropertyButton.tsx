'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import {
  supabaseBrowser,
  getCurrentUserId
} from '@/lib/supabase/client'
import { getAppDownloadLink } from '@/lib/constants/appLinks'

type Props = {
  propertyId: string
  city: string
  slug: string
}

export default function SavePropertyButton({
  propertyId,
  city,
  slug
}: Props) {

  const router = useRouter()

  /* Create client once */
  const [supabase] = useState(() => supabaseBrowser())

  const [saved,setSaved] = useState(false)
  const [loading,setLoading] = useState(false)
  const [checking,setChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  /* -------------------------------- */
  /* Detect if property already saved */
  /* -------------------------------- */

  useEffect(() => {

    async function checkSaved(){

      const userId = await getCurrentUserId()

      if(!userId){
        setIsAuthenticated(false)
        setChecking(false)
        return
      }

      setIsAuthenticated(true)

      const { data } = await supabase
        .from('saved_properties')
        .select('id')
        .eq('user_id',userId)
        .eq('property_id',propertyId)
        .maybeSingle()

      if(data){
        setSaved(true)
      }

      setChecking(false)
    }

    checkSaved()

  },[propertyId, supabase])

  /* -------------------------------- */
  /* Save property / redirect to app  */
  /* -------------------------------- */

  async function handleSave(){

    if(loading || saved) return

    if(isAuthenticated === false){
      window.location.href = getAppDownloadLink()
      return
    }

    setLoading(true)

    const userId = await getCurrentUserId()

    if(!userId){
      setIsAuthenticated(false)
      setLoading(false)
      window.location.href = getAppDownloadLink()
      return
    }

    setIsAuthenticated(true)

    const { error } = await supabase
      .from('saved_properties')
      .insert({
        user_id:userId,
        property_id:propertyId,
        city,
        slug
      })

    if(error && error.code !== '23505'){
      console.error('Save property error:',error.message)
    }

    setSaved(true)
    setLoading(false)

    /* Refresh server-rendered page state */
    router.refresh()
  }

  /* -------------------------------- */
  /* Button label logic               */
  /* -------------------------------- */

  let label = '♡ Save'

  if(checking) label = '...'
  else if(isAuthenticated === false) label = '↓ Download App'
  else if(saved) label = '♥ Saved'
  else if(loading) label = 'Saving...'

  return (

    <button
      onClick={handleSave}
      disabled={checking || saved || loading}
      className="
        px-4 py-2
        rounded-lg
        text-sm
        border
        hover:bg-muted
        transition
        flex items-center gap-2
      "
    >

      {label}

    </button>

  )
}