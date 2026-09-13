import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Bookmark, Check, ChevronLeft, ChevronRight, Clock3, Download,
  Film, Globe2, Heart, Home, Info, LogOut, Menu, Play, Plus,
  Search, SlidersHorizontal, Sparkles, Star, Tv, X
} from 'lucide-react'

import heroImage from './assets/hero.png'
import AuthScreen from './Auth'
import VideoPlayer from './components/VideoPlayer'
import { supabase } from './supabase'
import { getMetadataCatalog, getMovies } from './services'
import type { MetadataCatalog } from './services'
import type { Movie as CanonicalMovie } from './types/movie'
import { mapCanonicalMovieToLegacy } from './utils/movieMapper'

type Section = 'home' | 'movies' | 'tv' | 'my-list'
type SortMode = 'popular' | 'newest' | 'rating' | 'title'
type DisplayMovie = ReturnType<typeof mapCanonicalMovieToLegacy>

type CW = { id: number; position: number; duration: number; updatedAt: number }

const KEYS = {
  list: 'pmf-my-list',
  liked: 'pmf-liked',
  recent: 'pmf-recently-viewed',
  continue: 'pmf-continue-watching',
}

const NAV = [
  { value: 'home' as Section, label: 'Home', icon: Home },
  { value: 'movies' as Section, label: 'Movies', icon: Film },
  { value: 'tv' as Section, label: 'TV Series', icon: Tv },
  { value: 'my-list' as Section, label: 'My List', icon: Bookmark },
]

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const text = (v: string) => v.trim().toLowerCase()

function ids(key: string): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []
  } catch {
    return []
  }
}

function saveIds(key: string, value: number[]) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

function getCW(): CW[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEYS.continue) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function saveCW(id: number, position: number, duration: number) {
  try {
    const next = [
      ...getCW().filter(x => x.id !== id),
      { id, position, duration, updatedAt: Date.now() },
    ].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30)
    localStorage.setItem(KEYS.continue, JSON.stringify(next))
  } catch {}
}

function removeCW(id: number) {
  try {
    localStorage.setItem(
      KEYS.continue,
      JSON.stringify(getCW().filter(x => x.id !== id)),
    )
  } catch {}
}

function recent(id: number) {
  try {
    const old = ids(KEYS.recent)
    saveIds(KEYS.recent, [id, ...old.filter(x => x !== id)].slice(0, 20))
  } catch {}
}

function progress(x: CW | null) {
  return x && x.duration > 0
    ? Math.min(100, Math.max(0, (x.position / x.duration) * 100))
    : 0
}

function runtime(movie: CanonicalMovie) {
  if (movie.runtimeMinutes && movie.runtimeMinutes > 0) {
    const h = Math.floor(movie.runtimeMinutes / 60)
    const m = movie.runtimeMinutes % 60
    return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
  }
  return movie.duration || ''
}

function youtube(url: string) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '')
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : url
    }
    const id = u.searchParams.get('v')
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
    if (u.pathname.includes('/embed/')) return `${url}${url.includes('?') ? '&' : '?'}autoplay=1&rel=0`
    if (u.pathname.includes('/shorts/')) {
      const id = u.pathname.split('/shorts/')[1]
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : url
    }
    return url
  } catch {
    return url
  }
}

function isYouTube(url: string) {
  try {
    const h = new URL(url).hostname
    return h.includes('youtube.com') || h.includes('youtu.be')
  } catch {
    return false
  }
}

function sectionMatch(movie: CanonicalMovie, section: Section) {
  if (section === 'tv') return movie.contentType === 'tv_show'
  if (section === 'movies') {
    return ['movie', 'documentary', 'short_film', 'special'].includes(movie.contentType)
  }
  return true
}

function metaName(catalog: MetadataCatalog | null, id: string) {
  if (!catalog) return id
  const groups = [
    catalog.genres, catalog.subgenres, catalog.regions, catalog.countries,
    catalog.industries, catalog.languages, catalog.tags, catalog.collections,
    catalog.ageRatings,
  ]
  for (const group of groups) {
    const found = group.find(x => x.id === id)
    if (found) return found.name
  }
  return id
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#030303] text-white">{children}</div>
}

function Title({
  title, eyebrow, description,
}: {
  title: string; eyebrow?: string; description?: string
}) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="mb-1 text-[10px] font-black uppercase tracking-[.3em] text-red-500">{eyebrow}</p>}
      <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-sm text-white/45">{description}</p>}
    </div>
  )
}

function Card({
  movie, canonical, listed, liked, cw, open, play, toggleList, toggleLike,
}: {
  movie: DisplayMovie
  canonical: CanonicalMovie
  listed: boolean
  liked: boolean
  cw: CW | null
  open: (m: DisplayMovie) => void
  play: (m: DisplayMovie) => void
  toggleList: (id: number) => void
  toggleLike: (id: number) => void
}) {
  const p = progress(cw)
  return (
    <article className="group w-[150px] shrink-0 sm:w-[185px] lg:w-[205px]">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[.03] shadow-2xl transition duration-300 hover:-translate-y-1 hover:border-white/25">
        <button onClick={() => open(movie)} className="relative block aspect-[2/3] w-full overflow-hidden text-left">
          {movie.poster
            ? <img src={movie.poster} alt={movie.title} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
            : <div className="flex h-full items-center justify-center bg-zinc-950"><Film className="text-white/20" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/10" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="mb-1 flex items-center gap-2 text-[10px] text-white/70">
              <span>{movie.year}</span>
              {movie.rating && <span className="flex items-center gap-1"><Star size={10} fill="currentColor" />{movie.rating}</span>}
            </div>
            <h3 className="truncate text-sm font-bold">{movie.title}</h3>
          </div>
          {canonical.isPmfOriginal && <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[8px] font-black uppercase">PMF Original</span>}
          {canonical.isPremium && <span className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-[8px] font-black text-black">Premium</span>}
          {p > 0 && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10"><div className="h-full bg-red-600" style={{ width: `${p}%` }} /></div>}
        </button>
        <div className="flex items-center gap-1 border-t border-white/10 p-2">
          <button onClick={() => play(movie)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-2 text-xs font-black text-black">
            <Play size={12} fill="currentColor" /> {p > 0 ? 'Continue' : 'Play'}
          </button>
          <button onClick={() => toggleList(movie.id)} className="rounded-lg p-2 hover:bg-white/10" title="My List">
            {listed ? <Check size={15} /> : <Plus size={15} />}
          </button>
          <button onClick={() => toggleLike(movie.id)} className="rounded-lg p-2 hover:bg-white/10" title="Like">
            <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </article>
  )
}

function Rail({
  title, movies, map, list, liked, cw, open, play, toggleList, toggleLike,
}: {
  title: string
  movies: CanonicalMovie[]
  map: Map<number, DisplayMovie>
  list: number[]
  liked: number[]
  cw: CW[]
  open: (m: DisplayMovie) => void
  play: (m: DisplayMovie) => void
  toggleList: (id: number) => void
  toggleLike: (id: number) => void
}) {
  const [offset, setOffset] = useState(0)
  const visible = movies.slice(offset)
  if (!visible.length) return null

  return (
    <section className="mb-12">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-black sm:text-2xl">{title}</h2>
        <div className="flex gap-2">
          <button onClick={() => setOffset(Math.max(0, offset - 4))} className="rounded-full border border-white/10 p-2 hover:bg-white/10"><ChevronLeft size={17} /></button>
          <button onClick={() => setOffset(Math.min(Math.max(0, movies.length - 1), offset + 4))} className="rounded-full border border-white/10 p-2 hover:bg-white/10"><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden">
        {visible.map(c => {
          const m = map.get(num(c.id))
          if (!m) return null
          return <Card key={c.id} movie={m} canonical={c} listed={list.includes(num(c.id))} liked={liked.includes(num(c.id))} cw={cw.find(x => x.id === num(c.id)) || null} open={open} play={play} toggleList={toggleList} toggleLike={toggleLike} />
        })}
      </div>
    </section>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [movies, setMovies] = useState<CanonicalMovie[]>([])
  const [catalog, setCatalog] = useState<MetadataCatalog | null>(null)
  const [section, setSection] = useState<Section>('home')
  const [list, setList] = useState<number[]>([])
  const [liked, setLiked] = useState<number[]>([])
  const [cw, setCW] = useState<CW[]>([])
  const [selected, setSelected] = useState<DisplayMovie | null>(null)
  const [watching, setWatching] = useState<DisplayMovie | null>(null)
  const [player, setPlayer] = useState(false)
  const [search, setSearch] = useState('')
  const [mobile, setMobile] = useState(false)
  const [filters, setFilters] = useState(false)
  const [genre, setGenre] = useState('')
  const [year, setYear] = useState('')
  const [rating, setRating] = useState('')
  const [sort, setSort] = useState<SortMode>('popular')
  const [toast, setToast] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession()
      .then(({ data }) => mounted && setSession(data.session))
      .catch(console.error)
      .finally(() => mounted && setAuthLoading(false))

    const { data } = supabase.auth.onAuthStateChange((_e, s) => mounted && setSession(s))
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    setList(ids(KEYS.list))
    setLiked(ids(KEYS.liked))
    setCW(getCW())
  }, [])

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }
    let mounted = true
    Promise.all([getMovies(), getMetadataCatalog()])
      .then(([m, c]) => {
        if (!mounted) return
        setMovies(m)
        setCatalog(c)
        setError('')
      })
      .catch(e => {
        console.error(e)
        if (mounted) setError('PMF could not load the catalogue. Please refresh.')
      })
      .finally(() => mounted && setLoading(false))

    const channel = supabase
      .channel('pmf-movies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movies' }, async () => {
        try { if (mounted) setMovies(await getMovies()) } catch {}
      })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [session])

  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null)
        setPlayer(false)
        setWatching(null)
        setMobile(false)
        setSearch('')
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const map = useMemo(
    () => new Map(movies.map(m => [num(m.id), mapCanonicalMovieToLegacy(m)])),
    [movies],
  )

  const years = useMemo(
    () => [...new Set(movies.map(m => m.releaseYear).filter(Boolean))].sort((a, b) => num(b) - num(a)),
    [movies],
  )

  const searchResults = useMemo(() => {
    const q = text(search)
    if (!q) return []
    return movies.filter(m =>
      [m.title, m.originalTitle, m.slug, m.synopsis, m.tagline]
        .filter(Boolean)
        .some(v => text(String(v)).includes(q)),
    ).slice(0, 8)
  }, [movies, search])

  const filtered = useMemo(() => {
    let result = movies.filter(m => sectionMatch(m, section))
    if (section === 'my-list') result = result.filter(m => list.includes(num(m.id)))
    if (genre) result = result.filter(m => m.genres.includes(genre))
    if (year) result = result.filter(m => num(m.releaseYear) === num(year))
    if (rating) result = result.filter(m => num(m.rating) >= num(rating))
    return [...result].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'newest') return num(b.releaseYear) - num(a.releaseYear)
      if (sort === 'rating') return num(b.rating) - num(a.rating)
      return num(b.viewCount) - num(a.viewCount) || num(b.rating) - num(a.rating)
    })
  }, [movies, section, list, genre, year, rating, sort])

  const trending = movies.filter(m => m.isTrending)
  const featured = movies.filter(m => m.isFeatured)
  const newest = movies.filter(m => m.isNewRelease).length ? movies.filter(m => m.isNewRelease) : [...movies].sort((a, b) => num(b.releaseYear) - num(a.releaseYear))
  const originals = movies.filter(m => m.isPmfOriginal)
  const topRated = [...movies].sort((a, b) => num(b.rating) - num(a.rating))
  const popular = [...movies].sort((a, b) => num(b.viewCount) - num(a.viewCount))
  const continueMovies = cw.map(x => movies.find(m => num(m.id) === x.id)).filter(Boolean) as CanonicalMovie[]
  const hero = featured[0] || trending[0] || movies[0] || null

  const go = (s: Section) => {
    setSection(s)
    setMobile(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleList = (id: number) => {
    setList(old => {
      const next = old.includes(id) ? old.filter(x => x !== id) : [...old, id]
      saveIds(KEYS.list, next)
      setToast(old.includes(id) ? 'Removed from My List' : 'Added to My List')
      return next
    })
  }

  const toggleLike = (id: number) => {
    setLiked(old => {
      const next = old.includes(id) ? old.filter(x => x !== id) : [...old, id]
      saveIds(KEYS.liked, next)
      setToast(old.includes(id) ? 'Removed from favourites' : 'Added to favourites')
      return next
    })
  }

  const openMovie = (m: DisplayMovie) => {
    setSelected(m)
    recent(m.id)
  }

  const playMovie = (m: DisplayMovie) => {
    setSelected(null)
    setWatching(m)
    setPlayer(true)
    recent(m.id)
  }

  const timeUpdate = (time: number) => {
    if (!watching) return
    const canonical = movies.find(m => num(m.id) === watching.id)
    const duration = canonical?.runtimeMinutes ? canonical.runtimeMinutes * 60 : 0
    if (duration > 0 && time > 0) {
      saveCW(watching.id, time, duration)
      setCW(getCW())
    }
  }

  const ended = () => {
    if (!watching) return
    removeCW(watching.id)
    setCW(getCW())
    setToast('You finished watching this title.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSelected(null)
    setWatching(null)
    setPlayer(false)
  }

    if (authLoading) {
    return <Shell><div className="flex min-h-screen items-center justify-center"><Sparkles className="animate-pulse text-red-500" /></div></Shell>
  }

  if (!session) return <AuthScreen />

  if (loading) {
    return <Shell><div className="flex min-h-screen flex-col items-center justify-center gap-4"><Sparkles className="animate-pulse text-red-500" /><p className="text-sm text-white/40">Loading PMF-Flix...</p></div></Shell>
  }

  if (error) {
    return <Shell><div className="flex min-h-screen items-center justify-center px-6 text-center"><div><Film className="mx-auto mb-4 text-red-500" /><h1 className="text-2xl font-black">PMF-Flix is temporarily unavailable</h1><p className="mt-2 text-white/50">{error}</p><button onClick={() => location.reload()} className="mt-6 rounded-xl bg-white px-5 py-3 font-bold text-black">Refresh</button></div></div></Shell>
  }

  const selectedCanonical = selected ? movies.find(m => num(m.id) === selected.id) : null
  const videoUrl = watching?.videoUrl?.trim() || (watching?.title === 'The Journey' ? '/movies/the-journey.mp4' : '')
  const watchingCanonical = watching ? movies.find(m => num(m.id) === watching.id) : null

  return (
    <Shell>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-5 sm:px-8">
          <button onClick={() => go('home')} className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600"><Film size={20} /></span>
            <span className="hidden sm:block text-xl font-black tracking-tight">PMF<span className="text-red-500">LIX</span></span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(n => {
              const Icon = n.icon
              return <button key={n.value} onClick={() => go(n.value)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${section === n.value ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}><Icon size={16} />{n.label}</button>
            })}
          </nav>

          <div className="relative ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <div className="flex items-center rounded-xl border border-white/10 bg-white/5 px-3">
                <Search size={16} className="text-white/40" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PMF..." className="w-48 bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-white/30" />
              </div>
            </div>
            <button onClick={() => setMobile(!mobile)} className="rounded-xl p-2 hover:bg-white/10 md:hidden"><Menu /></button>
            <button onClick={signOut} className="hidden rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white sm:block"><LogOut size={18} /></button>

            {searchResults.length > 0 && (
              <div className="absolute right-0 top-14 w-80 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
                {searchResults.map(m => {
                  const d = map.get(num(m.id))
                  if (!d) return null
                  return <button key={m.id} onClick={() => { openMovie(d); setSearch('') }} className="flex w-full gap-3 p-3 text-left hover:bg-white/10"><img src={d.poster} className="h-14 w-10 rounded object-cover" /><span><b className="block text-sm">{m.title}</b><small className="text-white/40">{m.releaseYear || ''} · {m.contentType}</small></span></button>
                })}
              </div>
            )}
          </div>
        </div>

        {mobile && (
          <div className="border-t border-white/10 bg-black px-5 py-4 md:hidden">
            <div className="mb-3 flex items-center rounded-xl border border-white/10 bg-white/5 px-3"><Search size={16} className="text-white/40" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PMF..." className="w-full bg-transparent px-2 py-3 outline-none" /></div>
            {NAV.map(n => <button key={n.value} onClick={() => go(n.value)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-bold hover:bg-white/10"><n.icon size={17} />{n.label}</button>)}
            <button onClick={signOut} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-bold text-red-400"><LogOut size={17} />Sign Out</button>
          </div>
        )}
      </header>

      {section === 'home' && (
        <>
          <section className="relative flex min-h-[680px] items-end overflow-hidden pt-16">
            <img src={hero?.backdropUrl || heroImage} className="absolute inset-0 h-full w-full object-cover" alt="" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-black/30" />
            <div className="relative z-10 mx-auto w-full max-w-[1600px] px-5 pb-20 sm:px-8 lg:px-12">
              <div className="max-w-2xl">
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider">Featured Film</span>
                  {hero?.isPmfOriginal && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black">PMF ORIGINAL</span>}
                </div>
                <h1 className="text-5xl font-black tracking-tight sm:text-7xl">{hero?.title || 'Prince Mufasa Flix'}</h1>
                <p className="mt-4 text-lg text-white/70">{hero?.tagline || 'Your World. Your Stories. Your Flix.'}</p>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/55">{hero?.synopsis || 'Discover cinematic stories from around the world.'}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  {hero && <button onClick={() => { const d = map.get(num(hero.id)); if (d) playMovie(d) }} className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-black"><Play size={18} fill="currentColor" />Watch Now</button>}
                  {hero && <button onClick={() => { const d = map.get(num(hero.id)); if (d) openMovie(d) }} className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 font-bold backdrop-blur hover:bg-white/20"><Info size={18} />More Info</button>}
                </div>
                {hero && <div className="mt-6 flex items-center gap-4 text-xs text-white/50"><span className="flex items-center gap-1 text-white"><Star size={13} fill="currentColor" />{hero.rating || 'N/A'}</span><span>{hero.releaseYear || ''}</span><span>{runtime(hero)}</span><span>{hero.genres.slice(0, 2).map(x => metaName(catalog, x)).join(' · ')}</span></div>}
              </div>
            </div>
          </section>

          <main className="mx-auto max-w-[1600px] px-5 py-12 sm:px-8 lg:px-12">
            <Rail title="Continue Watching" movies={continueMovies} map={map} list={list} liked={liked} cw={cw} open={openMovie} play={playMovie} toggleList={toggleList} toggleLike={toggleLike} />
            <Rail title="Trending Now" movies={trending.length ? trending : popular.slice(0, 12)} map={map} list={list} liked={liked} cw={cw} open={openMovie} play={playMovie} toggleList={toggleList} toggleLike={toggleLike} />
            <Rail title="New Releases" movies={newest.slice(0, 12)} map={map} list={list} liked={liked} cw={cw} open={openMovie} play={playMovie} toggleList={toggleList} toggleLike={toggleLike} />
            <Rail title="PMF Originals" movies={originals} map={map} list={list} liked={liked} cw={cw} open={openMovie} play={playMovie} toggleList={toggleList} toggleLike={toggleLike} />
            <Rail title="Top Rated" movies={topRated.slice(0, 12)} map={map} list={list} liked={liked} cw={cw} open={openMovie} play={playMovie} toggleList={toggleList} toggleLike={toggleLike} />
          </main>
        </>
      )}

      {section !== 'home' && (
        <main className="mx-auto max-w-[1600px] px-5 pb-20 pt-28 sm:px-8 lg:px-12">
          <Title
            eyebrow="Explore PMF"
            title={section === 'my-list' ? 'My List' : section === 'tv' ? 'TV Series' : 'Movies'}
            description={section === 'my-list' ? 'Your personal collection of titles.' : 'Discover your next cinematic experience.'}
          />

          <div className="mb-7 flex flex-wrap items-center gap-3">
            <button onClick={() => setFilters(!filters)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold"><SlidersHorizontal size={16} />Filters</button>
            <select value={sort} onChange={e => setSort(e.target.value as SortMode)} className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm font-bold outline-none">
              <option value="popular">Most Popular</option><option value="newest">Newest</option><option value="rating">Top Rated</option><option value="title">Title</option>
            </select>
            <span className="text-xs text-white/35">{filtered.length} titles</span>
          </div>

          {filters && (
            <div className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 sm:grid-cols-3">
              <select value={genre} onChange={e => setGenre(e.target.value)} className="rounded-xl bg-zinc-900 p-3 text-sm"><option value="">All Genres</option>{catalog?.genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <select value={year} onChange={e => setYear(e.target.value)} className="rounded-xl bg-zinc-900 p-3 text-sm"><option value="">All Years</option>{years.map(y => <option key={y} value={String(y)}>{y}</option>)}</select>
              <select value={rating} onChange={e => setRating(e.target.value)} className="rounded-xl bg-zinc-900 p-3 text-sm"><option value="">Any Rating</option><option value="8">8+</option><option value="7">7+</option><option value="6">6+</option></select>
            </div>
          )}

          {filtered.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map(c => {
                const d = map.get(num(c.id))
                if (!d) return null
                return <Card key={c.id} movie={d} canonical={c} listed={list.includes(num(c.id))} liked={liked.includes(num(c.id))} cw={cw.find(x => x.id === num(c.id)) || null} open={openMovie} play={playMovie} toggleList={toggleList} toggleLike={toggleLike} />
              })}
            </div>
          ) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 text-center">
              <Bookmark className="mb-4 text-white/20" size={42} />
              <h3 className="text-xl font-black">Nothing here yet</h3>
              <p className="mt-2 text-sm text-white/40">Try another filter or explore more titles.</p>
            </div>
          )}
        </main>
      )}

      <footer className="border-t border-white/10 px-5 py-10 text-center text-xs text-white/35">
        <b className="text-white">PMF<span className="text-red-500">LIX</span></b> · Your World. Your Stories. Your Flix.
        <div className="mt-2">© {new Date().getFullYear()} Prince Mufasa Flix</div>
      </footer>

      {toast && <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-white/10 bg-zinc-900 px-5 py-3 text-sm font-bold shadow-2xl">{toast}</div>}

      {selected && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/90 p-4 backdrop-blur-xl sm:p-8">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="relative min-h-[420px] overflow-hidden">
              <img src={selectedCanonical?.backdropUrl || selected.poster} className="absolute inset-0 h-full w-full object-cover opacity-60" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
              <button onClick={() => setSelected(null)} className="absolute right-5 top-5 rounded-full bg-black/60 p-3"><X /></button>
              <div className="relative flex min-h-[420px] items-end p-6 sm:p-10">
                <div className="max-w-3xl">
                  {selectedCanonical?.isPmfOriginal && <span className="rounded-full bg-red-600 px-3 py-1 text-[9px] font-black uppercase">PMF Original</span>}
                  <h2 className="mt-3 text-4xl font-black sm:text-6xl">{selected.title}</h2>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/50"><span>{selected.year}</span><span className="flex items-center gap-1"><Star size={12} fill="currentColor" />{selected.rating || 'N/A'}</span><span>{selectedCanonical ? runtime(selectedCanonical) : selected.duration}</span></div>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-white/60">{selected.description}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button onClick={() => playMovie(selected)} className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-black"><Play size={17} fill="currentColor" />Watch Now</button>
                    <button onClick={() => toggleList(selected.id)} className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 font-bold">{list.includes(selected.id) ? <Check size={17} /> : <Plus size={17} />}{list.includes(selected.id) ? 'In My List' : 'My List'}</button>
                    <button onClick={() => toggleLike(selected.id)} className="rounded-xl bg-white/10 px-4"><Heart fill={liked.includes(selected.id) ? 'currentColor' : 'none'} /></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-10">
              <div>
                <h3 className="mb-3 font-black">About this title</h3>
                <p className="text-sm leading-7 text-white/50">{selected.description}</p>
              </div>
              <div className="space-y-3 text-sm text-white/50">
                {selectedCanonical?.genres.length ? <p><b className="text-white">Genres:</b> {selectedCanonical.genres.map(x => metaName(catalog, x)).join(', ')}</p> : null}
                <p><b className="text-white">Type:</b> {selected.type}</p>
                {selectedCanonical?.languageIds.length ? <p className="flex gap-2"><Globe2 size={16} />{selectedCanonical.languageIds.map(x => metaName(catalog, x)).join(', ')}</p> : null}
                {selected.downloadable && selectedCanonical?.downloadAvailability?.url && <a href={selectedCanonical.downloadAvailability.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-bold text-white"><Download size={16} />Download</a>}
              </div>
            </div>
          </div>
        </div>
      )}

      {player && watching && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black p-3 sm:p-8">
          <button onClick={() => { setPlayer(false); setWatching(null); setCW(getCW()) }} className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-3"><X /></button>
          <div className="w-full max-w-6xl">
            {videoUrl && isYouTube(videoUrl) ? (
              <iframe src={youtube(videoUrl)} title={watching.title} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen className="aspect-video w-full rounded-2xl border border-white/10" />
            ) : videoUrl ? (
              <VideoPlayer
                videoUrl={videoUrl}
                videoAssets={watchingCanonical?.videoAssets || []}
                subtitles={watchingCanonical?.subtitles || []}
                posterUrl={watching.poster}
                title={watching.title}
                autoPlay
                initialTime={cw.find(x => x.id === watching.id)?.position || 0}
                onTimeUpdate={timeUpdate}
                onEnded={ended}
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-white/10 bg-zinc-950 text-center">
                <Film size={48} className="mb-4 text-white/20" />
                <h2 className="text-2xl font-black">Video coming soon</h2>
                <p className="mt-2 text-sm text-white/40">The licensed playback asset for this title has not been connected yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-white/10 bg-black/90 p-2 backdrop-blur-xl md:hidden">
        {NAV.map(n => <button key={n.value} onClick={() => go(n.value)} className={`flex flex-1 flex-col items-center gap-1 py-2 text-[9px] font-bold ${section === n.value ? 'text-white' : 'text-white/40'}`}><n.icon size={18} />{n.label}</button>)}
      </div>
    </Shell>
  )
 }
