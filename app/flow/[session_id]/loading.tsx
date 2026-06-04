export default function ActiveFlowLoading() {
  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-3xl space-y-6 pt-[calc(4rem+env(safe-area-inset-top)+1rem)]">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <div className="h-3 w-28 animate-pulse rounded bg-neutral-800" />

          <div className="mt-4 h-8 w-3/4 animate-pulse rounded bg-neutral-800" />

          <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-neutral-800" />

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-neutral-700" />
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <div className="mb-4 h-4 w-24 animate-pulse rounded bg-neutral-800" />

          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-neutral-800 bg-black/30 p-4"
              >
                <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-800" />
                <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-neutral-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}