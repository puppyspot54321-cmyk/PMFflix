import journeyPoster from '../assets/journey.jpg (2).png'
import nightCityPoster from '../assets/night-city.jpg'
import finalHorizonPoster from '../assets/final-horizon.jpg'
import hiddenWallPoster from '../assets/hidden-wall.jpg'
import lastMissionPoster from '../assets/last-mission.jpg'

export const PMF_TELEGRAM_BRIDGE_BASE = 'https://pmf-telegram-bridge.onrender.com'

export type MoviePublishStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'unpublished' | 'archived'

export type SubtitleTrackMeta = {
  id: string
  label: string
  language: string
  src: string
  default?: boolean
}

export type Movie = {
  id: string
  title: string
  year: number
  category: string
  type?: 'Movie' | 'Series' | 'Skit' | 'Short' | 'Sport' | 'Novel' | string
  rating?: number | string
  duration?: string
  description?: string
  poster: string
  backdrop?: string
  featured?: boolean
  videoUrl?: string
  videoType?: 'youtube' | 'mp4' | 'hls' | string
  trailerUrl?: string
  downloadable?: boolean
  isMidnight18?: boolean
  isKids?: boolean
  seriesTitle?: string
  seasonNumber?: number
  episodeNumber?: number
  telegramMessageId?: string | number
  subtitles?: SubtitleTrackMeta[]
  status?: MoviePublishStatus
  genreIds?: string[]
  collectionIds?: string[]
  industryIds?: string[]
  peopleCredits?: Array<{ personId: string; role: string; characterName?: string }>
  partnerCredits?: Array<{ partnerId: string; role: string }>
}

/**
 * Unapproved AI-generated demonstration titles identified during repository & workspace audit.
 * Strictly blocked from appearing in public or cached catalogues without explicit owner creation.
 */
export const UNAPPROVED_DEMO_TITLE_PATTERNS: RegExp[] = [
  /^crown of zamfara$/i,
  /^crown of dahomey$/i,
  /^eko rising$/i,
  /^lagos noir$/i,
  /^savannah pulse$/i,
  /^solaris protocol$/i,
  /^neon safari/i,
  /^midnight in victoria island$/i,
  /^echoes of the sahel$/i,
  /^the palm-wine legend/i,
]

export function isUnapprovedDemoMovie(movie: {
  title?: string | null
  seriesTitle?: string | null
  series_title?: string | null
}): boolean {
  const title = String(movie.title || '').trim()
  const seriesTitle = String(movie.seriesTitle || movie.series_title || '').trim()
  return UNAPPROVED_DEMO_TITLE_PATTERNS.some(
    (pattern) => pattern.test(title) || (seriesTitle && pattern.test(seriesTitle)),
  )
}

/**
 * Known verified Telegram Bridge movie routes confirmed live with HTTP 206 Partial Content:
 * - /telegram-media/1 (886.3 MB MP4)
 * - /telegram-media (21.4 MB MP4)
 * - /telegram-media/3 (836.4 MB MP4)
 * - /telegram-media/4 (412.9 MB MP4)
 * - /telegram-media/5 (1000.3 MB MP4)
 */
export const VERIFIED_TELEGRAM_BRIDGE_IDS = new Set(['1', '3', '4', '5'])

export interface StreamTechnicalProfile {
  routePattern: RegExp
  bitrateKbps: number
  isFastStart: boolean
  codecLabel: string
}

/**
 * Measured technical profiles from live HTTP 206 MP4 mvhd/moov inspections on pmf-telegram-bridge.onrender.com
 */
export const KNOWN_STREAM_PROFILES: StreamTechnicalProfile[] = [
  {
    routePattern: /\/telegram-media\/1(\?|$)/i,
    bitrateKbps: 1022,
    isFastStart: false,
    codecLabel: 'H.264 / AAC • 1,022 kbps',
  },
  {
    routePattern: /\/telegram-media\/3(\?|$)/i,
    bitrateKbps: 772,
    isFastStart: true,
    codecLabel: 'H.264 / AAC • 772 kbps (FastStart)',
  },
  {
    routePattern: /\/telegram-media\/4(\?|$)/i,
    bitrateKbps: 538,
    isFastStart: true,
    codecLabel: 'H.264 / AAC • 538 kbps (FastStart)',
  },
  {
    routePattern: /\/telegram-media\/5(\?|$)/i,
    bitrateKbps: 927,
    isFastStart: true,
    codecLabel: 'H.264 / AAC • 927 kbps (FastStart)',
  },
  {
    routePattern: /\/telegram-media(\?|$)/i,
    bitrateKbps: 2935,
    isFastStart: false,
    codecLabel: 'H.264 / AAC • 2,935 kbps',
  },
]

export function getStreamTechnicalProfile(streamUrl: string): StreamTechnicalProfile | null {
  const clean = String(streamUrl || '').trim()
  if (!clean) return null
  for (const profile of KNOWN_STREAM_PROFILES) {
    if (profile.routePattern.test(clean)) {
      return profile
    }
  }
  return null
}

export function resolveMovieStreamUrl(
  movie: Partial<Movie> & { id?: string | number; video_url?: string | null },
): string {
  const rawUrl = String(movie.videoUrl || movie.video_url || '').trim()
  const movieId = String(movie.id || '').trim()

  // Never serve Google gtv-videos-bucket or w3schools sample cartoons; map back to PMF Telegram Bridge
  if (/commondatastorage\.googleapis\.com\/gtv-videos-bucket|w3schools\.com/i.test(rawUrl)) {
    if (VERIFIED_TELEGRAM_BRIDGE_IDS.has(movieId)) {
      return `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/${movieId}`
    }
    return `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media`
  }

  // If movie has a generic /telegram-media URL but its ID is one of the dedicated mapped IDs (1, 3, 4, 5),
  // resolve to its specific /telegram-media/:movieId stream so each movie plays its own dedicated feature film.
  if (
    rawUrl === `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media` &&
    VERIFIED_TELEGRAM_BRIDGE_IDS.has(movieId)
  ) {
    return `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/${movieId}`
  }

  // Movie-specific bridge routes are keyed by the PMF-Flix movie ID,
  // never by Telegram's message ID. The bridge resolves the mapped post
  // from telegram_media_refs, which prevents one upload being served as another title.
  if (movie.telegramMessageId && movieId) {
    if (!rawUrl || /pmf-telegram-bridge\.onrender\.com\/telegram-media(?:\/[^/?]+)?(?:[?#].*)?$/i.test(rawUrl)) {
      return `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/${movieId}`
    }
  }

  if (rawUrl) {
    return rawUrl
  }

  if (VERIFIED_TELEGRAM_BRIDGE_IDS.has(movieId)) {
    return `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/${movieId}`
  }

  return ''
}

/**
 * Authoritative Baseline PMF-Flix Catalogue (Strictly the 5 owner-approved baseline titles with authentic local artwork).
 * No AI-generated demonstration shows or unapproved series (such as "Crown of Zamfara") are included.
 */
export const movies: Movie[] = [
  {
    id: '1',
    title: 'The Journey',
    year: 2026,
    category: 'Adventure',
    type: 'Movie',
    rating: '16+',
    duration: '2h 04m',
    description:
      'A cinematic journey through unexpected places, difficult choices, and unforgettable moments.',
    poster: journeyPoster,
    featured: true,
    videoUrl: `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/1`,
    trailerUrl: 'https://youtu.be/M6h5AS971hY?si=dqE8EzTprzoacOPr',
    videoType: 'mp4',
    downloadable: true,
    status: 'published',
  },
  {
    id: '2',
    title: 'Night City',
    year: 2026,
    category: 'Thriller',
    type: 'Movie',
    rating: '16+',
    duration: '1h 52m',
    description:
      'A mysterious story unfolding after dark in a city where nothing is quite what it seems.',
    poster: nightCityPoster,
    featured: true,
    videoUrl: `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media`,
    videoType: 'mp4',
    downloadable: true,
    status: 'published',
  },
  {
    id: '3',
    title: 'Final Horizon',
    year: 2025,
    category: 'Science Fiction',
    type: 'Movie',
    rating: '13+',
    duration: '2h 08m',
    description:
      'A group of explorers faces an uncertain future beyond the limits of their world.',
    poster: finalHorizonPoster,
    featured: true,
    videoUrl: `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/3`,
    videoType: 'mp4',
    downloadable: true,
    status: 'published',
  },
  {
    id: '4',
    title: 'Hidden World',
    year: 2025,
    category: 'Fantasy',
    type: 'Movie',
    rating: '13+',
    duration: '1h 58m',
    description:
      'An unexpected discovery reveals a world hidden from humanity for generations.',
    poster: hiddenWallPoster,
    featured: false,
    videoUrl: `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/4`,
    videoType: 'mp4',
    downloadable: true,
    isKids: true,
    status: 'published',
  },
  {
    id: '5',
    title: 'The Last Mission',
    year: 2024,
    category: 'Action',
    type: 'Movie',
    rating: '16+',
    duration: '2h 01m',
    description:
      'One final mission becomes a race against time when everything begins to go wrong.',
    poster: lastMissionPoster,
    featured: true,
    videoUrl: `${PMF_TELEGRAM_BRIDGE_BASE}/telegram-media/5`,
    videoType: 'mp4',
    downloadable: true,
    status: 'published',
  },
]

export interface CinemaTriviaItem {
  id: string
  question: string
  options: string[]
  answerIndex: number
  explanation: string
}

export const cinemaTrivia: CinemaTriviaItem[] = [
  {
    id: 'trivia-1',
    question:
      'Which Nigerian film industry is recognized as one of the largest movie producers in the world by volume?',
    options: ['Ghallywood', 'Nollywood', 'Wakaliwood', 'Joziwood'],
    answerIndex: 1,
    explanation:
      'Nollywood produces thousands of feature films and series annually, making Nigeria a global powerhouse of cinema storytelling.',
  },
  {
    id: 'trivia-2',
    question:
      'What HTTP status code enables instant byte-range seeking and partial video streaming on PMF-Flix?',
    options: [
      'HTTP 200 OK',
      'HTTP 206 Partial Content',
      'HTTP 302 Found',
      'HTTP 101 Switching Protocols',
    ],
    answerIndex: 1,
    explanation:
      'HTTP 206 Partial Content allows the video player to request specific byte ranges without downloading the entire movie upfront.',
  },
  {
    id: 'trivia-3',
    question:
      'Where should the MP4 "moov" metadata atom be placed for the fastest possible online video startup?',
    options: [
      'At the very beginning of the file (faststart)',
      'At the very end of the file',
      'In a separate external text file',
      'Inside the poster image',
    ],
    answerIndex: 0,
    explanation:
      'Placing the moov atom at the start of an MP4 file (using -movflags +faststart) lets the player read track indices on the first request.',
  },
]
