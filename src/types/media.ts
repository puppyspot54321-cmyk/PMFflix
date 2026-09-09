export type VideoQuality =
  | '480p'
  | '720p'
  | '1080p'
  | '1440p'
  | '4k'

export type StreamingProtocol =
  | 'mp4'
  | 'hls'
  | 'dash'

export interface VideoAsset {
  id: string
  quality: VideoQuality
  url: string
  protocol: StreamingProtocol
  bitrate?: number
  width?: number
  height?: number
  sizeBytes?: number
}

export interface SubtitleTrack {
  id: string
  languageId: string
  label: string
  url: string
  format: 'vtt' | 'srt'
  isDefault?: boolean
  isForced?: boolean
}

export interface AudioTrack {
  id: string
  languageId: string
  label: string
  url?: string
  isDefault?: boolean
  channels?: number
  }
