import type { ContentType } from './content'
import type {
  CastMember,
  Person,
} from './person'
import type {
  AudioTrack,
  SubtitleTrack,
  VideoAsset,
  VideoQuality,
} from './media'

export interface Movie {
  id: string

  title: string
  originalTitle?: string
  slug: string
  tagline?: string
  synopsis: string

  contentType: ContentType

  releaseDate?: string
  releaseYear?: number
  runtimeMinutes?: number

  // Legacy compatibility fields.
  // These allow the existing PMF Flix UI to continue working
  // while the universal metadata system is being integrated.
  duration?: string
  rating?: string | number

  genres: string[]
  subgenres: string[]
  tags: string[]

  countryIds: string[]
  regionIds: string[]
  industryIds: string[]

  languageIds: string[]
  originalLanguageId?: string

  cast: CastMember[]
  directors: Person[]
  writers: Person[]
  producers: Person[]

  posterUrl?: string
  backdropUrl?: string
  logoUrl?: string

  trailerUrl?: string
  videoUrl?: string

  videoAssets: VideoAsset[]

  subtitles: SubtitleTrack[]
  audioTracks: AudioTrack[]

  downloadAvailability?: {
    available: boolean
    url?: string
    qualities?: VideoQuality[]
  }

  ratingCount?: number

  ageRating?: string
  videoQualities: VideoQuality[]

  collectionIds: string[]

  isFeatured: boolean
  isTrending: boolean
  isNewRelease: boolean
  isComingSoon: boolean
  isPmfOriginal: boolean
  isPremium: boolean

  viewCount: number

  createdAt: string
  updatedAt: string
}
