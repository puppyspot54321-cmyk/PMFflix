import { useState, useEffect } from 'react'
import {
  Download,
  Play,
  Trash2,
  Pause,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Film,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { offlineStorage, type OfflineDownload } from '../services/offlineStorageService'
import type { Movie } from '../movieData/movies'

interface OfflineCinemaPageProps {
  onPlayMovie: (movie: Movie, customOfflineUrl?: string) => void
  onExploreCatalogue: () => void
}

export default function OfflineCinemaPage({
  onPlayMovie,
  onExploreCatalogue,
}: OfflineCinemaPageProps) {
  const [downloads, setDownloads] = useState<OfflineDownload[]>([])
  const [filter, setFilter] = useState<'all' | 'completed' | 'downloading'>('all')
  const [loadingPlayId, setLoadingPlayId] = useState<string | null>(null)
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = offlineStorage.subscribe(setDownloads)
    return () => unsubscribe()
  }, [])

  const filteredDownloads = downloads.filter((item) => {
    if (filter === 'completed') return item.status === 'completed'
    if (filter === 'downloading')
      return (
        item.status === 'downloading' ||
        item.status === 'queued' ||
        item.status === 'paused' ||
        item.status === 'failed'
      )
    return true
  })

  const totalStorageUsed = downloads.reduce(
    (sum, item) => sum + (item.downloadedBytes || 0),
    0,
  )
  const completedCount = downloads.filter((d) => d.status === 'completed').length
  const activeCount = downloads.filter((d) => d.status === 'downloading').length

  const handlePlayOffline = async (item: OfflineDownload) => {
    setLoadingPlayId(item.movieId)
    setPlaybackNotice(null)
    try {
      const offlineUrl = await offlineStorage.getPlaybackUrl(item.movieId)
      if (offlineUrl) {
        onPlayMovie(item.movie, offlineUrl)
      } else {
        setPlaybackNotice(
          `Offline media file for "${item.movie.title}" could not be verified in local storage. Tap Retry Download to re-save it.`,
        )
      }
    } finally {
      setLoadingPlayId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#030208] px-4 pb-28 pt-24 sm:px-8 lg:px-14 max-w-[1600px] mx-auto text-white">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-[#0e0a1f] via-[#070510] to-[#040309] p-6 sm:p-10 shadow-2xl mb-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-500/10 blur-[100px]" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-purple-600/15 blur-[100px]" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
              <WifiOff size={12} />
              PMF Offline Cinema Vault
            </div>

            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Watch Anywhere.{' '}
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-purple-400 bg-clip-text text-transparent">
                Zero Data Required.
              </span>
            </h1>

            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-white/55 leading-relaxed">
              Films downloaded to your PMF Offline Vault are stored in encrypted app-private storage (Android Native Filesystem or Browser IndexedDB) for uninterrupted playback without an internet connection.
            </p>
          </div>

          {/* Storage Telemetry Card */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 rounded-2xl border border-white/10 bg-black/50 p-4 backdrop-blur-xl">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-300">
              <HardDrive size={22} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 block">
                Vault Storage Used
              </span>
              <span className="text-xl font-black text-white">
                {offlineStorage.formatBytes(totalStorageUsed)}
              </span>
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-white/50">
                <span className="text-emerald-400 font-semibold">{completedCount} Ready</span>
                <span>•</span>
                <span>{activeCount} Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {playbackNotice && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-rose-400" />
            <span>{playbackNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setPlaybackNotice(null)}
            className="text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: `All Downloads (${downloads.length})` },
            { id: 'completed', label: `Ready Offline (${completedCount})` },
            { id: 'downloading', label: `In Progress (${downloads.length - completedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as 'all' | 'completed' | 'downloading')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                filter === tab.id
                  ? 'bg-amber-400 text-black font-black shadow-lg shadow-amber-400/20'
                  : 'border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-white/40">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Verified Local Binary Storage</span>
        </div>
      </div>

      {/* Downloads List */}
      {filteredDownloads.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 mb-4">
            <Download size={28} />
          </div>
          <h2 className="text-xl font-black text-white">Your Offline Cinema Vault is Empty</h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-white/45 leading-relaxed">
            Tap the <strong className="text-amber-300">Download Film</strong> button on any movie details page to save full movies directly to your device for offline viewing.
          </p>
          <button
            type="button"
            onClick={onExploreCatalogue}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition"
          >
            <Film size={15} />
            <span>Browse Downloadable Movies</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDownloads.map((item) => {
            const isCompleted = item.status === 'completed'
            const isDownloading = item.status === 'downloading'
            const isFailed = item.status === 'failed'
            const isPaused = item.status === 'paused'

            return (
              <div
                key={item.movieId}
                className="group relative flex gap-4 rounded-2xl border border-white/10 bg-[#090714] p-4 shadow-xl transition hover:border-amber-400/30"
              >
                {/* Poster */}
                <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl bg-black border border-white/10">
                  <img
                    src={item.movie.poster}
                    alt={item.movie.title}
                    className="h-full w-full object-cover"
                  />
                  {isCompleted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => handlePlayOffline(item)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg"
                        aria-label={`Play ${item.movie.title} offline`}
                      >
                        <Play size={16} fill="currentColor" className="ml-0.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-base text-white truncate">
                        {item.movie.title}
                      </h3>
                      {confirmDeleteId === item.movieId ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              void offlineStorage.removeDownload(item.movieId)
                              setConfirmDeleteId(null)
                            }}
                            className="rounded-lg bg-rose-500 px-2 py-1 text-[10px] font-black uppercase text-white hover:bg-rose-400"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-bold text-white/60 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.movieId)}
                          className="text-white/35 hover:text-rose-400 transition p-1"
                          title="Delete offline copy"
                          aria-label={`Delete ${item.movie.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
                      <span>{item.movie.year}</span>
                      <span>•</span>
                      <span>{item.movie.category}</span>
                      {item.downloadedBytes > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-300 font-semibold">
                            {offlineStorage.formatBytes(item.downloadedBytes)}
                            {item.totalBytes > item.downloadedBytes
                              ? ` / ${offlineStorage.formatBytes(item.totalBytes)}`
                              : ''}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="mt-2.5">
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          <CheckCircle2 size={11} />
                          Saved to Device • Offline Ready
                        </span>
                      )}

                      {isDownloading && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-amber-300 font-bold flex items-center gap-1.5">
                              <Sparkles size={11} className="animate-spin" />
                              Downloading Stream...
                            </span>
                            <span className="font-mono font-bold text-white">
                              {item.progress}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-amber-400 transition-all duration-300"
                              style={{ width: `${Math.max(4, item.progress)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {(isFailed || isPaused) && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-400/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                          <AlertTriangle size={11} />
                          {item.errorMessage || (isPaused ? 'Download Paused' : 'Download Interrupted')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-3 flex items-center gap-2">
                    {isCompleted && (
                      <button
                        type="button"
                        disabled={loadingPlayId === item.movieId}
                        onClick={() => handlePlayOffline(item)}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-2 px-4 text-xs font-black text-black hover:bg-amber-300 transition active:scale-95"
                      >
                        <Play size={14} fill="currentColor" />
                        <span>
                          {loadingPlayId === item.movieId
                            ? 'Opening Local File...'
                            : 'Play Offline Now'}
                        </span>
                      </button>
                    )}

                    {isDownloading && (
                      <button
                        type="button"
                        onClick={() => offlineStorage.cancelOrPauseDownload(item.movieId)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-1.5 px-3 text-xs font-bold text-white/80 hover:bg-white/10 transition"
                      >
                        <Pause size={13} />
                        <span>Pause</span>
                      </button>
                    )}

                    {(isFailed || isPaused) && (
                      <button
                        type="button"
                        onClick={() => offlineStorage.startDownload(item.movie)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 py-1.5 px-3.5 text-xs font-bold text-white hover:bg-purple-500 transition"
                      >
                        <RefreshCw size={13} />
                        <span>Retry Download</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
