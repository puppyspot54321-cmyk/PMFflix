import { useState, useEffect } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  Globe2,
  Play,
  Sparkles,
  Trophy,
  Tv,
  X,
} from 'lucide-react'
import type { Movie } from '../movieData/movies'
import { cinemaTrivia } from '../movieData/movies'
import { getShortContent, getNovels } from '../services/ownerContentService'
import type { PMFShortContent, PMFNovel } from '../types/ownerContent'

interface TrendingRailProps {
  movies: Movie[]
  onPlayMovie: (movie: Movie) => void
  onExploreMovie: (movie: Movie) => void
}

/**
 * Trending & Top 10 Cinema Rail with honest ranking based on catalogue engagement
 */
export function TrendingRail({
  movies,
  onPlayMovie,
  onExploreMovie,
}: TrendingRailProps) {
  // Sort by rating and year to produce defensible top ranking
  const topMovies = [...movies]
    .sort((a, b) => {
      const rateA = typeof a.rating === 'number' ? a.rating : parseFloat(String(a.rating)) || 8
      const rateB = typeof b.rating === 'number' ? b.rating : parseFloat(String(b.rating)) || 8
      return rateB - rateA || b.year - a.year
    })
    .slice(0, 10)

  return (
    <div className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">
            <Flame className="h-3.5 w-3.5 fill-amber-400" />
            Measured Popularity
          </div>
          <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            Top 10 Across PMF-Flix Today
          </h2>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x">
        {topMovies.map((movie, index) => (
          <div
            key={movie.id}
            className="group relative flex-none w-[200px] sm:w-[240px] snap-start"
          >
            {/* Massive stylized index numeral */}
            <div className="pointer-events-none absolute -bottom-3 -left-3 z-20 text-[72px] sm:text-[88px] font-black leading-none text-white/20 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] select-none">
              {index + 1}
            </div>

            <div
              onClick={() => onExploreMovie(movie)}
              className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 cursor-pointer transition-all duration-300 group-hover:scale-[1.03] group-hover:border-purple-400/40 group-hover:shadow-[0_12px_30px_rgba(134,59,255,0.25)]"
            >
              <img
                src={movie.poster}
                alt={movie.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition" />

              <div className="absolute bottom-3 left-3 right-3 z-30">
                <p className="text-[10px] font-bold text-amber-400">{movie.category}</p>
                <h3 className="text-sm font-black text-white truncate">{movie.title}</h3>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/50">
                  <span>{movie.year}</span>
                  <span>·</span>
                  <span>{movie.duration || 'Feature'}</span>
                </div>
              </div>

              {/* Quick Play Hover Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onPlayMovie(movie)
                }}
                className="absolute top-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black opacity-0 transition-all duration-200 group-hover:opacity-100 hover:scale-110 shadow-xl"
                aria-label={`Play ${movie.title}`}
              >
                <Play className="h-4 w-4 fill-current ml-0.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface BuzzBossProps {
  onNavigate?: (section: string) => void
}

/**
 * Buzz Boss: Dedicated short-form comedy, skits & funny entertainment
 * Strictly owner-controlled with zero random movie fallbacks
 */
export function BuzzBossSection({ onNavigate }: BuzzBossProps) {
  const [skits, setSkits] = useState<PMFShortContent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeVideo, setActiveVideo] = useState<PMFShortContent | null>(null)

  useEffect(() => {
    let mounted = true
    getShortContent(true).then((data) => {
      if (mounted) {
        setSkits(data)
        setLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="py-8 border-y border-white/[0.06] my-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-purple-400">
            <Sparkles className="h-3.5 w-3.5" />
            PMF Original Entertainment
          </div>
          <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            Buzz Boss • Short Skits & Comedy
          </h2>
          <p className="mt-1 text-xs text-white/50 max-w-xl">
            Quick-hit laughs, street banter, and hilarious shorts authorized and approved directly by the PMF-Flix publishing desk.
          </p>
        </div>

        {onNavigate && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('shorts')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-400 text-black text-xs font-black shadow-md shadow-amber-400/20 hover:bg-amber-300 transition active:scale-95"
            >
              <Play className="h-3.5 w-3.5 fill-black" />
              <span>Watch in Shorts Reel</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('buzz-boss')}
              className="flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white px-2.5 py-1.5"
            >
              <span>Shorts Catalogue</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-white/40">Loading shorts...</div>
      ) : skits.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#090714] p-8 text-center text-white/50">
          <p className="text-sm font-bold text-white">No Comedy Skits Published Yet</p>
          <p className="text-xs mt-1 text-white/40">
            Newly approved comedy sketches will appear here once published by the owner. Full-length movies are never used as placeholders.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {skits.slice(0, 6).map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveVideo(item)}
              className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-[#090714] cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:border-amber-400/40"
            >
              <img
                src={item.thumbnail_url}
                alt={item.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
                onError={(e) => (e.currentTarget.src = '/pmf-flix-icon.png')}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

              <div className="absolute top-2.5 left-2.5">
                <span className="rounded-md bg-purple-600/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur">
                  {item.category.toUpperCase()}
                </span>
              </div>

              <div className="absolute bottom-3 left-3 right-3">
                <span className="text-[10px] font-bold text-amber-400 truncate block">
                  {item.creator_name}
                </span>
                <h3 className="mt-0.5 text-xs font-black text-white line-clamp-2">
                  {item.title}
                </h3>
                <div className="mt-1 flex items-center justify-between text-[9px] text-white/50">
                  <span>{item.duration || 'Short'}</span>
                  <span className="text-emerald-400 font-bold">Watch</span>
                </div>
              </div>

              <div className="absolute inset-0 m-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-white shadow-2xl">
                <Play className="h-5 w-5 fill-current ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Real Video Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-2xl">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#090714] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-black text-white truncate">{activeVideo.title}</h3>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="p-1 rounded-lg text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              {activeVideo.video_url.includes('youtube') ? (
                <iframe
                  src={
                    activeVideo.video_url.includes('embed')
                      ? activeVideo.video_url
                      : `https://www.youtube.com/embed/${activeVideo.video_url.split('v=')[1]?.split('&')[0] || activeVideo.video_url.split('/').pop()}?autoplay=1`
                  }
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={activeVideo.video_url} controls autoPlay className="h-full w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface FreeNovelsProps {
  onNavigate?: (section: string) => void
}

/**
 * Free Novels & African Literary Epics
 * Strictly owner-controlled with zero fabricated books
 */
export function FreeNovelsSection({ onNavigate }: FreeNovelsProps) {
  const [novelsList, setNovelsList] = useState<PMFNovel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeNovel, setActiveNovel] = useState<PMFNovel | null>(null)

  useEffect(() => {
    let mounted = true
    getNovels(true).then((data) => {
      if (mounted) {
        setNovelsList(data)
        setLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">
            <BookOpen className="h-3.5 w-3.5" />
            African Literary Cinema
          </div>
          <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            PMF Free Novels & Stories
          </h2>
          <p className="mt-1 text-xs text-white/50 max-w-xl">
            Authorized literary works, serialized epics, and novels distributed exclusively through the Prince Mufasa Flix publishing imprint.
          </p>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('free-novels')}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300"
          >
            <span>Explore Complete Library</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-white/40">Loading literary catalogue...</div>
      ) : novelsList.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#090714] p-8 text-center text-white/50">
          <p className="text-sm font-bold text-white">Literary Catalogue Currently Empty</p>
          <p className="text-xs mt-1 text-white/40">
            PMF-Flix only hosts novels and stories authorized directly by the author desk. New manuscripts will appear once approved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {novelsList.slice(0, 3).map((novel) => (
            <div
              key={novel.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#090714] p-5 transition-all duration-300 hover:border-amber-400/30"
            >
              <div
                onClick={() => setActiveNovel(novel)}
                className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/10 bg-black mb-4 cursor-pointer"
              >
                <img
                  src={novel.cover_url}
                  alt={novel.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => (e.currentTarget.src = '/pmf-flix-icon.png')}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-2.5 left-2.5">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                    {novel.genre}
                  </span>
                </div>
              </div>

              <h3
                onClick={() => setActiveNovel(novel)}
                className="text-lg font-black text-white group-hover:text-amber-300 transition cursor-pointer"
              >
                {novel.title}
              </h3>
              <p className="mt-1 text-[11px] text-white/40">By {novel.author} · {novel.language}</p>

              <p className="mt-3 text-xs leading-5 text-white/60 line-clamp-3 flex-1">
                {novel.description}
              </p>

              <button
                type="button"
                onClick={() => setActiveNovel(novel)}
                className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Read Edition</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reading Modal */}
      {activeNovel && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-amber-400/30 bg-[#0a0715] p-6 sm:p-8 text-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  {activeNovel.genre}
                </span>
                <h2 className="text-2xl font-black text-white mt-1">{activeNovel.title}</h2>
                <p className="text-xs text-white/50">By {activeNovel.author}</p>
              </div>

              <button
                type="button"
                onClick={() => setActiveNovel(null)}
                className="rounded-xl border border-white/10 p-2 text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="prose prose-invert max-w-none text-sm leading-7 text-white/80 whitespace-pre-line font-serif">
              {activeNovel.chapters?.[0]?.content || activeNovel.description}
            </div>

            <div className="mt-8 border-t border-white/10 pt-4 flex items-center justify-between">
              <span className="text-[11px] text-white/40">
                Official PMF-Flix Publishing Edition
              </span>
              <button
                type="button"
                onClick={() => setActiveNovel(null)}
                className="rounded-xl bg-white px-5 py-2 text-xs font-bold text-black hover:bg-white/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Cinema Trivia Challenge
 */
export function CinemaTriviaChallenge() {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)

  const currentQ = cinemaTrivia[currentIdx]

  const handleSelect = (index: number) => {
    if (selectedAnswer !== null) return
    setSelectedAnswer(index)
    setShowResult(true)
    if (index === currentQ.answerIndex) {
      setScore((s) => s + 10)
    }
  }

  const handleNext = () => {
    setSelectedAnswer(null)
    setShowResult(false)
    setCurrentIdx((prev) => (prev + 1) % cinemaTrivia.length)
  }

  return (
    <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-[#0a0718] via-[#070512] to-[#030208] p-6 sm:p-8 my-8 text-white shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-purple-400">
            <Trophy className="h-3.5 w-3.5" />
            PMF Cinema Knowledge
          </div>
          <h3 className="mt-1 text-xl font-black text-white sm:text-2xl">
            African Film & Streaming Trivia
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-amber-300">
            Score: {score} pts
          </div>
          <span className="text-xs text-white/40">
            Q {currentIdx + 1} of {cinemaTrivia.length}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-base sm:text-lg font-bold text-white mb-5">
          {currentQ.question}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentQ.options.map((opt, i) => {
            let btnStyle = 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
            if (showResult) {
              if (i === currentQ.answerIndex) {
                btnStyle = 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-bold'
              } else if (i === selectedAnswer) {
                btnStyle = 'border-red-500/50 bg-red-500/20 text-red-300'
              } else {
                btnStyle = 'border-white/5 bg-white/[0.02] text-white/30'
              }
            }

            return (
              <button
                key={opt}
                disabled={showResult}
                onClick={() => handleSelect(i)}
                className={`flex items-center justify-between rounded-xl border p-3.5 text-xs text-left transition ${btnStyle}`}
              >
                <span>{opt}</span>
                {showResult && i === currentQ.answerIndex && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 ml-2" />
                )}
              </button>
            )
          })}
        </div>

        {showResult && (
          <div className="mt-5 rounded-xl border border-white/10 bg-purple-500/10 p-4">
            <p className="text-xs text-purple-200">
              <span className="font-bold">Insight: </span>
              {currentQ.explanation}
            </p>
            <button
              type="button"
              onClick={handleNext}
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-bold text-black hover:bg-white/90"
            >
              Next Question
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Specialty Entertainment Destinations (Live TV, Football, Games) with honest status
 */
export function SpecialtyDestinationsPortal({
  onNavigate,
}: {
  onNavigate?: (section: string) => void
}) {
  return (
    <div className="py-8 border-t border-white/[0.06] my-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">
          <Globe2 className="h-3.5 w-3.5" />
          Global Entertainment Hub
        </div>
        <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
          Live Sports, Stories & Broadcasts
        </h2>
        <p className="mt-1 text-xs text-white/50 max-w-xl">
          Verified status of live match schedules, licensed literary library, and original comedic content.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Live Sports Arena */}
        <div
          onClick={() => onNavigate?.('sports')}
          className="rounded-2xl border border-white/10 bg-[#090714] p-5 cursor-pointer hover:border-amber-400/40 transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 group-hover:scale-110 transition">
              <Tv className="h-5 w-5" />
            </div>
            <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
              Active Hub
            </span>
          </div>

          <h3 className="mt-4 text-base font-black text-white group-hover:text-amber-300 transition">
            Live Sports Arena
          </h3>
          <p className="mt-1.5 text-xs text-white/50 leading-relaxed">
            Real fixtures, tournament schedules, and authorized streaming broadcasts managed by PMF Sports.
          </p>

          <div className="mt-4 flex items-center text-xs font-bold text-amber-400">
            <span>Open Sports Arena</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Novels & Literary Works */}
        <div
          onClick={() => onNavigate?.('free-novels')}
          className="rounded-2xl border border-white/10 bg-[#090714] p-5 cursor-pointer hover:border-amber-400/40 transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="rounded-md border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[9px] font-bold text-purple-300">
              Imprint Library
            </span>
          </div>

          <h3 className="mt-4 text-base font-black text-white group-hover:text-amber-300 transition">
            PMF Novels & Stories
          </h3>
          <p className="mt-1.5 text-xs text-white/50 leading-relaxed">
            Exclusive serialized African fiction, historical epics, and authorized manuscripts with dedicated reader.
          </p>

          <div className="mt-4 flex items-center text-xs font-bold text-amber-400">
            <span>Open Library Reader</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Buzz Boss Comedy */}
        <div
          onClick={() => onNavigate?.('buzz-boss')}
          className="rounded-2xl border border-white/10 bg-[#090714] p-5 cursor-pointer hover:border-amber-400/40 transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 group-hover:scale-110 transition">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">
              Creator Skits
            </span>
          </div>

          <h3 className="mt-4 text-base font-black text-white group-hover:text-amber-300 transition">
            Buzz Boss Short Skits
          </h3>
          <p className="mt-1.5 text-xs text-white/50 leading-relaxed">
            Dedicated short-form laughs, street banter, and creator comedy videos approved by the owner desk.
          </p>

          <div className="mt-4 flex items-center text-xs font-bold text-amber-400">
            <span>Watch Short Skits</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition" />
          </div>
        </div>
      </div>
    </div>
  )
}
