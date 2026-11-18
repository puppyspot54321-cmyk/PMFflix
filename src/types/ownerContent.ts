export type ContentStatus = 'draft' | 'published' | 'archived'

export type ShortContentCategory = 'comedy' | 'news' | 'creator' | 'skit'

export interface PMFShortContent {
  id: string
  title: string
  description: string
  category: ShortContentCategory
  creator_name: string
  duration: string // e.g. "2m 45s"
  thumbnail_url: string
  video_url: string
  video_type?: 'mp4' | 'youtube' | 'hls'
  status: ContentStatus
  featured: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface PMFNovelChapter {
  id: string
  novel_id: string
  chapter_number: number
  title: string
  content: string // manuscript text/markdown
  word_count?: number
  status: ContentStatus
  created_at: string
  updated_at: string
}

export interface PMFNovel {
  id: string
  title: string
  author: string
  description: string
  cover_url: string
  genre: string
  language: string
  publication_year?: number
  rights_notes?: string // administrative rights / licensing notes
  status: ContentStatus
  featured: boolean
  display_order: number
  created_at: string
  updated_at: string
  chapters?: PMFNovelChapter[]
}

export type SportsEventStatus = 'upcoming' | 'live' | 'completed' | 'cancelled'

export interface PMFSportsEvent {
  id: string
  title: string
  sport: string // 'Football' | 'Basketball' | 'Boxing / MMA' | 'Motorsport' | 'Athletics' | 'Tennis' | 'Other'
  team_a: string
  team_b: string
  competition: string // e.g. "CAF Champions League", "NPFL", "Premier League"
  description: string
  thumbnail_url: string
  scheduled_start: string // ISO timestamp e.g. "2026-10-20T17:00:00Z"
  timezone: string // e.g. "WAT (GMT+1)"
  event_status: SportsEventStatus
  broadcast_source_url?: string // real playback URL (HLS / m3u8 / MP4 / embed)
  broadcast_source_type?: 'hls' | 'mp4' | 'embed' | 'none'
  status: ContentStatus
  featured: boolean
  score?: string // e.g. "2 - 1" or "Round 3"
  created_at: string
  updated_at: string
}
