'use client'

import { useEffect } from 'react'

import { logEvent } from '@/lib/logEvent'

type Props = {
  profileUserId: string
  profileUsername: string | null
  viewerAuthenticated: boolean
  viewerIsOwner: boolean
  profileIsCreator: boolean
}

export default function PublicProfileViewLogger({
  profileUserId,
  profileUsername,
  viewerAuthenticated,
  viewerIsOwner,
  profileIsCreator,
}: Props) {
  useEffect(() => {
    try {
      void Promise.resolve(
        logEvent(
          'public_profile_viewed',
          {
            metadata: {
              profile_user_id:
                profileUserId,
              profile_username:
                profileUsername,
              viewer_authenticated:
                viewerAuthenticated,
              viewer_is_owner:
                viewerIsOwner,
              profile_is_creator:
                profileIsCreator,
            },
          }
        )
      ).catch((error) => {
        console.warn(
          '[PublicProfileViewLogger] Analytics logging failed:',
          error
        )
      })
    } catch (error) {
      console.warn(
        '[PublicProfileViewLogger] Analytics logging failed:',
        error
      )
    }
  }, [
    profileUserId,
    profileUsername,
    viewerAuthenticated,
    viewerIsOwner,
    profileIsCreator,
  ])

  return null
}