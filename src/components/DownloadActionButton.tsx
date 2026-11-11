import { useEffect, useState } from 'react'
import { Download, CheckCircle2, Pause, RefreshCw, Play, AlertTriangle } from 'lucide-react'
import { offlineStorage, type OfflineDownload } from '../services/offlineStorageService'
import type { Movie } from '../movieData/movies'

interface DownloadActionButtonProps {
  movie: Movie
  onPlayOffline?: (offlineStreamUrl: string) => void
  onOpenVault?: () => void
}

export default function DownloadActionButton({
  movie,
  onPlayOffline,
  onOpenVault,
}: DownloadActionButtonProps) {
  const movieId = String(movie.id)
  const [downloadEntry, setDownloadEntry] = useState<OfflineDownload | undefined>(() =>
    offlineStorage.getDownloadById(movieId),
  )
  const [openingOffline, setOpeningOffline] = useState(false)

  useEffect(() => {
    setDownloadEntry(offlineStorage.getDownloadById(movieId))
    const unsubscribe = offlineStorage.subscribe((list) => {
      const found = list.find((item) => String(item.movieId) === movieId)
      setDownloadEntry((prev) => {
        if (
          prev?.status === found?.status &&
          prev?.progress === found?.progress &&
          prev?.downloadedBytes === found?.downloadedBytes &&
          prev?.errorMessage === found?.errorMessage
        ) {
          return prev
        }
        return found
      })
    })
    return () => unsubscribe()
  }, [movieId])

  if (movie.downloadable === false) {
    return null
  }

  if (!downloadEntry) {
    return (
      <button
        type="button"
        onClick={() => {
          void offlineStorage.startDownload(movie)
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-300 hover:bg-amber-400/20 active:scale-95 transition"
      >
        <Download size={13} />
        <span>Download Film</span>
      </button>
    )
  }

  if (downloadEntry.status === 'downloading' || downloadEntry.status === 'queued') {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/15 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-200">
        <div className="flex flex-col min-w-[125px]">
          <div className="flex items-center justify-between gap-2">
            <span>Downloading</span>
            <span className="font-mono text-amber-300">{downloadEntry.progress}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${Math.max(4, downloadEntry.progress)}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => offlineStorage.cancelOrPauseDownload(movieId)}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white/80 hover:bg-white/15 hover:text-white"
          title="Pause download"
          aria-label="Pause download"
        >
          <Pause size={12} />
        </button>
      </div>
    )
  }

  if (downloadEntry.status === 'completed') {
    return (
      <div className="inline-flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={openingOffline}
          onClick={async () => {
            if (!onPlayOffline) {
              onOpenVault?.()
              return
            }
            setOpeningOffline(true)
            try {
              const url = await offlineStorage.getPlaybackUrl(movieId)
              if (url) {
                onPlayOffline(url)
              } else {
                onOpenVault?.()
              }
            } finally {
              setOpeningOffline(false)
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300 hover:bg-emerald-500/25 active:scale-95 transition"
        >
          <CheckCircle2 size={13} className="text-emerald-400" />
          <span>{openingOffline ? 'Opening Offline...' : 'Saved Offline • Play'}</span>
          <Play size={11} fill="currentColor" />
        </button>
      </div>
    )
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          void offlineStorage.startDownload(movie)
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-3.5 text-[9px] font-black uppercase tracking-[0.16em] text-rose-200 hover:bg-rose-500/25 active:scale-95 transition"
        title={downloadEntry.errorMessage || 'Tap to retry download'}
      >
        <RefreshCw size={13} />
        <span>Retry Download</span>
      </button>
      {downloadEntry.errorMessage && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-300/85 max-w-xs">
          <AlertTriangle size={12} className="shrink-0 text-rose-400" />
          <span className="truncate">{downloadEntry.errorMessage}</span>
        </span>
      )}
    </div>
  )
}
