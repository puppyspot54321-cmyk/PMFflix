import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  SubtitleTrack,
  VideoAsset,
} from '../types/media'

interface VideoPlayerProps {
  videoUrl?: string
  videoAssets?: VideoAsset[]
  subtitles?: SubtitleTrack[]
  posterUrl?: string
  title?: string
  autoPlay?: boolean
  initialTime?: number
  onTimeUpdate?: (currentTime: number) => void
  onEnded?: () => void
}

function VideoPlayer({
  videoUrl,
  videoAssets = [],
  subtitles = [],
  posterUrl,
  title = 'PMF Flix',
  autoPlay = false,
  initialTime = 0,
  onTimeUpdate,
  onEnded,
}: VideoPlayerProps) {
  const videoRef =
    useRef<HTMLVideoElement | null>(null)
  const containerRef =
    useRef<HTMLDivElement | null>(null)

  const [isPlaying, setIsPlaying] =
    useState(false)
  const [isMuted, setIsMuted] =
    useState(false)
  const [volume, setVolume] =
    useState(1)
  const [currentTime, setCurrentTime] =
    useState(initialTime)
  const [duration, setDuration] =
    useState(0)
  const [isFullscreen, setIsFullscreen] =
    useState(false)
  const [isLocked, setIsLocked] =
    useState(false)

  const activeAsset =
    videoAssets.length > 0
      ? videoAssets[0]
      : undefined

  const sourceUrl =
    activeAsset?.url || videoUrl

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    video.currentTime = initialTime
  }, [initialTime])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)

      if (initialTime > 0) {
        video.currentTime = Math.min(
          initialTime,
          video.duration,
        )
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      onTimeUpdate?.(video.currentTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      onEnded?.()
    }

    video.addEventListener(
      'loadedmetadata',
      handleLoadedMetadata,
    )

    video.addEventListener(
      'timeupdate',
      handleTimeUpdate,
    )

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener(
        'loadedmetadata',
        handleLoadedMetadata,
      )

      video.removeEventListener(
        'timeupdate',
        handleTimeUpdate,
      )

      video.removeEventListener(
        'play',
        handlePlay,
      )

      video.removeEventListener(
        'pause',
        handlePause,
      )

      video.removeEventListener(
        'ended',
        handleEnded,
      )
    }
  }, [
    initialTime,
    onEnded,
    onTimeUpdate,
  ])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement !== null,
      )
    }

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange,
    )

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange,
      )
    }
  }, [])

  useEffect(() => {
    if (!autoPlay) {
      return
    }

    const video = videoRef.current

    if (!video) {
      return
    }

    void video.play().catch(() => {
      setIsPlaying(false)
    })
  }, [autoPlay, sourceUrl])

  const togglePlay = () => {
    const video = videoRef.current

    if (!video || isLocked) {
      return
    }

    if (video.paused) {
      void video.play()
    } else {
      video.pause()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current

    if (!video || isLocked) {
      return
    }

    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const changeVolume = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const video = videoRef.current

    if (!video || isLocked) {
      return
    }

    const nextVolume = Number(event.target.value)

    video.volume = nextVolume
    video.muted = nextVolume === 0

    setVolume(nextVolume)
    setIsMuted(video.muted)
  }

  const seek = (seconds: number) => {
    const video = videoRef.current

    if (!video || isLocked) {
      return
    }

    video.currentTime = Math.max(
      0,
      Math.min(
        video.duration || 0,
        video.currentTime + seconds,
      ),
    )
  }

  const changeProgress = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const video = videoRef.current

    if (!video || isLocked) {
      return
    }

    video.currentTime = Number(event.target.value)
  }

  const toggleFullscreen = async () => {
    if (isLocked) {
      return
    }

    const container = containerRef.current

    if (!container) {
      return
    }

    if (!document.fullscreenElement) {
      await container.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  const toggleLock = () => {
    setIsLocked((previous) => !previous)
  }

  const formatTime = (time: number) => {
    if (!Number.isFinite(time)) {
      return '00:00'
    }

    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)

    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
  }

  if (!sourceUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-black text-sm text-white/50">
        No licensed video source is available.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="group relative overflow-hidden rounded-2xl bg-black"
    >
      <video
        ref={videoRef}
        className="aspect-video w-full bg-black object-contain"
        poster={posterUrl}
        playsInline
        preload="metadata"
        title={title}
        onClick={togglePlay}
      >
        <source
          src={sourceUrl}
          type={
            activeAsset?.protocol === 'hls'
              ? 'application/vnd.apple.mpegurl'
              : activeAsset?.protocol === 'dash'
                ? 'application/dash+xml'
                : 'video/mp4'
          }
        />

        {subtitles
          .filter(
            (track) => track.format === 'vtt',
          )
          .map((track) => (
            <track
              key={track.id}
              kind="subtitles"
              src={track.url}
              srcLang={track.languageId}
              label={track.label}
              default={track.isDefault}
            />
          ))}
      </video>

      {!isLocked && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={currentTime}
            onChange={changeProgress}
            className="mb-3 w-full"
            aria-label="Video progress"
          />

          <div className="flex items-center gap-2 text-white">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={
                isPlaying ? 'Pause' : 'Play'
              }
              className="rounded-full p-2 hover:bg-white/10"
            >
              {isPlaying ? (
                <Pause size={20} />
              ) : (
                <Play size={20} />
              )}
            </button>

            <button
              type="button"
              onClick={() => seek(-10)}
              aria-label="Rewind 10 seconds"
              className="rounded-full p-2 hover:bg-white/10"
            >
              <RotateCcw size={18} />
            </button>

            <button
              type="button"
              onClick={() => seek(10)}
              aria-label="Forward 10 seconds"
              className="rounded-full p-2 hover:bg-white/10"
            >
              <RotateCw size={18} />
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={
                isMuted
                  ? 'Unmute'
                  : 'Mute'
              }
              className="rounded-full p-2 hover:bg-white/10"
            >
              {isMuted ? (
                <VolumeX size={20} />
              ) : (
                <Volume2 size={20} />
              )}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={changeVolume}
              aria-label="Volume"
              className="w-20"
            />

            <span className="ml-2 text-xs text-white/70">
              {formatTime(currentTime)} /{' '}
              {formatTime(duration)}
            </span>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLock}
                className="rounded-lg px-3 py-2 text-xs font-bold hover:bg-white/10"
              >
                Lock
              </button>

              <button
                type="button"
                onClick={() => {
                  void toggleFullscreen()
                }}
                aria-label={
                  isFullscreen
                    ? 'Exit fullscreen'
                    : 'Enter fullscreen'
                }
                className="rounded-full p-2 hover:bg-white/10"
              >
                {isFullscreen ? (
                  <Minimize size={20} />
                ) : (
                  <Maximize size={20} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLocked && (
        <button
          type="button"
          onClick={toggleLock}
          className="absolute right-4 top-4 rounded-lg bg-black/70 px-3 py-2 text-xs font-bold text-white backdrop-blur"
        >
          Unlock
        </button>
      )}
    </div>
  )
}

export default VideoPlayer
