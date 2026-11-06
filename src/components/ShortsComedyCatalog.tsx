import { useState, useEffect } from 'react'
import {
  Film,
  Play,
  Sparkles,
  Newspaper,
  Smile,
  Video,
  X,
  PlusCircle,
  ExternalLink,
} from 'lucide-react'
import type { PMFShortContent, ShortContentCategory } from '../types/ownerContent'
import { getShortContent, subscribeToContentUpdates } from '../services/ownerContentService'

interface ShortsComedyCatalogProps {
  onOpenStudio?: () => void
}

export default function ShortsComedyCatalog({ onOpenStudio }: ShortsComedyCatalogProps) {
  const [items, setItems] = useState<PMFShortContent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<'all' | ShortContentCategory>('all')
  const [activeItem, setActiveItem] = useState<PMFShortContent | null>(null)

  const loadData = async () => {
    setLoading(true)
    const data = await getShortContent(true)
    setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const unsubscribe = subscribeToContentUpdates(loadData)
    return () => unsubscribe()
  }, [])

  const filteredItems = items.filter((item) => {
    if (activeCategory === 'all') return true
    return item.category === activeCategory
  })

  return (
    <section className="relative min-h-[60vh] py-12 px-4 sm:px-8 lg:px-12 max-w-[1600px] mx-auto">
      {/* Header Banner */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">
            <Sparkles className="h-3.5 w-3.5 fill-amber-400" />
            PMF-Flix Studio Original Shorts
          </div>
          <h1 className="mt-1.5 text-3xl sm:text-4xl font-black text-white tracking-tight">
            Buzz Boss • Comedy, News & Short Skits
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-white/50 max-w-2xl leading-relaxed">
            Exclusive owner-curated short-form cinema, verified comedy skits, and news clips. Every video here is authorized and approved directly by the PMF-Flix publishing desk.
          </p>
        </div>

        {/* Categories Tab Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Shorts', icon: Video },
            { id: 'comedy', label: 'Comedy Skits', icon: Smile },
            { id: 'news', label: 'News Clips', icon: Newspaper },
            { id: 'creator', label: 'Creator Shorts', icon: Film },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeCategory === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
                    : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white border border-white/10'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content Grid or Honest Empty State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-white/40">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest">
            Loading verified catalogue...
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#070510]/80 p-12 text-center max-w-2xl mx-auto my-12 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <Film className="h-8 w-8" />
          </div>

          <h3 className="mt-5 text-xl font-black text-white">
            No Published Content In This Category Yet
          </h3>

          <p className="mt-2.5 text-xs text-white/50 leading-relaxed max-w-md mx-auto">
            PMF-Flix short-form entertainment only displays genuine creator skits and news clips approved by the owner. Full-length movies are never used as placeholders.
          </p>

          {onOpenStudio && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onOpenStudio}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Open PMF Studio to Publish Skits</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveItem(item)}
              className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0718] cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:border-amber-400/50 hover:shadow-[0_12px_30px_rgba(245,158,11,0.2)]"
            >
              <img
                src={item.thumbnail_url}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  e.currentTarget.src = '/pmf-flix-icon.png'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

              {/* Category Badge */}
              <div className="absolute top-2.5 left-2.5">
                <span className="rounded-md bg-purple-600/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur">
                  {item.category.toUpperCase()}
                </span>
              </div>

              {/* Details */}
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-[10px] font-bold text-amber-400 truncate">
                  {item.creator_name}
                </p>
                <h3 className="mt-0.5 text-xs font-black text-white line-clamp-2 leading-snug">
                  {item.title}
                </h3>
                <div className="mt-1 flex items-center justify-between text-[9px] text-white/50">
                  <span>{item.duration || 'Short'}</span>
                  <span className="text-emerald-400 font-bold">Authorized</span>
                </div>
              </div>

              {/* Play Button Overlay */}
              <div className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black opacity-0 transition-opacity duration-200 group-hover:opacity-100 shadow-2xl">
                <Play className="h-5 w-5 fill-current ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Real Short-Form Video Player Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-2xl">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#090714] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
                  {activeItem.category}
                </span>
                <h2 className="text-sm sm:text-base font-black text-white truncate max-w-md sm:max-w-xl">
                  {activeItem.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Video Player */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              {activeItem.video_url.includes('youtube.com') || activeItem.video_url.includes('youtu.be') ? (
                <iframe
                  src={
                    activeItem.video_url.includes('embed')
                      ? activeItem.video_url
                      : `https://www.youtube.com/embed/${activeItem.video_url.split('v=')[1]?.split('&')[0] || activeItem.video_url.split('/').pop()}?autoplay=1`
                  }
                  title={activeItem.title}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={activeItem.video_url}
                  poster={activeItem.thumbnail_url}
                  controls
                  autoPlay
                  className="h-full w-full object-contain"
                >
                  Your browser does not support HTML5 video playback.
                </video>
              )}
            </div>

            {/* Footer Metadata */}
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#06040d]">
              <div>
                <p className="text-xs font-bold text-amber-400">Creator: {activeItem.creator_name}</p>
                <p className="mt-1 text-xs text-white/60 max-w-xl">{activeItem.description}</p>
              </div>

              <div className="flex items-center gap-2">
                {activeItem.video_url && (
                  <a
                    href={activeItem.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Source Media</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
