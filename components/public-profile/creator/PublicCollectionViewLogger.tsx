'use client'

import { useEffect } from 'react'

import { logEvent } from '@/lib/logEvent'

type Props = {
  collectionId: string
  collectionSlug: string
  collectionTitle: string
  creatorUserId: string
  creatorUsername: string | null
  viewerAuthenticated: boolean
  viewerIsOwner: boolean
  collectionFeatured: boolean
}

export default function PublicCollectionViewLogger({
  collectionId,
  collectionSlug,
  collectionTitle,
  creatorUserId,
  creatorUsername,
  viewerAuthenticated,
  viewerIsOwner,
  collectionFeatured,
}: Props) {
  useEffect(() => {
    try {
      void Promise.resolve(
        logEvent(
          'public_collection_viewed',
          {
            metadata: {
              collection_id:
                collectionId,
              collection_slug:
                collectionSlug,
              collection_title:
                collectionTitle,
              creator_user_id:
                creatorUserId,
              creator_username:
                creatorUsername,
              viewer_authenticated:
                viewerAuthenticated,
              viewer_is_owner:
                viewerIsOwner,
              collection_featured:
                collectionFeatured,
            },
          }
        )
      ).catch((error) => {
        console.warn(
          '[PublicCollectionViewLogger] Analytics logging failed:',
          error
        )
      })
    } catch (error) {
      console.warn(
        '[PublicCollectionViewLogger] Analytics logging failed:',
        error
      )
    }
  }, [
    collectionId,
    collectionSlug,
    collectionTitle,
    creatorUserId,
    creatorUsername,
    viewerAuthenticated,
    viewerIsOwner,
    collectionFeatured,
  ])

  return null
}