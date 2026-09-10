import {
  ChevronDown,
  Lock,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type {
  SubtitleTrack,
  VideoAsset,
  VideoQuality,
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

const QUALITY_ORDER: VideoQuality[] = [
  '480p',
  '720p',
  '1080p',
  '1440p',
  '4k',
]

function getQualityLabel(
  quality: VideoQuality,
): string {
  if (quality === '4k') {
    return '4K'
  }

  return quality
}

function getSourceType(
  asset?: VideoAsset,
): string {
  if (!asset) {
    return 'video/mp4'
  }

  if (asset.protocol === 'hls') {
    return 'application/vnd.apple.mpegurl'
  }

  if (asset.protocol === 'dash') {
    return 'application/dash+xml'
  }

  return 'video/mp4'
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

  const hideControlsTimer =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    )

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

  const [showControls, setShowControls] =
    useState(true)

  const [selectedQuality, setSelectedQuality] =
    useState<VideoQuality | 'auto'>('auto')

  const [selectedSubtitle, setSelectedSubtitle] =
    useState<string>('off')

  const [showSettings, setShowSettings] =
    useState(false)

  const [isPictureInPicture, setIsPictureInPicture] =
    useState(false)

  const [isOrientationLocked, setIsOrientationLocked] =
    useState(false)

  const availableQualities = useMemo(() => {
    const qualities = new Set<VideoQuality>()

    videoAssets.forEach((asset) => {
      qualities.add(asset.quality)
    })

    return QUALITY_ORDER.filter((quality) =>
      qualities.has(quality),
    )
  }, [videoAssets])

  const activeAsset = useMemo(() => {
    if (
      selectedQuality !== 'auto' &&
      videoAssets.length > 0
    ) {
      return (
        videoAssets.find(
          (asset) =>
            asset.quality === selectedQuality,
        ) ?? videoAssets[0]
      )
    }

    return (
      [...videoAssets].sort(
        (a, b) =>
          QUALITY_ORDER.indexOf(b.quality) -
          QUALITY_ORDER.indexOf(a.quality),
      )[0] ?? undefined
    )
  }, [
    selectedQuality,
    videoAssets,
  ])

  const sourceUrl =
    activeAsset?.url || videoUrl

  const sourceType =
    getSourceType(activeAsset)

  const resetControlsTimer = () => {
    if (hideControlsTimer.current) {
      clearTimeout(
        hideControlsTimer.current,
      )
    }

    setShowControls(true)

    if (isPlaying && !isLocked) {
      hideControlsTimer.current =
        setTimeout(() => {
          setShowControls(false)
          setShowSettings(false)
        }, 3500)
    }
  }

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(
          hideControlsTimer.current,
        )
      }
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    const handleLoadedMetadata = () => {
      const nextDuration =
        video.duration

      if (Number.isFinite(nextDuration)) {
        setDuration(nextDuration)
      }

      if (
        initialTime > 0 &&
        Number.isFinite(video.duration)
      ) {
        video.currentTime =
          Math.min(
            initialTime,
            video.duration,
          )

        setCurrentTime(
          video.currentTime,
        )
      }
    }

    const handleTimeUpdate = () => {
      const nextTime =
        video.currentTime

      setCurrentTime(nextTime)

      onTimeUpdate?.(nextTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      resetControlsTimer()
    }

    const handlePause = () => {
      setIsPlaying(false)
      setShowControls(true)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setShowControls(true)
      onEnded?.()
    }

    const handleVolumeChange = () => {
      setVolume(video.volume)
      setIsMuted(video.muted)
    }

    const handleEnterPictureInPicture =
      () => {
        setIsPictureInPicture(true)
      }

    const handleLeavePictureInPicture =
      () => {
        setIsPictureInPicture(false)
      }

    video.addEventListener(
      'loadedmetadata',
      handleLoadedMetadata,
    )

    video.addEventListener(
      'timeupdate',
      handleTimeUpdate,
    )

    video.addEventListener(
      'play',
      handlePlay,
    )

    video.addEventListener(
      'pause',
      handlePause,
    )

    video.addEventListener(
      'ended',
      handleEnded,
    )

    video.addEventListener(
      'volumechange',
      handleVolumeChange,
    )

    video.addEventListener(
      'enterpictureinpicture',
      handleEnterPictureInPicture,
    )

    video.addEventListener(
      'leavepictureinpicture',
      handleLeavePictureInPicture,
    )

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

      video.removeEventListener(
        'volumechange',
        handleVolumeChange,
      )

      video.removeEventListener(
        'enterpictureinpicture',
        handleEnterPictureInPicture,
      )

      video.removeEventListener(
        'leavepictureinpicture',
        handleLeavePictureInPicture,
      )
    }
  }, [
    initialTime,
    onEnded,
    onTimeUpdate,
  ])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreen =
        document.fullscreenElement !== null

      setIsFullscreen(fullscreen)

      if (!fullscreen) {
        setIsOrientationLocked(false)
      }
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
    const video = videoRef.current

    if (!video || !autoPlay) {
      return
    }

    void video.play().catch(() => {
      setIsPlaying(false)
    })
  }, [
    autoPlay,
    sourceUrl,
  ])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (
      sourceUrl &&
      Number.isFinite(video.currentTime)
    ) {
      setCurrentTime(
        video.currentTime,
      )
    }
  }, [sourceUrl])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    const tracks =
      video.textTracks

    for (
      let index = 0;
      index < tracks.length;
      index += 1
    ) {
      const track = tracks[index]

      if (!track) {
        continue
      }

      track.mode =
        selectedSubtitle === 'off'
          ? 'disabled'
          : track.label ===
              selectedSubtitle
            ? 'showing'
            : 'disabled'
    }
  }, [
    selectedSubtitle,
    subtitles,
    sourceUrl,
  ])

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

    resetControlsTimer()
  }

  const toggleMute = () => {
    const video = videoRef.current

    if (!video || isLocked) {
      return
    }

    video.muted = !video.muted

    setIsMuted(video.muted)

    resetControlsTimer()
  }

  const changeVolume = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const video = videoRef.current

    if (!video || isLocked) {
      return
    }

    const nextVolume =
      Number(event.target.value)

    video.volume = nextVolume
    video.muted =
      nextVolume === 0

    setVolume(nextVolume)
    setIsMuted(video.muted)

    resetControlsTimer()
  }

  const seek = (
    seconds: number,
  ) => {
    const video = videoRef.current

    if (!video || isLocked) {
      return
    }

    const nextTime =
      Math.max(
        0,
        Math.min(
          video.duration || 0,
          video.currentTime +
            seconds,
        ),
      )

    video.currentTime =
      nextTime

    setCurrentTime(
      nextTime,
    )

    resetControlsTimer()
  }

  const changeProgress = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const video = videoRef.current

    if (!video || isLocked) {
      return
    }

    const nextTime =
      Number(event.target.value)

    video.currentTime =
      nextTime

    setCurrentTime(
      nextTime,
    )

    resetControlsTimer()
  }

  const toggleFullscreen =
    async () => {
      if (isLocked) {
        return
      }

      const container =
        containerRef.current

      if (!container) {
        return
      }

      try {
        if (
          !document.fullscreenElement
        ) {
          await container.requestFullscreen()

          if (
            'orientation' in screen &&
            typeof screen.orientation
              .lock === 'function'
          ) {
            try {
              await screen.orientation.lock(
                'landscape',
              )

              setIsOrientationLocked(
                true,
              )
            } catch {
              setIsOrientationLocked(
                false,
              )
            }
          }
        } else {
          await document.exitFullscreen()
        }
      } catch (error) {
        console.error(
          'PMF fullscreen error:',
          error,
        )
      }

      resetControlsTimer()
    }

  const toggleLock = () => {
    setIsLocked(
      (previous) => {
        const nextLocked =
          !previous

        setShowControls(true)

        if (nextLocked) {
          setShowSettings(false)
        }

        return nextLocked
      },
    )
  }

  const togglePictureInPicture =
    async () => {
      const video =
        videoRef.current

      if (!video || isLocked) {
        return
      }

      try {
        if (
          document.pictureInPictureElement
        ) {
          await document.exitPictureInPicture()
          return
        }

        if (
          document.pictureInPictureEnabled &&
          !video.disablePictureInPicture
        ) {
          await video.requestPictureInPicture()
        }
      } catch (error) {
        console.error(
          'PMF Picture-in-Picture error:',
          error,
        )
      }

      resetControlsTimer()
    }

  const changeQuality = async (
    quality:
      | VideoQuality
      | 'auto',
  ) => {
    if (isLocked) {
      return
    }

    if (
      quality ===
      selectedQuality
    ) {
      setShowSettings(false)
      return
    }

    const video =
      videoRef.current

    if (!video) {
      return
    }

    const wasPlaying =
      !video.paused

    const playbackTime =
      video.currentTime

    setSelectedQuality(
      quality,
    )

    setShowSettings(false)

    window.setTimeout(
      () => {
        const nextVideo =
          videoRef.current

        if (!nextVideo) {
          return
        }

        const restorePlayback =
          () => {
            if (
              Number.isFinite(
                nextVideo.duration,
              )
            ) {
              nextVideo.currentTime =
                Math.min(
                  playbackTime,
                  nextVideo.duration,
                )
            } else {
              nextVideo.currentTime =
                playbackTime
            }

            setCurrentTime(
              nextVideo.currentTime,
            )

            if (wasPlaying) {
              void nextVideo
                .play()
                .catch(() => {
                  setIsPlaying(
                    false,
                  )
                })
            }
          }

        if (
          nextVideo.readyState >= 1
        ) {
          restorePlayback()
        } else {
          nextVideo.addEventListener(
            'loadedmetadata',
            restorePlayback,
            { once: true },
          )
        }
      },
      100,
    )
  }

  const selectSubtitle = (
    label: string,
  ) => {
    if (isLocked) {
      return
    }

    setSelectedSubtitle(
      label,
    )

    setShowSettings(false)
  }

  const formatTime = (
    time: number,
  ) => {
    if (
      !Number.isFinite(time)
    ) {
      return '00:00'
    }

    const totalSeconds =
      Math.max(
        0,
        Math.floor(time),
      )

    const hours =
      Math.floor(
        totalSeconds / 3600,
      )

    const minutes =
      Math.floor(
        (totalSeconds % 3600) /
          60,
      )

    const seconds =
      totalSeconds % 60

    if (hours > 0) {
      return `${hours
        .toString()
        .padStart(
          2,
          '0',
        )}:${minutes
        .toString()
        .padStart(
          2,
          '0',
        )}:${seconds
        .toString()
        .padStart(
          2,
          '0',
        )}`
    }

    return `${minutes
      .toString()
      .padStart(
        2,
        '0',
      )}:${seconds
      .toString()
      .padStart(
        2,
        '0')}`
  }

  if (!sourceUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-black px-6 text-center text-sm text-white/50">
        No licensed video source is available.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-2xl bg-black shadow-2xl ${
        isFullscreen
          ? 'h-full w-full rounded-none'
          : ''
      }`}
      onMouseMove={
        resetControlsTimer
      }
      onTouchStart={
        resetControlsTimer
      }
      onClick={() => {
        if (!isLocked) {
          resetControlsTimer()
        }
      }}
    >
      <video
        ref={videoRef}
        key={sourceUrl}
        className={`aspect-video w-full bg-black object-contain ${
          isFullscreen
            ? 'h-full'
            : ''
        }`}
        poster={posterUrl}
        playsInline
        preload="metadata"
        title={title}
        onClick={(event) => {
          event.stopPropagation()
          togglePlay()
        }}
      >
        <source
          src={sourceUrl}
          type={sourceType}
        />

        {subtitles
          .filter(
            (track) =>
              track.format ===
              'vtt',
          )
          .map((track) => (
            <track
              key={track.id}
              kind="subtitles"
              src={track.url}
              srcLang={
                track.languageId
              }
              label={track.label}
              default={
                track.isDefault
              }
            />
          ))}
      </video>

      {isLocked ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            toggleLock()
          }}
          className="absolute right-4 top-4 flex items-center gap-2 rounded-xl bg-black/75 px-4 py-3 text-xs font-bold text-white shadow-lg backdrop-blur-md"
          aria-label="Unlock player controls"
        >
          <Unlock size={16} />
          Unlock
        </button>
      ) : (
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-3 pt-16 transition-opacity duration-300 sm:px-5 sm:pb-5 ${
            showControls
              ? 'opacity-100'
              : 'pointer-events-none opacity-0'
          }`}
        >
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(
              currentTime,
              duration || 0,
            )}
            onChange={
              changeProgress
            }
            className="mb-3 h-1.5 w-full cursor-pointer accent-red-600"
            aria-label="Video progress"
          />

          <div className="flex items-center gap-1.5 text-white sm:gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={
                isPlaying
                  ? 'Pause'
                  : 'Play'
              }
              className="rounded-full p-2 transition hover:bg-white/10 active:scale-95"
            >
              {isPlaying ? (
                <Pause size={20} />
              ) : (
                <Play size={20} />
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                seek(-10)
              }
              aria-label="Rewind 10 seconds"
              className="rounded-full p-2 transition hover:bg-white/10 active:scale-95"
            >
              <RotateCcw
                size={18}
              />
            </button>

            <button
              type="button"
              onClick={() =>
                seek(10)
              }
              aria-label="Forward 10 seconds"
              className="rounded-full p-2 transition hover:bg-white/10 active:scale-95"
            >
              <RotateCw
                size={18}
              />
            </button>

            <button
              type="button"
              onClick={
                toggleMute
              }
              aria-label={
                isMuted
                  ? 'Unmute'
                  : 'Mute'
              }
              className="rounded-full p-2 transition hover:bg-white/10 active:scale-95"
            >
              {isMuted ? (
                <VolumeX
                  size={20}
                />
              ) : (
                <Volume2
                  size={20}
                />
              )}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={
                isMuted
                  ? 0
                  : volume
              }
              onChange={
                changeVolume
              }
              aria-label="Volume"
              className="hidden w-20 cursor-pointer accent-red-600 sm:block"
            />

            <span className="ml-1 whitespace-nowrap text-[11px] font-medium text-white/70 sm:text-xs">
              {formatTime(
                currentTime,
              )}{' '}
              /{' '}
              {formatTime(
                duration,
              )}
            </span>

            <div className="ml-auto flex items-center gap-1">
              {availableQualities.length >
                0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setShowSettings(
                        (previous) =>
                          !previous,
                      )
                    }
                                        aria-label="Player settings"
                    className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold transition hover:bg-white/10"
                  >
                    <Settings size={18} />

                    <span className="hidden sm:inline">
                      {selectedQuality === 'auto'
                        ? 'Auto'
                        : getQualityLabel(
                            selectedQuality,
                          )}
                    </span>

                    <ChevronDown
                      size={14}
                      className="hidden sm:block"
                    />
                  </button>

                  {showSettings && (
                    <div className="absolute bottom-12 right-0 z-30 w-56 overflow-hidden rounded-xl border border-white/10 bg-black/95 p-2 shadow-2xl backdrop-blur-xl">
                      <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                        Video quality
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void changeQuality('auto')
                        }
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                          selectedQuality === 'auto'
                            ? 'bg-white/10 text-white'
                            : 'text-white/70 hover:bg-white/5'
                        }`}
                      >
                        <span>Auto</span>

                        {selectedQuality === 'auto' && (
                          <span className="text-red-500">
                            ✓
                          </span>
                        )}
                      </button>

                      {availableQualities.map(
                        (quality) => (
                          <button
                            key={quality}
                            type="button"
                            onClick={() =>
                              void changeQuality(
                                quality,
                              )
                            }
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                              selectedQuality ===
                              quality
                                ? 'bg-white/10 text-white'
                                : 'text-white/70 hover:bg-white/5'
                            }`}
                          >
                            <span>
                              {getQualityLabel(
                                quality,
                              )}
                            </span>

                            {selectedQuality ===
                              quality && (
                              <span className="text-red-500">
                                ✓
                              </span>
                            )}
                          </button>
                        ),
                      )}

                      {subtitles.length > 0 && (
                        <>
                          <div className="my-2 border-t border-white/10" />

                          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                            Subtitles
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              selectSubtitle('off')
                            }
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                              selectedSubtitle === 'off'
                                ? 'bg-white/10 text-white'
                                : 'text-white/70 hover:bg-white/5'
                            }`}
                          >
                            <span>Off</span>

                            {selectedSubtitle ===
                              'off' && (
                              <span className="text-red-500">
                                ✓
                              </span>
                            )}
                          </button>

                          {subtitles
                            .filter(
                              (track) =>
                                track.format === 'vtt',
                            )
                            .map((track) => (
                              <button
                                key={track.id}
                                type="button"
                                onClick={() =>
                                  selectSubtitle(
                                    track.label,
                                  )
                                }
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                                  selectedSubtitle ===
                                  track.label
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/70 hover:bg-white/5'
                                }`}
                              >
                                <span>
                                  {track.label}
                                </span>

                                {selectedSubtitle ===
                                  track.label && (
                                  <span className="text-red-500">
                                    ✓
                                  </span>
                                )}
                              </button>
                            ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {typeof document !== 'undefined' &&
                'pictureInPictureEnabled' in document && (
                  <button
                    type="button"
                    onClick={() =>
                      void togglePictureInPicture()
                    }
                    aria-label={
                      isPictureInPicture
                        ? 'Exit Picture-in-Picture'
                        : 'Picture-in-Picture'
                    }
                    className="hidden rounded-full p-2 transition hover:bg-white/10 active:scale-95 sm:block"
                  >
                    <PictureInPicture size={19} />
                  </button>
                )}

              <button
                type="button"
                onClick={toggleLock}
                aria-label="Lock player controls"
                className="rounded-full p-2 transition hover:bg-white/10 active:scale-95"
              >
                {isLocked ? (
                  <Unlock size={18} />
                ) : (
                  <Lock size={18} />
                )}
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
                className="rounded-full p-2 transition hover:bg-white/10 active:scale-95"
              >
                {isFullscreen ? (
                  <Minimize size={20} />
                ) : (
                  <Maximize size={20} />
                )}
              </button>
            </div>
          </div>

          {isOrientationLocked && (
            <div className="mt-2 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">
              Landscape mode
            </div>
          )}
        </div>
      )}

      {!isPlaying &&
        showControls &&
        !isLocked && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play video"
            className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-2xl backdrop-blur-md transition hover:scale-105 hover:bg-black/80"
          >
            <Play
              size={28}
              fill="currentColor"
              className="ml-1"
            />
          </button>
        )}

      <div className="pointer-events-none absolute left-4 top-4 max-w-[70%]">
        <p
          className={`text-xs font-black uppercase tracking-[0.2em] text-white/80 transition-opacity duration-300 ${
            showControls
              ? 'opacity-100'
              : 'opacity-0'
          }`}
        >
          {title}
        </p>
      </div>
    </div>
  )
}

export default VideoPlayer
