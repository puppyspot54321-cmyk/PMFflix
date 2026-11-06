import { useState } from 'react'
import {
  Copy,
  Dice5,
  Globe2,
  Play,
  RotateCw,
  Users,
  X,
} from 'lucide-react'
import type { Movie } from '../movieData/movies'

interface WorldCinemaModalProps {
  isOpen: boolean
  onClose: () => void
  movies: Movie[]
  onSelectMovie: (movie: Movie) => void
}

export function WorldCinemaModal({
  isOpen,
  onClose,
  movies,
  onSelectMovie,
}: WorldCinemaModalProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>('west_africa')
  const [query, setQuery] = useState('')

  if (!isOpen) return null

  // Regional collections deliberately require an explicit region/cinema label in
  // the movie's category metadata. Genre alone is never used to guess geography.
  const REGIONS = [
    { id: 'west_africa', name: 'West Africa', sub: 'Nollywood · Ghanaian cinema', badge: 'The African spotlight', color: 'amber', keys: ['nollywood', 'west african', 'west africa', 'nigerian cinema', 'ghanaian cinema', 'ghanaian film', 'nigeria', 'ghana'] },
    { id: 'east_africa', name: 'East Africa', sub: 'Swahili · Kenyan · Tanzanian', badge: 'Stories of the Rift', color: 'emerald', keys: ['east african', 'east africa', 'swahili cinema', 'kenyan cinema', 'tanzanian cinema', 'uganda cinema', 'rwanda cinema'] },
    { id: 'southern_africa', name: 'Southern Africa', sub: 'South African stories', badge: 'Southern frames', color: 'orange', keys: ['southern african', 'southern africa', 'south african cinema', 'south africa', 'zimbabwean cinema', 'botswana cinema'] },
    { id: 'north_africa', name: 'North Africa', sub: 'Maghreb · Egyptian cinema', badge: 'Desert & dynasty', color: 'yellow', keys: ['north african', 'north africa', 'egyptian cinema', 'egyptian film', 'moroccan cinema', 'algerian cinema', 'tunisian cinema', 'maghreb'] },
    { id: 'hollywood', name: 'Hollywood', sub: 'US studio cinema', badge: 'The studio universe', color: 'sky', keys: ['hollywood', 'american cinema', 'us cinema', 'united states cinema'] },
    { id: 'bollywood', name: 'Bollywood', sub: 'Hindi-language Indian cinema', badge: 'Colour. Music. Emotion.', color: 'rose', keys: ['bollywood', 'hindi cinema', 'hindi film'] },
    { id: 'south_asia', name: 'South Asia', sub: 'Indian regional · Pakistani · Bangladeshi', badge: 'South Asian screens', color: 'orange', keys: ['south asian cinema', 'south asia', 'indian cinema', 'tamil cinema', 'telugu cinema', 'malayalam cinema', 'kannada cinema', 'pakistani cinema', 'bangladeshi cinema'] },
    { id: 'east_asia', name: 'East Asian Cinema', sub: 'Korean · Japanese · Chinese', badge: 'East Asian visions', color: 'violet', keys: ['east asian cinema', 'east asia', 'korean cinema', 'k-drama', 'japanese cinema', 'anime', 'chinese cinema', 'hong kong cinema', 'taiwanese cinema'] },
    { id: 'southeast_asia', name: 'Southeast Asia', sub: 'Filipino · Thai · Indonesian', badge: 'Island stories', color: 'teal', keys: ['southeast asian cinema', 'southeast asia', 'filipino cinema', 'philippine cinema', 'thai cinema', 'indonesian cinema', 'vietnamese cinema'] },
    { id: 'europe', name: 'European Cinema', sub: 'British · French · Italian & beyond', badge: 'European auteurs', color: 'blue', keys: ['european cinema', 'british cinema', 'uk cinema', 'french cinema', 'italian cinema', 'spanish cinema', 'german cinema', 'scandinavian cinema'] },
    { id: 'latin_america', name: 'Latin America', sub: 'Mexican · Brazilian · Latin stories', badge: 'Vibrant perspectives', color: 'lime', keys: ['latin american cinema', 'latin america', 'mexican cinema', 'brazilian cinema', 'argentinian cinema', 'colombian cinema'] },
    { id: 'middle_east', name: 'Middle East', sub: 'Arab · Persian · Turkish', badge: 'Between worlds', color: 'yellow', keys: ['middle eastern cinema', 'middle east', 'arab cinema', 'iranian cinema', 'persian cinema', 'turkish cinema'] },
    { id: 'nordic', name: 'Nordic & Scandinavian', sub: 'Sweden · Norway · Denmark · Iceland', badge: 'Northern perspectives', color: 'blue', keys: ['nordic cinema', 'scandinavian cinema', 'swedish cinema', 'norwegian cinema', 'danish cinema', 'icelandic cinema', 'finnish cinema'] },
    { id: 'oceania', name: 'Oceania & Pacific', sub: 'Australian · New Zealand · Pacific', badge: 'Stories across the Pacific', color: 'teal', keys: ['oceanian cinema', 'oceania', 'australian cinema', 'new zealand cinema', 'maori cinema', 'pacific island cinema'] },
    { id: 'caribbean', name: 'Caribbean Cinema', sub: 'Jamaican · Haitian · Caribbean diaspora', badge: 'Island voices', color: 'lime', keys: ['caribbean cinema', 'jamaican cinema', 'haitian cinema', 'trinidadian cinema', 'dominican cinema'] },
    { id: 'central_asia', name: 'Central Asia', sub: 'Kazakh · Uzbek · Kyrgyz stories', badge: 'The heart of the continent', color: 'yellow', keys: ['central asian cinema', 'central asia', 'kazakh cinema', 'uzbek cinema', 'kyrgyz cinema'] },
    { id: 'russia_eurasia', name: 'Russia & Eurasia', sub: 'Russian · Ukrainian · Georgian', badge: 'Eurasian perspectives', color: 'violet', keys: ['russian cinema', 'ukrainian cinema', 'georgian cinema', 'eurasian cinema', 'armenian cinema', 'azerbaijani cinema'] },
    { id: 'francophone', name: 'Francophone Stories', sub: 'French-language films worldwide', badge: 'Stories in French', color: 'blue', keys: ['francophone cinema', 'french language film', 'french-language cinema', 'african francophone cinema'] },
    { id: 'lusophone', name: 'Portuguese-Language Cinema', sub: 'Brazil · Portugal · Lusophone Africa', badge: 'Stories in Portuguese', color: 'lime', keys: ['lusophone cinema', 'portuguese language film', 'portuguese cinema', 'brazilian cinema', 'angolan cinema', 'mozambican cinema', 'cape verdean cinema'] },
    { id: 'independent', name: 'Independent & Arthouse', sub: 'Independent voices · Auteur cinema', badge: 'Beyond the mainstream', color: 'violet', keys: ['independent film', 'independent cinema', 'arthouse', 'art-house', 'auteur cinema'] },
    { id: 'classics', name: 'World Classics', sub: 'Landmark films across eras', badge: 'Cinema through time', color: 'amber', keys: ['classic film', 'world classics', 'golden age cinema', 'silent film', 'black and white classic'] },
    { id: 'family', name: 'Family & Feel-Good', sub: 'Shared viewing across generations', badge: 'Stories to share', color: 'emerald', keys: ['family film', 'feel-good', 'feel good', 'coming of age', 'wholesome'] },
    { id: 'faith', name: 'Faith & Spirituality', sub: 'Belief · Purpose · Reflection', badge: 'Stories of meaning', color: 'yellow', keys: ['faith-based film', 'faith based', 'spiritual cinema', 'religious film', 'inspirational film'] },
    { id: 'music', name: 'Music & Performance', sub: 'Concerts · Dance · Music stories', badge: 'Feel the rhythm', color: 'rose', keys: ['music film', 'musical', 'concert film', 'dance film', 'music documentary'] },
    { id: 'short_films', name: 'Short Films', sub: 'Brief stories · Bold ideas', badge: 'Small runtime, big ideas', color: 'sky', keys: ['short film', 'short films', 'microfilm'] },
    { id: 'series', name: 'Global Series & Dramas', sub: 'International series and episodic stories', badge: 'One more episode', color: 'teal', keys: ['series', 'tv drama', 'television drama', 'web series', 'k-drama', 'telenovela'] },
    { id: 'sports', name: 'Sports & Competition', sub: 'Athletes · Rivalries · Great moments', badge: 'Beyond the final whistle', color: 'emerald', keys: ['sports documentary', 'sports film', 'sports', 'competition'] },
    { id: 'food_travel', name: 'Food, Travel & Culture', sub: 'Places · People · Everyday life', badge: 'Explore the world', color: 'orange', keys: ['travel documentary', 'food documentary', 'culinary', 'travel and culture', 'culture documentary'] },
    { id: 'documentary', name: 'Documentaries', sub: 'True stories & real worlds', badge: 'Reality, revealed', color: 'teal', keys: ['documentary', 'documentaries', 'docuseries', 'true story'] },
    { id: 'animation', name: 'Animation & Anime', sub: 'Animated worlds, every age', badge: 'Beyond the frame', color: 'violet', keys: ['animation', 'animated', 'anime'] },
    { id: 'science_fiction', name: 'Sci-Fi & Fantasy', sub: 'Other worlds · Future visions', badge: 'Worlds beyond', color: 'sky', keys: ['science fiction', 'sci-fi', 'fantasy'] },
    { id: 'thriller', name: 'Thrillers & Crime', sub: 'Suspense · Mystery · Investigation', badge: 'Edge-of-seat cinema', color: 'rose', keys: ['thriller', 'crime', 'mystery', 'detective'] },
    { id: 'romance', name: 'Romance & Drama', sub: 'Love, life & human stories', badge: 'Stories that stay', color: 'rose', keys: ['romance', 'romantic', 'drama', 'melodrama'] },
    { id: 'action', name: 'Action & Adventure', sub: 'Epic journeys & high stakes', badge: 'Adrenaline collection', color: 'orange', keys: ['action', 'adventure', 'martial arts'] },
  ]
  const currentRegion = REGIONS.find((r) => r.id === selectedRegion) || REGIONS[0]
  const normalize = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9+ -]/g, ' ')
  const matchedMovies = movies.filter((movie) => {
    const metadata = normalize(movie.category)
    const matchesCollection = currentRegion.keys.some((key) => metadata.includes(key))
    const matchesQuery = !query.trim() || normalize(`${movie.title} ${movie.category} ${movie.year}`).includes(normalize(query.trim()))
    return matchesCollection && matchesQuery
  })
  const palette: Record<string, string> = {
    amber: 'from-amber-400/20 via-amber-500/5 border-amber-300/25 text-amber-200',
    emerald: 'from-emerald-400/20 via-emerald-500/5 border-emerald-300/25 text-emerald-200',
    orange: 'from-orange-400/20 via-orange-500/5 border-orange-300/25 text-orange-200',
    yellow: 'from-yellow-300/20 via-yellow-500/5 border-yellow-200/25 text-yellow-100',
    sky: 'from-sky-400/20 via-sky-500/5 border-sky-300/25 text-sky-200',
    rose: 'from-rose-400/20 via-rose-500/5 border-rose-300/25 text-rose-200',
    violet: 'from-violet-400/20 via-violet-500/5 border-violet-300/25 text-violet-200',
    teal: 'from-teal-400/20 via-teal-500/5 border-teal-300/25 text-teal-200',
    blue: 'from-blue-400/20 via-blue-500/5 border-blue-300/25 text-blue-200',
    lime: 'from-lime-400/20 via-lime-500/5 border-lime-300/25 text-lime-200',
  }
  const accent = palette[currentRegion.color] || palette.amber

  return (
    <div className="pmf-world-cinema fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-2xl">
      <div className="relative flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-[#06060d] text-white shadow-[0_25px_100px_rgba(0,0,0,.7)]">
        <div className={`relative overflow-hidden border-b border-white/10 bg-gradient-to-r ${accent} px-4 py-4 sm:px-6 sm:py-5`}>
          <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full border border-white/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/30 shadow-xl"><Globe2 className="h-5 w-5" /></div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.28em] text-white/60">PMF / Global Screen Atlas</div>
                <h2 className="mt-1 text-xl sm:text-2xl font-black tracking-tight">World Cinema</h2>
                <p className="mt-1 max-w-2xl text-[11px] sm:text-xs leading-relaxed text-white/65">A collection for every screen culture. Each title appears only when its catalogue metadata matches this collection.</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close World Cinema" className="rounded-xl border border-white/15 bg-black/25 p-2 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative mt-4 flex items-center gap-2">
            <span className="rounded-lg border border-white/15 bg-black/25 px-2.5 py-2 text-[10px] font-black tracking-wider">{currentRegion.badge}</span>
            <span className="text-[10px] text-white/60">{matchedMovies.length} matched titles</span>
          </div>
        </div>
        <div className="border-b border-white/[.07] bg-black/30 px-3 py-3 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[9px] font-black uppercase tracking-[.24em] text-white/40">Choose your universe</span>
            <span className="text-[9px] text-white/35">Curated by catalogue tags</span>
          </div>
          <div className="no-scrollbar grid max-h-40 grid-cols-2 gap-2 overflow-y-auto sm:max-h-32 sm:grid-cols-3 lg:grid-cols-6">
            {REGIONS.map((region) => {
              const active = region.id === selectedRegion
              return <button key={region.id} onClick={() => setSelectedRegion(region.id)} className={`min-w-0 rounded-xl border px-3 py-2.5 text-left transition-all ${active ? `bg-gradient-to-br ${palette[region.color]} shadow-lg` : 'border-white/[.08] bg-white/[.025] text-white/65 hover:border-white/20 hover:bg-white/[.06]'}`}>
                <span className="block truncate text-[11px] font-black">{region.name}</span>
                <span className="mt-0.5 block truncate text-[9px] text-white/40">{region.sub}</span>
              </button>
            })}
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search within ${currentRegion.name}…`} className="mt-3 w-full rounded-xl border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/30" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {matchedMovies.length === 0 ? <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[.02] px-5 py-8 text-center">
            <Globe2 className="mb-3 h-7 w-7 text-white/25" />
            <h3 className="text-sm font-black text-white/85">This collection is waiting for its first titles</h3>
            <p className="mt-2 max-w-md text-xs leading-5 text-white/45">No titles have an explicit “{currentRegion.name}” tag in their category metadata yet. Add a matching catalogue tag in Studio; PMF-Flix will not guess a movie's origin from its genre.</p>
          </div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {matchedMovies.map((movie) => <button type="button" key={movie.id} onClick={() => { onSelectMovie(movie); onClose() }} className="group min-w-0 overflow-hidden rounded-xl sm:rounded-2xl border border-white/[.08] bg-white/[.025] text-left transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[.06]">
              <div className="relative aspect-[2/3] overflow-hidden bg-black">
                <img src={movie.poster} alt={movie.title} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-90" />
                <span className={`absolute left-2 top-2 max-w-[85%] truncate rounded-md border bg-black/55 px-2 py-1 text-[8px] font-black uppercase tracking-wider backdrop-blur ${accent.split(' ').filter(v => v.startsWith('border-') || v.startsWith('text-')).join(' ')}`}>{currentRegion.name}</span>
                <div className="absolute inset-x-2 bottom-2 sm:inset-x-3 sm:bottom-3">
                  <span className="text-[9px] font-bold text-white/60">{movie.year} · {movie.type || 'Film'}</span>
                  <h3 className="mt-0.5 line-clamp-2 text-xs sm:text-sm font-black leading-snug text-white">{movie.title}</h3>
                  <span className="mt-1 block truncate text-[9px] text-white/55">{movie.category}</span>
                </div>
              </div>
            </button>)}
          </div>}
        </div>
      </div>
    </div>
  )
}

interface SurpriseMeModalProps {
  isOpen: boolean
  onClose: () => void
  movies: Movie[]
  onPlayMovie: (movie: Movie) => void
  onExploreMovie: (movie: Movie) => void
}

export function SurpriseMeModal({
  isOpen,
  onClose,
  movies,
  onPlayMovie,
  onExploreMovie,
}: SurpriseMeModalProps) {
  const [pickedMovie, setPickedMovie] = useState<Movie | null>(() => {
    return movies[Math.floor(Math.random() * movies.length)] || null
  })
  const [isSpinning, setIsSpinning] = useState(false)

  if (!isOpen) return null

  const handleRollAgain = () => {
    if (movies.length < 2) return
    setIsSpinning(true)
    window.setTimeout(() => {
      const pool = movies.filter((item) => item.id !== pickedMovie?.id)
      const choices = pool.length ? pool : movies
      setPickedMovie(choices[Math.floor(Math.random() * choices.length)] || null)
      setIsSpinning(false)
    }, 350)
  }

  const movie = pickedMovie || movies[0]

  return (
    <div className="pmf-surprise-overlay fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-[#020107]/90 p-3 backdrop-blur-2xl sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Surprise Me movie recommendation"
        className="pmf-surprise-panel relative my-auto grid w-full max-w-4xl overflow-hidden rounded-[22px] border border-white/10 bg-[#090714] text-white shadow-[0_30px_100px_rgba(0,0,0,.75)] sm:rounded-[28px] md:grid-cols-[minmax(0,1.05fr)_minmax(300px,.95fr)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Surprise Me"
          className="absolute right-3 top-3 z-20 rounded-full border border-white/15 bg-black/55 p-2 text-white/75 backdrop-blur-md transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {movie ? (
          <>
            <div className="pmf-surprise-art relative min-h-[220px] overflow-hidden bg-black sm:min-h-[300px] md:min-h-[520px]">
              <img
                src={movie.poster}
                alt={movie.title}
                className={`absolute inset-0 h-full w-full object-cover object-center transition duration-500 ${isSpinning ? 'scale-[1.04] opacity-40 blur-[2px]' : 'scale-100 opacity-100'}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#090714] via-black/10 to-black/15 md:bg-gradient-to-r md:from-transparent md:via-black/5 md:to-[#090714]/35" />
              <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[8px] font-black uppercase tracking-[.24em] text-white/75 backdrop-blur-md sm:left-5 sm:top-5">
                PMF • Curated discovery
              </div>
              <div className="absolute bottom-4 left-4 right-4 md:hidden">
                <p className="text-[8px] font-black uppercase tracking-[.24em] text-violet-200">Tonight's unexpected pick</p>
                <h2 className="mt-1 line-clamp-2 text-2xl font-black leading-tight tracking-[-.04em] text-white">{movie.title}</h2>
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-center p-4 sm:p-7 md:p-8">
              <div className="hidden md:block">
                <p className="text-[9px] font-black uppercase tracking-[.3em] text-violet-300">PMF Cinema Roulette</p>
                <p className="mt-3 text-xs font-semibold text-white/45">A story selected from your catalogue</p>
                <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-.055em] text-white lg:text-4xl">{movie.title}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="max-w-full truncate rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[9px] font-bold text-violet-100">{movie.category || 'Featured selection'}</span>
                <span className="text-[10px] text-white/45">{movie.year || 'Catalogue pick'}</span>
                <span className="text-white/20">•</span>
                <span className="text-[10px] text-white/45">{movie.duration || 'Feature'}</span>
              </div>

              <p className="mt-3 line-clamp-3 text-[12px] leading-6 text-white/60 sm:text-[13px]">
                {movie.description || 'A new story is waiting to be discovered. Press play to begin your next PMF-Flix experience.'}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-7 sm:gap-3">
                <button
                  type="button"
                  onClick={() => { onPlayMovie(movie); onClose() }}
                  className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-[10px] font-black uppercase tracking-[.18em] text-white shadow-[0_10px_30px_rgba(139,92,246,.24)] transition hover:brightness-110 sm:col-span-1"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Play this title
                </button>
                <button
                  type="button"
                  onClick={() => { onExploreMovie(movie); onClose() }}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-3 py-3 text-[9px] font-bold uppercase tracking-[.14em] text-white/80 transition hover:bg-white/10"
                >
                  Explore details
                </button>
                <button
                  type="button"
                  disabled={isSpinning || movies.length < 2}
                  onClick={handleRollAgain}
                  className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.025] px-3 py-2.5 text-[9px] font-bold uppercase tracking-[.16em] text-white/65 transition hover:border-violet-300/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-1"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
                  Find another film
                </button>
              </div>
              <p className="mt-4 text-center text-[8px] font-semibold uppercase tracking-[.2em] text-white/25 md:text-left">Your world. Your stories. Your Flix.</p>
            </div>
          </>
        ) : (
          <div className="col-span-full flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center">
            <Dice5 className="h-8 w-8 text-violet-300/60" />
            <h2 className="mt-4 text-lg font-black">Your next discovery is on its way</h2>
            <p className="mt-2 max-w-sm text-xs leading-6 text-white/45">There are no available titles to draw from just yet. Add published titles to the catalogue and try again.</p>
            <button type="button" onClick={onClose} className="mt-6 rounded-xl border border-white/15 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-white/75">Close</button>
          </div>
        )}
      </section>
    </div>
  )
}

interface WatchPartyModalProps {
  isOpen: boolean
  onClose: () => void
  movie: Movie | null
}

export function WatchPartyModal({
  isOpen,
  onClose,
  movie,
}: WatchPartyModalProps) {
  const [copied, setCopied] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('Tonight at 8:00 PM')

  if (!isOpen || !movie) return null

  const shareText = `🍿 Join my PMF-Flix Watch Party for "${movie.title}" (${movie.year})!\nTime: ${scheduledDate}\nCategory: ${movie.category}\nWatch on Prince Mufasa Flix: ${window.location.origin}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-purple-500/30 bg-[#0a0715] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-300">
            <Users className="h-4 w-4" />
            PMF Watch Party Lounge
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 p-1.5 text-white/40 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex gap-4">
            <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
              <img
                src={movie.poster}
                alt={movie.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Scheduled Screening
              </span>
              <h3 className="text-xl font-black text-white">{movie.title}</h3>
              <p className="mt-1 text-xs text-white/50">{movie.year} • {movie.category}</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
              Party Time / Date
            </label>
            <input
              type="text"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              placeholder="e.g. Tonight at 8:00 PM"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-6 text-white/70">
            <p className="font-semibold text-white">Party Invitation Preview:</p>
            <p className="mt-1 font-mono text-[11px] text-white/50 whitespace-pre-line">
              {shareText}
            </p>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Invitation Copied!' : 'Copy Party Invitation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
