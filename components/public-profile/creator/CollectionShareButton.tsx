'use client'

import {
  useCallback,
  useState,
} from 'react'

import CollectionShareSheet from '@/components/public-profile/creator/CollectionShareSheet'
import {
  buildCollectionPublicPath,
  buildCollectionStoryPath,
  type PublicCollectionShareData,
} from '@/lib/creator/collectionShare'

export type CollectionShareButtonProps = {
  data: PublicCollectionShareData
  className?: string
}

export default function CollectionShareButton({
  data,
  className,
}: CollectionShareButtonProps) {
  const [
    isShareSheetOpen,
    setIsShareSheetOpen,
  ] = useState(false)

  const handleOpen =
    useCallback(() => {
      setIsShareSheetOpen(true)
    }, [])

  const handleClose =
    useCallback(() => {
      setIsShareSheetOpen(false)
    }, [])

  const collectionPath =
    buildCollectionPublicPath({
      username:
        data.creator.username,
      slug:
        data.slug,
    })

  const storyImagePath =
    buildCollectionStoryPath({
      username:
        data.creator.username,
      slug:
        data.slug,
    })

  if (
    !collectionPath ||
    !storyImagePath
  ) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={
          isShareSheetOpen
        }
        className={
          mergeClassNames(
            'inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:border-white/30 hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60',
            className
          )
        }
      >
        <ShareIcon />

        <span>
          Share
        </span>
      </button>

      <CollectionShareSheet
        data={data}
        collectionUrl={
          collectionPath
        }
        storyImageUrl={
          storyImagePath
        }
        open={
          isShareSheetOpen
        }
        onClose={
          handleClose
        }
      />
    </>
  )
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 shrink-0"
    >
      <path
        d="M12 16V4m0 0L8 8m4-4 4 4M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function mergeClassNames(
  ...values: Array<
    string | null | undefined | false
  >
): string {
  return values
    .filter(
      (
        value
      ): value is string =>
        typeof value ===
          'string' &&
        value.length > 0
    )
    .join(' ')
}