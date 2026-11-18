import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Heart,
  Share2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Info,
  Check,
  Film,
  Smile,
  Newspaper,
  Video,
  Bookmark,
  Compass,
} from 'lucide-react'
import type { PMFShortContent, ShortContentCategory } from '../types/ownerContent'
import { getShortContent, subscribeToContentUpdates } from '../services/ownerContentService'
import type { Movie } from '../movieData/movies'

interface PMFShortsExperienceProps {
  onBackToHome: () => void
  onExploreMovie?: (movie: Movie) => void
  onOpenStudio?: () => void
  allMovies?: Movie[]
}

export default function PMFShortsExperience({
  onBackToHome,
  onOpenStudio,
}: PMFShortsExperienceProps) {
  const [shorts, setShorts] = useState<PMFShortContent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [activeCategory, setActiveCategory] = useState<'all' | ShortContentCategory>('all')
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [showTapPlayFeedback, setShowTapPlayFeedback] = useState<'play' | 'pause' | null>(null)
  const [likedShorts, setLikedShorts] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('pmf_shorts_likes')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })
  const [savedShorts, setSavedShorts] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('pmf_shorts_saved')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })
  const [copiedToast, setCopiedToast] = useState(false)
  const [showInfoDrawer, setShowInfoDrawer] = useState(false)

  // Touch gesture refs
  const touchStartY = useRef<number | null>(null)
  const touchDeltaY = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Load Shorts Data
  const loadShorts = useCallback(async () => {
    setLoading(true)
    const data = await getShortContent(true)
    setShorts(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadShorts()
    const unsubscribe = subscribeToContentUpdates(loadShorts)
    return () => unsubscribe()
  }, [loadShorts])

  // Filtered shorts
  const filteredShorts = shorts.filter((item) => {
    if (activeCategory === 'all') return true
    return item.category === activeCategory
  })

  const currentShort = filteredShorts[currentIndex] || null

  // Ensure index stays in bounds if category changes
  useEffect(() => {
    setCurrentIndex(0)
    setIsPlaying(true)
  }, [activeCategory])

  // Reset & autoplay when current video changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      if (isPlaying) {
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay with audio was prevented, fallback to muted
            if (videoRef.current) {
              videoRef.current.muted = true
              setIsMuted(true)
              videoRef.current.play().catch(() => {})
            }
          })
        }
      }
    }
  }, [currentIndex, isPlaying])

  // Cleanup on unmount - pause and stop audio completely
  useEffect(() => {
    const video = videoRef.current
    return () => {
      if (video) {
        video.pause()
        video.currentTime = 0
        video.src = ''
        video.load()
      }
    }
  }, [])

  // Navigation handlers
  const goToNext = () => {
    setCurrentIndex((prev) => {
      if (prev < filteredShorts.length - 1) {
        setIsPlaying(true)
        return prev + 1
      }
      return prev
    })
  }

  const goToPrev = () => {
    setCurrentIndex((prev) => {
      if (prev > 0) {
        setIsPlaying(true)
        return prev - 1
      }
      return prev
    })
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        goToNext()
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        goToPrev()
      } else if (e.key === ' ') {
        e.preventDefault()
        togglePlayPause()
      } else if (e.key === 'm') {
        toggleMute()
      } else if (e.key === 'Escape') {
        onBackToHome()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  // Touch handlers for vertical swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    touchDeltaY.current = 0
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    touchDeltaY.current = touchStartY.current - e.touches[0].clientY
  }

  const handleTouchEnd = () => {
    if (touchStartY.current === null) return
    const delta = touchDeltaY.current
    if (delta > 55) {
      // Swiped Up -> Next
      goToNext()
    } else if (delta < -55) {
      // Swiped Down -> Prev
      goToPrev()
    }
    touchStartY.current = null
    touchDeltaY.current = 0
  }

  // Wheel handler with debounce
  const lastWheelTime = useRef<number>(0)
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now()
    if (now - lastWheelTime.current < 450) return
    if (e.deltaY > 30) {
      lastWheelTime.current = now
      goToNext()
    } else if (e.deltaY < -30) {
      lastWheelTime.current = now
      goToPrev()
    }
  }

  // Play/Pause toggle
  const togglePlayPause = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {})
      setIsPlaying(true)
      setShowTapPlayFeedback('play')
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
      setShowTapPlayFeedback('pause')
    }
    setTimeout(() => setShowTapPlayFeedback(null), 600)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    const nextMuted = !videoRef.current.muted
    videoRef.current.muted = nextMuted
    setIsMuted(nextMuted)
  }

  // Like interaction
  const toggleLike = (id: string) => {
    setLikedShorts((prev) => {
      const updated = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem('pmf_shorts_likes', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  // Save interaction
  const toggleSave = (id: string) => {
    setSavedShorts((prev) => {
      const updated = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem('pmf_shorts_saved', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  // Share interaction
  const handleShare = async () => {
    if (!currentShort) return
    const shareData = {
      title: `${currentShort.title} | PMF-Flix Shorts`,
      text: `Watch "${currentShort.title}" by ${currentShort.creator_name} on PMF-Flix!`,
      url: window.location.href,
    }

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        return
      } catch {}
    }

    // Fallback: Copy link
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiedToast(true)
      setTimeout(() => setCopiedToast(false), 2200)
    } catch {}
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 flex flex-col bg-[#030208] text-white select-none overflow-hidden"
    >
      {/* Top Header Bar */}
      <header className="relative z-30 flex h-16 shrink-0 items-center justify-between px-4 sm:px-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHome}
            aria-label="Back to Homepage"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 active:scale-95 transition backdrop-blur-md"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              <span>PMF</span>
              <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                Shorts
              </span>
            </h1>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-md">
          {[
            { id: 'all', label: 'All', icon: Compass },
            { id: 'comedy', label: 'Comedy', icon: Smile },
            { id: 'creator', label: 'Creators', icon: Film },
            { id: 'news', label: 'News & Clips', icon: Newspaper },
            { id: 'skit', label: 'Skits', icon: Video },
          ].map((cat) => {
            const Icon = cat.icon
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Right Actions: Sound & Studio */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95 transition backdrop-blur-md"
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5 text-amber-400" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>

          {onOpenStudio && (
            <button
              type="button"
              onClick={onOpenStudio}
              aria-label="Open PMF Studio"
              className="hidden md:flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold hover:bg-purple-500/30 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Publish Short</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Reel Viewport */}
      <main className="relative flex-1 flex items-center justify-center overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center text-white/50 space-y-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
              Loading PMF Shorts Universe...
            </p>
          </div>
        ) : filteredShorts.length === 0 ? (
          <div className="mx-4 max-w-md rounded-3xl border border-white/10 bg-[#090714] p-8 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400">
              <Film className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-black text-white">No Shorts in this Category</h2>
            <p className="mt-2 text-xs text-white/50 leading-relaxed">
              No published short clips are currently available under this category. Switch to "All" or check back as PMF Studio publishes new creator reels.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className="w-full rounded-xl bg-amber-400 py-2.5 text-xs font-black text-black hover:bg-amber-300 transition"
              >
                View All PMF Shorts
              </button>
              <button
                type="button"
                onClick={onBackToHome}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10 transition"
              >
                Return to Home
              </button>
            </div>
          </div>
        ) : currentShort ? (
          <div className="relative h-full w-full max-w-[460px] max-h-[880px] sm:rounded-3xl overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/[0.08] flex items-center justify-center">
            {/* Click to Play/Pause on the Video area */}
            <div
              onClick={togglePlayPause}
              className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center"
            >
              {/* Play/Pause Feedback Animation Badge */}
              {showTapPlayFeedback && (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md transition-all scale-100 animate-in fade-in duration-200">
                  {showTapPlayFeedback === 'play' ? (
                    <Play className="h-10 w-10 fill-current ml-1" />
                  ) : (
                    <Pause className="h-10 w-10 fill-current" />
                  )}
                </div>
              )}
            </div>

            {/* Video Player */}
            {currentShort.video_url.includes('youtube.com') ||
            currentShort.video_url.includes('youtu.be') ? (
              <iframe
                src={
                  currentShort.video_url.includes('embed')
                    ? currentShort.video_url
                    : `https://www.youtube.com/embed/${
                        currentShort.video_url.split('v=')[1]?.split('&')[0] ||
                        currentShort.video_url.split('/').pop()
                      }?autoplay=1&controls=0&loop=1&playsinline=1`
                }
                title={currentShort.title}
                className="h-full w-full object-cover pointer-events-auto"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                src={currentShort.video_url}
                poster={currentShort.thumbnail_url}
                loop
                playsInline
                autoPlay
                muted={isMuted}
                className="h-full w-full object-cover pointer-events-none"
              />
            )}

            {/* Cinematic Gradient Overlays */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black via-black/60 to-transparent z-15" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 via-black/20 to-transparent z-15" />

            {/* Floating Action Rail on Right */}
            <div className="absolute right-3 sm:right-4 bottom-24 z-20 flex flex-col items-center gap-5">
              {/* Like Button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => toggleLike(currentShort.id)}
                  aria-label={likedShorts[currentShort.id] ? 'Unlike' : 'Like'}
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition-all active:scale-75 shadow-lg backdrop-blur-md ${
                    likedShorts[currentShort.id]
                      ? 'bg-rose-600 text-white scale-110 shadow-rose-600/40 ring-2 ring-rose-400'
                      : 'bg-black/40 text-white hover:bg-black/60 border border-white/10'
                  }`}
                >
                  <Heart
                    className={`h-6 w-6 transition-transform ${
                      likedShorts[currentShort.id] ? 'fill-current scale-110' : ''
                    }`}
                  />
                </button>
                <span className="mt-1 text-[11px] font-bold text-white drop-shadow">
                  {likedShorts[currentShort.id] ? 'Liked' : 'Like'}
                </span>
              </div>

              {/* Bookmark/Save Button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => toggleSave(currentShort.id)}
                  aria-label="Save to My List"
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition-all active:scale-75 shadow-lg backdrop-blur-md ${
                    savedShorts[currentShort.id]
                      ? 'bg-amber-400 text-black shadow-amber-400/30'
                      : 'bg-black/40 text-white hover:bg-black/60 border border-white/10'
                  }`}
                >
                  <Bookmark
                    className={`h-5 w-5 ${
                      savedShorts[currentShort.id] ? 'fill-current' : ''
                    }`}
                  />
                </button>
                <span className="mt-1 text-[11px] font-bold text-white drop-shadow">Save</span>
              </div>

              {/* Share Button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share Short"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 border border-white/10 transition-all active:scale-75 shadow-lg backdrop-blur-md"
                >
                  <Share2 className="h-5 w-5" />
                </button>
                <span className="mt-1 text-[11px] font-bold text-white drop-shadow">Share</span>
              </div>

              {/* Info Drawer Button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setShowInfoDrawer(!showInfoDrawer)}
                  aria-label="Creator details"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 border border-white/10 transition-all active:scale-75 shadow-lg backdrop-blur-md"
                >
                  <Info className="h-5 w-5" />
                </button>
                <span className="mt-1 text-[11px] font-bold text-white drop-shadow">Info</span>
              </div>
            </div>

            {/* Bottom Caption & Creator Info */}
            <div className="absolute left-4 right-20 bottom-8 z-20 pointer-events-auto">
              {/* Creator Attribution */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-amber-400 text-xs font-black text-black ring-2 ring-white/20">
                  {currentShort.creator_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white hover:underline cursor-pointer">
                      @{currentShort.creator_name}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[8px] font-black text-emerald-300 border border-emerald-500/30">
                      <Check className="h-2 w-2" />
                      Verified
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                    {currentShort.category}
                  </span>
                </div>
              </div>

              {/* Title & Caption */}
              <h2 className="text-sm sm:text-base font-black text-white leading-snug drop-shadow-md">
                {currentShort.title}
              </h2>
              {currentShort.description && (
                <p className="mt-1 text-xs text-white/80 line-clamp-2 drop-shadow leading-relaxed">
                  {currentShort.description}
                </p>
              )}

              {/* Audio / Runtime pill */}
              <div className="mt-2.5 flex items-center gap-2 text-[10px] text-white/60">
                <span className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 backdrop-blur-md">
                  <Volume2 className="h-3 w-3 text-amber-400" />
                  Original PMF Audio
                </span>
                <span>•</span>
                <span>{currentShort.duration || 'Short'}</span>
              </div>
            </div>

            {/* Up / Down Navigation Controls for Desktop */}
            <div className="hidden lg:flex flex-col gap-2 absolute -right-16 top-1/2 -translate-y-1/2">
              <button
                type="button"
                onClick={goToPrev}
                disabled={currentIndex === 0}
                aria-label="Previous Short"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition backdrop-blur-md"
              >
                <ChevronUp className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={goToNext}
                disabled={currentIndex === filteredShorts.length - 1}
                aria-label="Next Short"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition backdrop-blur-md"
              >
                <ChevronDown className="h-6 w-6" />
              </button>
            </div>

            {/* Video Progress Bar */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 z-20">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{
                  width: `${((currentIndex + 1) / filteredShorts.length) * 100}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </main>

      {/* Info Drawer Modal */}
      {showInfoDrawer && currentShort && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#090714] p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-black text-white">Creator & Media Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoDrawer(false)}
                className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="text-white/40 uppercase tracking-wider text-[10px] font-bold">
                  Creator
                </span>
                <p className="text-white font-bold">{currentShort.creator_name}</p>
              </div>

              <div>
                <span className="text-white/40 uppercase tracking-wider text-[10px] font-bold">
                  Description
                </span>
                <p className="text-white/80 leading-relaxed mt-0.5">
                  {currentShort.description || 'Exclusive PMF-Flix original production.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-white/40">Category:</span>
                <span className="text-amber-300 font-bold uppercase">{currentShort.category}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/40">Duration:</span>
                <span className="text-white font-mono">{currentShort.duration || 'Short'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInfoDrawer(false)}
              className="mt-6 w-full rounded-xl bg-amber-400 py-2.5 text-xs font-black text-black hover:bg-amber-300 transition"
            >
              Back to Reel
            </button>
          </div>
        </div>
      )}

      {/* Copy link confirmation toast */}
      {copiedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-full border border-amber-400/30 bg-black/90 px-4 py-2 text-xs font-black text-amber-300 shadow-2xl backdrop-blur-md flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>Short link copied to clipboard!</span>
        </div>
      )}

      {/* Mobile Swipe Guidance Hint (shown briefly) */}
      <div className="sm:hidden absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none z-20 opacity-40 text-[9px] uppercase tracking-widest font-bold text-white/80">
        Swipe up for next short
      </div>
    </div>
  )
}
