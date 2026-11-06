import { useState, useEffect, useRef, useCallback } from 'react'
import Hls from 'hls.js'
import { Capacitor, registerPlugin } from '@capacitor/core'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  SkipForward,
  RotateCcw,
  RotateCw,
  Gauge,
  Tv,
  Sparkles,
  Check,
  Subtitles,
  Headphones,
  Lock,
  Unlock,
  Scaling,
  PictureInPicture2,
  SunMedium,
  AlertTriangle,
  RefreshCw,
  Wifi,
} from 'lucide-react'
import {
  resolveMovieStreamUrl,
  getStreamTechnicalProfile,
  type Movie,
  type SubtitleTrackMeta,
} from '../movieData/movies'

interface VideoPlayerProps {
  movie: Movie
  initialTime?: number
  initialTheaterMode?: boolean
  onClose: () => void
  onProgressSave: (currentTime: number, duration: number) => void
  onNext?: () => void
  nextMovieTitle?: string
}

type StreamStage = 'resolving' | 'connecting' | 'buffering' | 'ready' | 'retrying' | 'error'
type NetworkQualityProfile = 'fast' | 'moderate' | 'weak'

interface PMFScreenOrientationPlugin {
  lockLandscape(): Promise<void>
  unlock(): Promise<void>
  enterImmersive(): Promise<void>
  exitImmersive(): Promise<void>
}

const PMFScreenOrientation = registerPlugin<PMFScreenOrientationPlugin>('PMFScreenOrientation')

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]
const VIDEO_FIT_MODES = [
  { id: 'contain', label: 'Standard Fit' },
  { id: 'cover', label: 'Cinema Crop (Fill)' },
  { id: 'fill', label: 'Ultra Widescreen' },
] as const

type VideoFitMode = (typeof VIDEO_FIT_MODES)[number]['id']

interface DetectedAudioTrack {
  id: string
  label: string
  language: string
  enabled: boolean
}

interface HlsQualityLevel {
  index: number
  height: number
  bitrateKbps: number
  label: string
}

interface StreamDiagnosticsState {
  bufferedAheadSec: number
  targetBufferSec: number
  requiredCushionSec: number
  bufferingCount: number
  lastStallDurationMs: number
  totalBufferingMs: number
  recoveryCount: number
  networkProfile: NetworkQualityProfile
  estimatedThroughputKbps: number
  streamBitrateKbps: number
}

function getYoutubeEmbed(url: string): string {
  const clean = url.trim()
  if (!clean) return ''
  if (clean.includes('youtube.com/embed/')) return clean
  const shortMatch = clean.match(/youtu\.be\/([^?&/]+)/i)
  if (shortMatch?.[1]) {
    return `https://www.youtube.com/embed/${shortMatch[1]}?autoplay=1&rel=0&modestbranding=1`
  }
  const watchMatch = clean.match(/[?&]v=([^?&/]+)/i)
  if (watchMatch?.[1]) {
    return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&rel=0&modestbranding=1`
  }
  return clean
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.floor(seconds)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

/**
 * Computes the contiguous buffered seconds ahead of currentTime, plus highest buffered end.
 */
function getContiguousBufferMetrics(video: HTMLVideoElement): {
  bufferedEnd: number
  bufferedAhead: number
} {
  const ct = video.currentTime || 0
  const ranges = video.buffered
  if (!ranges || ranges.length === 0) {
    return { bufferedEnd: 0, bufferedAhead: 0 }
  }

  let matchingEnd = ct
  for (let i = 0; i < ranges.length; i++) {
    const start = ranges.start(i)
    const end = ranges.end(i)
    // Allow 1.5s tolerance around playhead for keyframe alignment
    if (ct >= start - 1.5 && ct <= end + 0.5) {
      matchingEnd = Math.max(matchingEnd, end)
    }
  }

  const bufferedAhead = Math.max(0, matchingEnd - ct)
  const highestEnd = ranges.end(ranges.length - 1)
  return {
    bufferedEnd: Math.max(matchingEnd, highestEnd),
    bufferedAhead,
  }
}

/**
 * Reads browser Network Information API hint when supported on Android WebView / Chrome.
 */
function detectBrowserNetworkHint(): {
  profile: NetworkQualityProfile
  downlinkKbps: number
} {
  try {
    const navAny = navigator as unknown as {
      connection?: {
        effectiveType?: string
        downlink?: number
        saveData?: boolean
      }
    }
    const conn = navAny?.connection
    if (!conn) {
      return { profile: 'moderate', downlinkKbps: 2800 }
    }
    const downlinkKbps = typeof conn.downlink === 'number' && conn.downlink > 0 ? Math.round(conn.downlink * 1000) : 2800
    if (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || downlinkKbps < 1100) {
      return { profile: 'weak', downlinkKbps }
    }
    if (conn.effectiveType === '3g' || downlinkKbps < 3200) {
      return { profile: 'moderate', downlinkKbps }
    }
    return { profile: 'fast', downlinkKbps }
  } catch {
    return { profile: 'moderate', downlinkKbps: 2800 }
  }
}

export default function VideoPlayer({
  movie,
  initialTime = 0,
  initialTheaterMode = false,
  onClose,
  onProgressSave,
  onNext,
  nextMovieTitle,
}: VideoPlayerProps) {
  const resolvedStreamUrl = resolveMovieStreamUrl(movie)
  const technicalProfile = getStreamTechnicalProfile(resolvedStreamUrl)
  const streamBitrateKbps = technicalProfile?.bitrateKbps || 900

  const isYoutube =
    movie.videoType === 'youtube' || /youtube\.com|youtu\.be/i.test(resolvedStreamUrl)
  const isLocalOfflineStream =
    resolvedStreamUrl.startsWith('blob:') ||
    resolvedStreamUrl.startsWith('capacitor://') ||
    resolvedStreamUrl.startsWith('http://localhost/_capacitor_file_') ||
    resolvedStreamUrl.startsWith('https://localhost/_capacitor_file_')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const controlsTimeoutRef = useRef<number | null>(null)

  // Stable refs so periodic progress saves NEVER trigger stream re-initialization or video.load()
  const initialTimeRef = useRef<number>(initialTime)
  const onProgressSaveRef = useRef(onProgressSave)
  onProgressSaveRef.current = onProgressSave

  const lastSavedTimeRef = useRef<number>(initialTime)
  const retryCountRef = useRef<number>(0)
  // Separate startup recovery from the HLS/stall retry counter so a slow bridge
  // cannot exhaust all recovery attempts before the first frame is received.
  const startupFailureRetryRef = useRef<number>(0)
  const startupTimerRef = useRef<number | null>(null)
  const backoffTimerRef = useRef<number | null>(null)
  const spinnerDebounceRef = useRef<number | null>(null)
  const hasRestoredInitialTimeRef = useRef<boolean>(false)

  // Smart Buffer Hysteresis & Cushion Refs
  const userIntendedPlayRef = useRef<boolean>(true)
  const isHoldingForCushionRef = useRef<boolean>(false)
  const stallStartedAtRef = useRef<number | null>(null)
  const lastBufferAdvanceAtRef = useRef<number>(0)
  const lastBufferedEndRef = useRef<number>(0)
  const bufferSampleRef = useRef<{ timeMs: number; bufferedEnd: number }>({
    timeMs: 0,
    bufferedEnd: 0,
  })
  const diagStatsRef = useRef<{
    bufferingCount: number
    totalBufferingMs: number
    lastStallDurationMs: number
    recoveryCount: number
    measuredThroughputKbps: number
  }>({
    bufferingCount: 0,
    totalBufferingMs: 0,
    lastStallDurationMs: 0,
    recoveryCount: 0,
    measuredThroughputKbps: detectBrowserNetworkHint().downlinkKbps,
  })

  // Isolated Player State (Never triggers parent App re-renders)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(initialTime)
  const [duration, setDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [volume, setVolume] = useState(1)
  const [soundBoost, setSoundBoost] = useState(1)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const audioGainRef = useRef<GainNode | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Tracks fullscreen requested through the native Android Activity (DOM fullscreen is not reliable in WebView).
  const nativeFullscreenRequestedRef = useRef(false)
  const [theaterMode, setTheaterMode] = useState(initialTheaterMode)
  const [showControls, setShowControls] = useState(true)
  const [showBufferingOverlay, setShowBufferingOverlay] = useState(true)
  // Start with automatic smooth buffering enabled; users can still turn it off manually.
  // The adaptive target remains network-aware, so this does not force the same buffer on every connection.
  const [weakNetworkSmoothMode, setWeakNetworkSmoothMode] = useState<boolean>(true)

  // HLS Adaptive Quality State (populated when multi-rendition HLS stream is active)
  const [hlsLevels, setHlsLevels] = useState<HlsQualityLevel[]>([])
  const [activeHlsLevel, setActiveHlsLevel] = useState<number>(-1) // -1 = Auto ABR

  // Live Buffer & Network Diagnostics State
  const [diagnostics, setDiagnostics] = useState<StreamDiagnosticsState>(() => {
    const netHint = detectBrowserNetworkHint()
    const initialTarget = isLocalOfflineStream
      ? 300
      : netHint.profile === 'fast'
        ? 180
        : netHint.profile === 'weak'
          ? 60
          : 120
    return {
      bufferedAheadSec: 0,
      targetBufferSec: initialTarget,
      requiredCushionSec: netHint.profile === 'weak' ? 12 : 6,
      bufferingCount: 0,
      lastStallDurationMs: 0,
      totalBufferingMs: 0,
      recoveryCount: 0,
      networkProfile: netHint.profile,
      estimatedThroughputKbps: netHint.downlinkKbps,
      streamBitrateKbps,
    }
  })

  // Stream Lifecycle & Error State
  const [streamStage, setStreamStage] = useState<StreamStage>(() =>
    resolvedStreamUrl ? 'connecting' : 'error',
  )
  const [errorDetails, setErrorDetails] = useState<string | null>(() =>
    resolvedStreamUrl
      ? null
      : 'No stream URL is configured for this title yet. Please attach a valid Telegram Bridge or MP4 stream in PMF Studio.',
  )
  const [streamAttemptKey, setStreamAttemptKey] = useState(0)

  // Real Track State (Only populated when actual tracks exist on the source)
  const availableSubtitles: SubtitleTrackMeta[] = Array.isArray(movie.subtitles)
    ? movie.subtitles
    : []
  const [activeSubtitle, setActiveSubtitle] = useState<string>('off')
  const [detectedAudioTracks, setDetectedAudioTracks] = useState<DetectedAudioTrack[]>([])
  const [activeAudioTrackId, setActiveAudioTrackId] = useState<string>('default')

  const [isLocked, setIsLocked] = useState(false)
  const [videoFit, setVideoFit] = useState<VideoFitMode>('contain')
  const [brightness, setBrightness] = useState(100)
  const [gestureHud, setGestureHud] = useState<{ kind: 'brightness' | 'boost'; value: number } | null>(null)
  const gestureStartRef = useRef<{ x: number; y: number; brightness: number; boost: number; active: boolean } | null>(null)
  const gestureHudTimerRef = useRef<number | null>(null)
  const [activeDrawer, setActiveDrawer] = useState<
    'none' | 'speed' | 'tracks' | 'display' | 'network'
  >('none')
  const [doubleTapRipple, setDoubleTapRipple] = useState<'left' | 'right' | null>(null)
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' }>({ time: 0, side: 'left' })

  // Sanitized development logger (never logs URLs, tokens, or secrets)
  const logStreamDiagnostic = useCallback(
    (event: string, payload: Record<string, number | string | boolean>) => {
      if (import.meta.env.DEV) {
        console.debug(`[PMF-Stream-Diag] movie=${movie.id} event=${event}`, payload)
      }
    },
    [movie.id],
  )

  const clearTimers = useCallback(() => {
    if (startupTimerRef.current) {
      window.clearTimeout(startupTimerRef.current)
      startupTimerRef.current = null
    }
    if (backoffTimerRef.current) {
      window.clearTimeout(backoffTimerRef.current)
      backoffTimerRef.current = null
    }
    if (spinnerDebounceRef.current) {
      window.clearTimeout(spinnerDebounceRef.current)
      spinnerDebounceRef.current = null
    }
  }, [])

  // Sync initialTimeRef ONLY when switching to a different movie/stream
  useEffect(() => {
    initialTimeRef.current = initialTime
    lastSavedTimeRef.current = initialTime
  }, [movie.id, resolvedStreamUrl, initialTime])

  // Diagnose why a stream failed (HTTP 404 unmapped movie, Render cold-start, or WebView codec issue)
  const diagnoseStreamFailure = useCallback(
    async (mediaError?: MediaError | null) => {
      clearTimers()
      setShowBufferingOverlay(false)

      if (!resolvedStreamUrl) {
        setStreamStage('error')
        setErrorDetails('No media stream URL is linked to this title.')
        return
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false && !isLocalOfflineStream) {
        setStreamStage('error')
        setErrorDetails(
          'Your device is currently offline. Connect to mobile data or Wi-Fi, or play a downloaded movie from Offline Cinema.',
        )
        return
      }

      // Recover transient network/startup failures automatically instead of showing
      // the interruption card after the first dropped or delayed bridge response.
      // Resume from the last known playhead and allow genuine 404/codec errors to
      // reach the diagnostic path below after a bounded number of attempts.
      const isTransientNetworkFailure =
        !mediaError || mediaError.code === MediaError.MEDIA_ERR_NETWORK
      if (
        isTransientNetworkFailure &&
        !isLocalOfflineStream &&
        /^https?:\/\//i.test(resolvedStreamUrl) &&
        startupFailureRetryRef.current < 3
      ) {
        const attempt = ++startupFailureRetryRef.current
        const delayMs = Math.min(4000, 1000 * Math.pow(2, attempt - 1))
        const video = videoRef.current
        if (video && video.currentTime > 0) {
          lastSavedTimeRef.current = video.currentTime
        }
        retryCountRef.current = 0
        setErrorDetails(null)
        setShowBufferingOverlay(true)
        setStreamStage('retrying')
        logStreamDiagnostic('automatic_stream_startup_retry', {
          attempt,
          delayMs,
          mediaErrorCode: mediaError?.code || 0,
        })
        backoffTimerRef.current = window.setTimeout(() => {
          setStreamAttemptKey((prev) => prev + 1)
        }, delayMs)
        return
      }

      // Probe the endpoint with a tiny 128-byte Range request to check for bridge 404 or server status
      if (!isLocalOfflineStream && /^https?:\/\//i.test(resolvedStreamUrl)) {
        try {
          const controller = new AbortController()
          const timeoutId = window.setTimeout(() => controller.abort(), 8000)
          const res = await fetch(resolvedStreamUrl, {
            method: 'GET',
            headers: { Range: 'bytes=0-127' },
            signal: controller.signal,
          })
          window.clearTimeout(timeoutId)

          if (res.status === 404) {
            let bridgeMsg = `Stream not found on server (HTTP 404).`
            try {
              const data = await res.json()
              if (data?.error) bridgeMsg = data.error
            } catch {}
            setStreamStage('error')
            setErrorDetails(
              `${bridgeMsg} Map a valid Telegram media ID in PMF Studio or verify the bridge route.`,
            )
            return
          }

          if (res.status >= 500) {
            setStreamStage('error')
            setErrorDetails(
              `PMF Telegram Bridge returned HTTP ${res.status}. The service may be waking up—tap Retry Stream in a few seconds.`,
            )
            return
          }

          const disposition = res.headers.get('content-disposition') || ''
          if (
            (mediaError?.code === 3 || mediaError?.code === 4) &&
            /x265|hevc|10bit/i.test(disposition)
          ) {
            setStreamStage('error')
            setErrorDetails(
              'This stream is encoded in 10-bit HEVC (x265), which is not supported by this browser/WebView hardware decoder. Try playing on your Android device with hardware HEVC support or use an H.264 (AVC) MP4 encode.',
            )
            return
          }
        } catch {
          // Network or timeout during diagnostic probe
        }
      }

      if (mediaError) {
        switch (mediaError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            setStreamStage('error')
            setErrorDetails('Playback was interrupted. Tap Retry Stream to continue.')
            return
          case MediaError.MEDIA_ERR_NETWORK:
            setStreamStage('error')
            setErrorDetails(
              'Network interruption while streaming video data. Check your connection and tap Retry Stream to resume from where you left off.',
            )
            return
          case MediaError.MEDIA_ERR_DECODE:
            setStreamStage('error')
            setErrorDetails(
              'The video stream could not be decoded by this device WebView (codec or container incompatibility).',
            )
            return
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            setStreamStage('error')
            setErrorDetails(
              'This video format or stream source is unreachable or unsupported on this device.',
            )
            return
        }
      }

      setStreamStage('error')
      setErrorDetails(
        'The stream took too long to respond or is temporarily unavailable. Tap Retry Stream to reconnect.',
      )
    },
    [clearTimers, isLocalOfflineStream, logStreamDiagnostic, resolvedStreamUrl],
  )

  const diagnoseRef = useRef(diagnoseStreamFailure)
  diagnoseRef.current = diagnoseStreamFailure

  const handleRetryStream = useCallback(() => {
    const video = videoRef.current
    if (video && video.currentTime > 0) {
      lastSavedTimeRef.current = video.currentTime
    }
    hasRestoredInitialTimeRef.current = false
    isHoldingForCushionRef.current = false
    userIntendedPlayRef.current = true
    retryCountRef.current = 0
    startupFailureRetryRef.current = 0
    setErrorDetails(null)
    setShowBufferingOverlay(true)
    setStreamStage('connecting')
    setStreamAttemptKey((prev) => prev + 1)
  }, [])

  // Compute adaptive required buffer cushion (in seconds) before resuming after a mid-stream stall
  const getAdaptiveResumeCushionSec = useCallback((): number => {
    if (isLocalOfflineStream) return 1.5
    const stalls = diagStatsRef.current.bufferingCount
    if (weakNetworkSmoothMode) {
      return stalls >= 2 ? 16 : 12
    }
    if (stalls <= 1) return 6
    if (stalls === 2) return 10
    return 14
  }, [isLocalOfflineStream, weakNetworkSmoothMode])

  // Compute dynamic target buffer ahead (120s initial target, up to 300s on fast links, 60s on weak links)
  const computeTargetBufferSeconds = useCallback(
    (netProfile: NetworkQualityProfile): number => {
      if (isLocalOfflineStream) return 300
      if (weakNetworkSmoothMode || netProfile === 'weak') return 60
      if (netProfile === 'fast') return 300
      return 120
    },
    [isLocalOfflineStream, weakNetworkSmoothMode],
  )

  // Evaluate buffer health & release hysteresis cushion when enough contiguous runway is ready
  const evaluateBufferAndCushion = useCallback(() => {
    const video = videoRef.current
    if (!video || isYoutube) return

    const { bufferedEnd: bEnd, bufferedAhead } = getContiguousBufferMetrics(video)
    setBufferedEnd(bEnd)

    const now = Date.now()
    if (bEnd > lastBufferedEndRef.current + 0.1) {
      lastBufferAdvanceAtRef.current = now
      lastBufferedEndRef.current = bEnd
    }

    // Estimate effective download throughput from buffer growth over wall-clock time
    const elapsedSec = (now - bufferSampleRef.current.timeMs) / 1000
    if (elapsedSec >= 2.0) {
      const deltaVideoSec = bEnd - bufferSampleRef.current.bufferedEnd
      if (deltaVideoSec > 0 && deltaVideoSec < 60) {
        const instantaneousKbps = Math.round((deltaVideoSec * streamBitrateKbps) / elapsedSec)
        diagStatsRef.current.measuredThroughputKbps = Math.round(
          diagStatsRef.current.measuredThroughputKbps * 0.65 + instantaneousKbps * 0.35,
        )
      }
      bufferSampleRef.current = { timeMs: now, bufferedEnd: bEnd }
    }

    const hint = detectBrowserNetworkHint()
    const throughputKbps = Math.max(400, diagStatsRef.current.measuredThroughputKbps)
    const deliveryRatio = throughputKbps / Math.max(300, streamBitrateKbps)

    const netProfile: NetworkQualityProfile =
      weakNetworkSmoothMode || hint.profile === 'weak' || deliveryRatio < 1.25
        ? 'weak'
        : deliveryRatio >= 2.2 && hint.profile === 'fast'
          ? 'fast'
          : 'moderate'

    const targetBufferSec = computeTargetBufferSeconds(netProfile)
    const requiredCushionSec = getAdaptiveResumeCushionSec()

    // Dynamically tune HLS buffer ceiling when HLS is active
    if (hlsRef.current) {
      hlsRef.current.config.maxBufferLength = targetBufferSec
      hlsRef.current.config.maxMaxBufferLength = Math.max(targetBufferSec, 300)
    }

    // If holding for rebuffer cushion after a mid-stream stall, check if safe runway is reached
    if (isHoldingForCushionRef.current && userIntendedPlayRef.current) {
      const nearEndOfMovie =
        Number.isFinite(video.duration) &&
        video.duration > 0 &&
        video.duration - video.currentTime <= requiredCushionSec + 2
      const stallWaitMs = stallStartedAtRef.current ? now - stallStartedAtRef.current : 0
      const hasMinimumPlayableFallback =
        stallWaitMs >= 6500 && video.readyState >= 3 && bufferedAhead >= 2.8

      if (
        bufferedAhead >= requiredCushionSec ||
        nearEndOfMovie ||
        hasMinimumPlayableFallback
      ) {
        isHoldingForCushionRef.current = false
        const totalStallMs = stallStartedAtRef.current ? now - stallStartedAtRef.current : 0
        if (stallStartedAtRef.current) {
          diagStatsRef.current.lastStallDurationMs = totalStallMs
          diagStatsRef.current.totalBufferingMs += totalStallMs
          diagStatsRef.current.recoveryCount += 1
          stallStartedAtRef.current = null
        }

        logStreamDiagnostic('buffer_cushion_recovered', {
          bufferedAheadSec: Number(bufferedAhead.toFixed(1)),
          requiredCushionSec,
          stallDurationMs: totalStallMs,
          recoveryCount: diagStatsRef.current.recoveryCount,
        })

        setShowBufferingOverlay(false)
        setStreamStage('ready')
        if (video.paused && userIntendedPlayRef.current) {
          video.play().catch(() => {})
        }
      }
    }

    setDiagnostics({
      bufferedAheadSec: Number(bufferedAhead.toFixed(1)),
      targetBufferSec,
      requiredCushionSec,
      bufferingCount: diagStatsRef.current.bufferingCount,
      lastStallDurationMs: diagStatsRef.current.lastStallDurationMs,
      totalBufferingMs: diagStatsRef.current.totalBufferingMs,
      recoveryCount: diagStatsRef.current.recoveryCount,
      networkProfile: netProfile,
      estimatedThroughputKbps: throughputKbps,
      streamBitrateKbps,
    })
  }, [
    computeTargetBufferSeconds,
    getAdaptiveResumeCushionSec,
    isYoutube,
    logStreamDiagnostic,
    streamBitrateKbps,
    weakNetworkSmoothMode,
  ])

  // Auto-hide controls after 3.5 seconds of inactivity during active playback
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current)
    }
    if (isPlaying && activeDrawer === 'none' && streamStage === 'ready') {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false)
      }, 3500)
    }
  }, [isPlaying, activeDrawer, streamStage])

  useEffect(() => {
    resetControlsTimer()
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [resetControlsTimer])

  // Cleanly exit fullscreen and unlock orientation on close/unmount
  const cleanupFullscreenAndOrientation = useCallback(async () => {
    nativeFullscreenRequestedRef.current = false
    setIsFullscreen(false)
    try {
      await PMFScreenOrientation.exitImmersive()
    } catch {}
    try {
      await PMFScreenOrientation.unlock()
    } catch {
      try {
        const screenAny = window.screen as unknown as { orientation?: { unlock?: () => void } }
        screenAny?.orientation?.unlock?.()
      } catch {}
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {}
  }, [])

  const handleClosePlayer = useCallback(() => {
    clearTimers()
    userIntendedPlayRef.current = false
    isHoldingForCushionRef.current = false
    const video = videoRef.current
    if (video && video.currentTime > 0 && video.duration > 0) {
      onProgressSaveRef.current(video.currentTime, video.duration)
    }
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    void cleanupFullscreenAndOrientation()
    onClose()
  }, [clearTimers, cleanupFullscreenAndOrientation, onClose])

  // Initialize HTML5 Video or HLS.js stream — ONLY re-runs when stream URL, type, or explicit retry key changes!
  useEffect(() => {
    if (isYoutube) {
      setStreamStage('ready')
      setShowBufferingOverlay(false)
      return
    }

    const video = videoRef.current
    if (!video || !resolvedStreamUrl) {
      setStreamStage('error')
      setShowBufferingOverlay(false)
      setErrorDetails('No playable stream URL is configured for this title.')
      return
    }

    let hls: Hls | null = null
    const isHlsStream =
      movie.videoType === 'hls' || /\.m3u8(\?|$)/i.test(resolvedStreamUrl)

    setStreamStage('connecting')
    setShowBufferingOverlay(true)
    setErrorDetails(null)
    setHlsLevels([])
    setActiveHlsLevel(-1)
    hasRestoredInitialTimeRef.current = false
    isHoldingForCushionRef.current = false
    userIntendedPlayRef.current = true
    stallStartedAtRef.current = null
    lastBufferAdvanceAtRef.current = Date.now()
    lastBufferedEndRef.current = 0
    bufferSampleRef.current = { timeMs: Date.now(), bufferedEnd: 0 }

    // Allow a cold Render wake-up on the first attempt, then shorten subsequent
    // watchdogs so transient failures recover sooner without waiting another 28s.
    clearTimers()
    const startupTimeoutMs = startupFailureRetryRef.current === 0 ? 28000 : 14000
    startupTimerRef.current = window.setTimeout(() => {
      if (video.readyState < 2) {
        void diagnoseRef.current(video.error)
      }
    }, startupTimeoutMs)

    const netHint = detectBrowserNetworkHint()
    const initialTargetBuffer = isLocalOfflineStream
      ? 300
      : netHint.profile === 'weak'
        ? 60
        : netHint.profile === 'fast'
          ? 240
          : 120

    if (isHlsStream && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        // Intelligent Buffer-Ahead: 2 min initial target, up to 5 min max ceiling, 60 MB memory cap
        maxBufferLength: initialTargetBuffer,
        maxMaxBufferLength: 300,
        maxBufferSize: 60 * 1000 * 1000,
        backBufferLength: 30,
        // Conservative ABR: prefer uninterrupted playback over premature high-bitrate jumps
        abrBandWidthFactor: 0.75,
        abrBandWidthUpFactor: 0.55,
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 1200,
        fragLoadingMaxRetryTimeout: 16000,
      })
      hlsRef.current = hls
      hls.loadSource(resolvedStreamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (Array.isArray(data.levels) && data.levels.length > 1) {
          const parsedLevels: HlsQualityLevel[] = data.levels.map((lvl, idx) => {
            const kbps = Math.round((lvl.bitrate || 0) / 1000)
            const height = lvl.height || 0
            return {
              index: idx,
              height,
              bitrateKbps: kbps,
              label: height ? `${height}p (${kbps} kbps)` : `${kbps} kbps`,
            }
          })
          setHlsLevels(parsedLevels)
        }

        const resumeAt = lastSavedTimeRef.current || initialTimeRef.current
        if (resumeAt > 0) {
          video.currentTime = resumeAt
        }
        video.play().catch(() => {
          setIsPlaying(false)
          setShowControls(true)
        })
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCountRef.current < 3) {
            retryCountRef.current += 1
            const delayMs = Math.min(8000, 1500 * Math.pow(2, retryCountRef.current - 1))
            setStreamStage('retrying')
            setShowBufferingOverlay(true)
            backoffTimerRef.current = window.setTimeout(() => {
              hls?.startLoad()
            }, delayMs)
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryCountRef.current < 2) {
            retryCountRef.current += 1
            hls?.recoverMediaError()
          } else {
            void diagnoseRef.current(video.error)
          }
        }
      })
    } else {
      hlsRef.current = null
      // Use preload="auto" so Chromium / Android WebView continuously prefetches HTTP 206 byte ranges ahead
      video.preload = 'auto'
      video.src = resolvedStreamUrl
      video.load()
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          setIsPlaying(false)
          setShowControls(true)
        })
      }
    }

    return () => {
      clearTimers()
      if (hls) {
        hls.destroy()
        hlsRef.current = null
      }
      if (video) {
        video.pause()
      }
    }
  }, [resolvedStreamUrl, movie.videoType, isYoutube, isLocalOfflineStream, streamAttemptKey, clearTimers])

  // Continuous 600ms Buffer Governor & Non-Destructive Stall Recovery Loop
  useEffect(() => {
    if (isYoutube) return
    const timer = window.setInterval(() => {
      evaluateBufferAndCushion()

      const video = videoRef.current
      if (!video || streamStage === 'error') return

      // Check for genuine zero-byte network connection drop while buffering
      if (
        (streamStage === 'buffering' || streamStage === 'retrying' || isHoldingForCushionRef.current) &&
        userIntendedPlayRef.current
      ) {
        const msSinceLastBytes = Date.now() - lastBufferAdvanceAtRef.current
        const { bufferedAhead } = getContiguousBufferMetrics(video)

        // Only reconnect if 0 new bytes arrived for > 24s AND playhead has < 2s buffered ahead
        if (msSinceLastBytes > 24000 && bufferedAhead < 2.0 && video.readyState < 3) {
          if (retryCountRef.current < 3) {
            retryCountRef.current += 1
            const resumeTime = video.currentTime > 0 ? video.currentTime : lastSavedTimeRef.current
            lastSavedTimeRef.current = resumeTime
            lastBufferAdvanceAtRef.current = Date.now()
            setStreamStage('retrying')
            setShowBufferingOverlay(true)

            const backoffMs = Math.min(8000, 2000 * Math.pow(2, retryCountRef.current - 1))
            logStreamDiagnostic('exponential_backoff_reconnect', {
              attempt: retryCountRef.current,
              backoffMs,
              resumeTimeSec: Number(resumeTime.toFixed(1)),
            })

            if (backoffTimerRef.current) {
              window.clearTimeout(backoffTimerRef.current)
            }
            backoffTimerRef.current = window.setTimeout(() => {
              const v = videoRef.current
              if (!v) return
              if (hlsRef.current) {
                hlsRef.current.startLoad(resumeTime)
              } else {
                hasRestoredInitialTimeRef.current = false
                v.src = resolvedStreamUrl
                v.preload = 'auto'
                v.load()
                v.play().catch(() => {})
              }
            }, backoffMs)
          } else {
            void diagnoseRef.current(video.error)
          }
        }
      }
    }, 600)

    return () => window.clearInterval(timer)
  }, [evaluateBufferAndCushion, isYoutube, logStreamDiagnostic, resolvedStreamUrl, streamStage])

  // Automatically resume stream recovery when device regains network connectivity
  useEffect(() => {
    if (isYoutube || isLocalOfflineStream) return
    const handleOnline = () => {
      const video = videoRef.current
      if (!video) return
      lastBufferAdvanceAtRef.current = Date.now()
      if (streamStage === 'error') {
        handleRetryStream()
      } else if (
        (streamStage === 'buffering' || isHoldingForCushionRef.current) &&
        userIntendedPlayRef.current
      ) {
        if (hlsRef.current) {
          hlsRef.current.startLoad(video.currentTime)
        } else if (video.paused) {
          video.play().catch(() => {})
        }
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [handleRetryStream, isLocalOfflineStream, isYoutube, streamStage])

  // Throttled Progress Save (every 5 seconds and on unmount — completely decoupled from stream lifecycle)
  useEffect(() => {
    if (isYoutube) return
    const videoEl = videoRef.current
    const interval = window.setInterval(() => {
      const video = videoRef.current
      if (video && !video.paused && video.currentTime > 0 && video.duration > 0) {
        if (Math.abs(video.currentTime - lastSavedTimeRef.current) >= 5) {
          lastSavedTimeRef.current = video.currentTime
          onProgressSaveRef.current(video.currentTime, video.duration)
        }
      }
    }, 5000)

    return () => {
      window.clearInterval(interval)
      if (videoEl && videoEl.currentTime > 0 && videoEl.duration > 0) {
        onProgressSaveRef.current(videoEl.currentTime, videoEl.duration)
      }
    }
  }, [isYoutube])

  // Keep browser and native Android fullscreen/orientation state in sync.
  // Android WebView does not consistently emit DOM fullscreen events, so listen
  // for native viewport changes while the native fullscreen request is active.
  useEffect(() => {
    const isNativeAndroid = Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent)
    const cleanupNative = () => {
      nativeFullscreenRequestedRef.current = false
      void (async () => {
        try { await PMFScreenOrientation.exitImmersive() } catch {}
        try { await PMFScreenOrientation.unlock() } catch {
          try {
            const screenAny = window.screen as unknown as { orientation?: { unlock?: () => void } }
            screenAny?.orientation?.unlock?.()
          } catch {}
        }
      })()
    }
    const handleFsChange = () => {
      const inFs = Boolean(document.fullscreenElement)
      if (isNativeAndroid) {
        if (inFs || nativeFullscreenRequestedRef.current) setIsFullscreen(true)
        return
      }
      setIsFullscreen(inFs)
      if (!inFs) cleanupNative()
    }
    const handleNativeViewportChange = () => {
      if (!isNativeAndroid || !nativeFullscreenRequestedRef.current) return
      // Only mark fullscreen after Android has actually reached landscape.
      const orientation = window.screen.orientation?.type || ''
      const isLandscape = window.innerWidth > window.innerHeight || orientation.startsWith('landscape')
      if (!isLandscape) return
      setIsFullscreen(true)
      // Android may restore system bars during configuration changes.
      void PMFScreenOrientation.enterImmersive().catch(() => {})
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    window.addEventListener('orientationchange', handleNativeViewportChange)
    window.addEventListener('resize', handleNativeViewportChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      window.removeEventListener('orientationchange', handleNativeViewportChange)
      window.removeEventListener('resize', handleNativeViewportChange)
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (isLocked) return
    const video = videoRef.current
    if (!video) return
    if (streamStage === 'error') {
      handleRetryStream()
      return
    }
    if (video.paused && !isHoldingForCushionRef.current) {
      userIntendedPlayRef.current = true
      setIsPlaying(true)
      video.play().catch(() => {})
    } else {
      userIntendedPlayRef.current = false
      isHoldingForCushionRef.current = false
      setShowBufferingOverlay(false)
      setStreamStage('ready')
      setIsPlaying(false)
      video.pause()
    }
    resetControlsTimer()
  }, [isLocked, streamStage, handleRetryStream, resetControlsTimer])

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      if (isLocked) return
      const video = videoRef.current
      if (!video) return
      const maxDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration
      const target = Math.max(0, Math.min(maxDur || Infinity, video.currentTime + deltaSeconds))
      isHoldingForCushionRef.current = false
      video.currentTime = target
      setCurrentTime(target)
      lastSavedTimeRef.current = target
      resetControlsTimer()
    },
    [isLocked, duration, resetControlsTimer],
  )

  const handleTimelineScrub = (value: number) => {
    if (isLocked) return
    const video = videoRef.current
    if (!video) return
    isHoldingForCushionRef.current = false
    video.currentTime = value
    setCurrentTime(value)
    lastSavedTimeRef.current = value
    resetControlsTimer()
  }

  const toggleMute = useCallback(() => {
    if (isLocked) return
    const video = videoRef.current
    if (!video) return
    const nextMuted = !video.muted
    video.muted = nextMuted
    setIsMuted(nextMuted)
  }, [isLocked])

  const ensureAudioBoost = useCallback(() => {
    const video = videoRef.current
    if (!video) return null

    // IMPORTANT: WebAudio can mute cross-origin media when the remote server does
    // not grant CORS access. Keep remote licensed/Telegram streams on the native
    // media audio path; only create a gain graph for same-origin media.
    try {
      const sourceUrl = new URL(resolvedStreamUrl, window.location.href)
      if (sourceUrl.origin !== window.location.origin) return null
    } catch {
      return null
    }

    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextCtor) return null
      if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor()
      if (!audioSourceRef.current) {
        audioSourceRef.current = audioContextRef.current.createMediaElementSource(video)
        audioGainRef.current = audioContextRef.current.createGain()
        audioSourceRef.current.connect(audioGainRef.current)
        audioGainRef.current.connect(audioContextRef.current.destination)
      }
      if (audioContextRef.current.state === 'suspended') void audioContextRef.current.resume()
      if (audioGainRef.current) audioGainRef.current.gain.value = soundBoost
      return audioGainRef.current
    } catch {
      return null
    }
  }, [soundBoost, resolvedStreamUrl])

  useEffect(() => {
    if (audioGainRef.current) audioGainRef.current.gain.value = soundBoost
  }, [soundBoost])

  const handleVolumeChange = (nextVol: number) => {
    if (isLocked) return
    const video = videoRef.current
    if (!video) return
    const clamped = Math.max(0, Math.min(1, nextVol))
    video.volume = clamped
    video.muted = clamped === 0
    setVolume(clamped)
    setIsMuted(clamped === 0)
  }

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current
    if (video) video.playbackRate = rate
    setPlaybackRate(rate)
    setActiveDrawer('none')
  }

  const handleSelectHlsQuality = (levelIndex: number) => {
    setActiveHlsLevel(levelIndex)
    if (hlsRef.current) hlsRef.current.currentLevel = levelIndex
  }

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    const screenAny = window.screen as unknown as {
      orientation?: { type?: string; lock?: (mode: string) => Promise<void>; unlock?: () => void }
    }
    const isNativeAndroid = Capacitor.isNativePlatform() && /Android/i.test(navigator.userAgent)
    const isLandscapeViewport = () =>
      window.innerWidth > window.innerHeight ||
      Boolean(screenAny.orientation?.type?.startsWith('landscape'))
    const waitForLandscape = () =>
      new Promise<boolean>((resolve) => {
        if (isLandscapeViewport()) {
          resolve(true)
          return
        }
        let finished = false
        let timeout = 0
        const finish = (success: boolean) => {
          if (finished) return
          finished = true
          window.removeEventListener('resize', check)
          window.removeEventListener('orientationchange', check)
          window.clearTimeout(timeout)
          resolve(success)
        }
        const check = () => {
          if (isLandscapeViewport()) finish(true)
        }
        timeout = window.setTimeout(() => finish(isLandscapeViewport()), 5000)
        window.addEventListener('resize', check)
        window.addEventListener('orientationchange', check)
        check()
      })

    const currentlyFullscreen = Boolean(document.fullscreenElement) || isFullscreen
    if (currentlyFullscreen) {
      nativeFullscreenRequestedRef.current = false
      try {
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen()
      } catch {
        // Native Android WebView may not support DOM fullscreen; continue native cleanup.
      }
      setIsFullscreen(false)
      try { await PMFScreenOrientation.exitImmersive() } catch {}
      try {
        await PMFScreenOrientation.unlock()
      } catch {
        try { screenAny.orientation?.unlock?.() } catch {}
      }
      return
    }

    if (isNativeAndroid) {
      nativeFullscreenRequestedRef.current = true
      try {
        await PMFScreenOrientation.lockLandscape()
        const reachedLandscape = await waitForLandscape()
        if (!reachedLandscape) throw new Error('Android did not enter landscape within five seconds')
        await PMFScreenOrientation.enterImmersive()
        await new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
        )
        setIsFullscreen(true)
      } catch (error) {
        nativeFullscreenRequestedRef.current = false
        setIsFullscreen(false)
        console.warn('PMF native landscape fullscreen failed.', error)
        try { await PMFScreenOrientation.exitImmersive() } catch {}
        try {
          await PMFScreenOrientation.unlock()
        } catch {
          try { screenAny.orientation?.unlock?.() } catch {}
        }
      }
      return
    }

    try {
      if (screenAny.orientation?.lock) {
        try { await screenAny.orientation.lock('landscape') } catch {}
      }
      if (container.requestFullscreen) {
        await container.requestFullscreen()
        setIsFullscreen(Boolean(document.fullscreenElement))
      } else {
        setIsFullscreen(false)
      }
    } catch {
      setIsFullscreen(false)
      try { screenAny.orientation?.unlock?.() } catch {}
    }
  }, [isFullscreen])

  const togglePiP = async () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if ('requestPictureInPicture' in video) {
        await video.requestPictureInPicture()
      }
    } catch {}
  }

  const showGestureHud = (kind: 'brightness' | 'boost', value: number) => {
    setGestureHud({ kind, value })
    if (gestureHudTimerRef.current) window.clearTimeout(gestureHudTimerRef.current)
    gestureHudTimerRef.current = window.setTimeout(() => setGestureHud(null), 850)
  }

  const handleGestureTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isYoutube || isLocked || e.touches.length !== 1) return
    const touch = e.touches[0]
    const rect = e.currentTarget.getBoundingClientRect()
    if (touch.clientX - rect.left > Math.min(110, rect.width * 0.22)) return
    gestureStartRef.current = { x: touch.clientX, y: touch.clientY, brightness, boost: soundBoost, active: false }
  }

  const handleGestureTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = gestureStartRef.current
    if (!start || e.touches.length !== 1) return
    const touch = e.touches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (!start.active && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.2) start.active = true
    if (!start.active) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const delta = Math.round((-dy / Math.max(220, rect.height)) * 100)
    if (start.y - rect.top < rect.height * 0.5) {
      const next = Math.max(40, Math.min(130, start.brightness + delta))
      setBrightness(next)
      showGestureHud('brightness', next)
    } else {
      const next = Math.max(1, Math.min(3, Number((start.boost + delta / 100).toFixed(1))))
      setSoundBoost(next)
      const gain = ensureAudioBoost()
      if (gain) gain.gain.value = next
      showGestureHud('boost', Math.round(next * 100))
    }
  }

  const handleGestureTouchEnd = () => { gestureStartRef.current = null }

  const handleVideoSurfaceTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLocked) {
      setShowControls((prev) => !prev)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const side: 'left' | 'right' = clickX < rect.width / 2 ? 'left' : 'right'
    const now = Date.now()

    if (now - lastTapRef.current.time < 300 && lastTapRef.current.side === side) {
      if (side === 'left') {
        seekBy(-10)
        setDoubleTapRipple('left')
      } else {
        seekBy(10)
        setDoubleTapRipple('right')
      }
      window.setTimeout(() => setDoubleTapRipple(null), 550)
      lastTapRef.current = { time: 0, side }
    } else {
      lastTapRef.current = { time: now, side }
      if (activeDrawer !== 'none') {
        setActiveDrawer('none')
      } else {
        setShowControls((prev) => !prev)
      }
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (activeDrawer !== 'none') {
          setActiveDrawer('none')
        } else {
          handleClosePlayer()
        }
      }
      if (isYoutube || isLocked) return

      if (event.key === ' ' || event.key === 'k') {
        event.preventDefault()
        togglePlay()
      } else if (event.key === 'ArrowRight' || event.key === 'l') {
        event.preventDefault()
        seekBy(10)
      } else if (event.key === 'ArrowLeft' || event.key === 'j') {
        event.preventDefault()
        seekBy(-10)
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        void toggleFullscreen()
      } else if (event.key.toLowerCase() === 'm') {
        event.preventDefault()
        toggleMute()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isYoutube,
    isLocked,
    activeDrawer,
    handleClosePlayer,
    togglePlay,
    seekBy,
    toggleFullscreen,
    toggleMute,
  ])

  // Switch active subtitle track when real <track> elements exist
  const handleSelectSubtitle = (trackId: string) => {
    setActiveSubtitle(trackId)
    const video = videoRef.current
    if (video && video.textTracks) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i]
        track.mode =
          trackId !== 'off' && (track.language === trackId || track.label === trackId)
            ? 'showing'
            : 'disabled'
      }
    }
  }

  // Switch active audio track when multi-track audio exists on the media element
  const handleSelectAudioTrack = (trackId: string) => {
    setActiveAudioTrackId(trackId)
    const videoAny = videoRef.current as unknown as {
      audioTracks?: {
        length: number
        [index: number]: { id?: string; label?: string; language?: string; enabled: boolean }
      }
    }
    if (videoAny?.audioTracks) {
      for (let i = 0; i < videoAny.audioTracks.length; i++) {
        const t = videoAny.audioTracks[i]
        const id = t.id || String(i)
        t.enabled = id === trackId
      }
    }
  }

  const progressPercentage = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const bufferedPercentage = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0
  const bufferTargetFillPercent = Math.min(
    100,
    Math.round((diagnostics.bufferedAheadSec / Math.max(10, diagnostics.targetBufferSec)) * 100),
  )

  const stageLabel =
    streamStage === 'resolving'
      ? 'Resolving media source...'
      : streamStage === 'connecting'
        ? 'Connecting to PMF media stream...'
        : streamStage === 'retrying'
          ? 'Reconnecting & preserving playback position...'
          : isHoldingForCushionRef.current
            ? `Building smooth playback cushion (${Math.min(
                100,
                Math.round(
                  (diagnostics.bufferedAheadSec / Math.max(1, diagnostics.requiredCushionSec)) * 100,
                ),
              )}%)...`
            : 'Buffering video stream...'

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      className="pmf-player-shell fixed inset-0 z-[100] flex flex-col bg-black text-white select-none overflow-hidden"
      style={{
        paddingTop: isFullscreen ? '0px' : 'env(safe-area-inset-top, 0px)',
        paddingBottom: isFullscreen ? '0px' : 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: isFullscreen ? '0px' : 'env(safe-area-inset-left, 0px)',
        paddingRight: isFullscreen ? '0px' : 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Top Cinema Bar */}
      <div
        className={`relative z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-black/95 via-black/60 to-transparent px-3 py-2 sm:gap-3 sm:px-8 sm:py-3.5 transition-opacity duration-300 ${
          showControls || streamStage === 'error' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 sm:gap-3">
          <button
            type="button"
            onClick={handleClosePlayer}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/85 backdrop-blur-md transition hover:bg-white hover:text-black active:scale-95"
            aria-label="Close player"
          >
            <X size={18} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-amber-300">
                <Sparkles size={9} />
                {isLocalOfflineStream ? 'Offline Vault' : 'PMF Cinema'}
              </span>
              {movie.year && (
                <span className="text-[10px] font-bold text-white/45">{movie.year}</span>
              )}
              {movie.seriesTitle && (
                <span className="text-[10px] font-bold text-purple-300">
                  S{movie.seasonNumber || 1}:E{movie.episodeNumber || 1}
                </span>
              )}
              {!isYoutube && !isLocalOfflineStream && diagnostics.bufferedAheadSec > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-300">
                  +{Math.round(diagnostics.bufferedAheadSec)}s buffered
                </span>
              )}
            </div>
            <h2 className="truncate text-sm font-black tracking-tight text-white sm:text-lg">
              {movie.title}
            </h2>
          </div>
        </div>

        {/* Right Top Actions */}
        {!isYoutube && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsLocked((prev) => !prev)
                setActiveDrawer('none')
              }}
              className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[9px] font-black uppercase tracking-[0.14em] transition ${
                isLocked
                  ? 'border-amber-400 bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                  : 'border-white/15 bg-black/50 text-white/75 hover:border-white/30 hover:text-white'
              }`}
              title={isLocked ? 'Unlock touch controls' : 'Lock screen controls'}
            >
              {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
              <span className="hidden sm:inline">{isLocked ? 'Locked' : 'Lock'}</span>
            </button>

            {!isLocked && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const currentIdx = VIDEO_FIT_MODES.findIndex((m) => m.id === videoFit)
                    const nextMode = VIDEO_FIT_MODES[(currentIdx + 1) % VIDEO_FIT_MODES.length]
                    setVideoFit(nextMode.id)
                  }}
                  className="hidden lg:flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-white/75 transition hover:border-white/30 hover:text-white"
                  title="Aspect Ratio / Screen Fit"
                >
                  <Scaling size={12} />
                  <span>{VIDEO_FIT_MODES.find((m) => m.id === videoFit)?.label}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheaterMode((prev) => !prev)}
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-2.5 sm:px-3 text-[9px] font-black uppercase tracking-[0.1em] transition ${
                    theaterMode
                      ? 'border-purple-400/40 bg-purple-500/20 text-purple-200'
                      : 'border-white/15 bg-black/50 text-white/70 hover:text-white'
                  }`}
                >
                  <Tv size={14} />
                  <span className="hidden sm:inline">{theaterMode ? 'Theater' : 'Theater mode'}</span>
                </button>
              </>
            )}

            {onNext && !isLocked && (
              <button
                type="button"
                onClick={onNext}
                className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[9px] font-black uppercase tracking-[0.14em] text-black transition hover:scale-105"
              >
                <SkipForward size={12} fill="currentColor" />
                <span className="hidden sm:inline">Next</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Video Stage */}
      <div className={`relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden bg-black ${isFullscreen ? 'w-screen h-[100dvh] max-w-none' : ''}`}>
        {isYoutube ? (
          <div
            className={`w-full ${
              theaterMode ? 'h-full' : 'max-w-[1400px] aspect-video px-2 sm:px-6'
            }`}
          >
            <iframe
              src={getYoutubeEmbed(resolvedStreamUrl)}
              title={movie.title}
              className="h-full w-full rounded-2xl border border-white/10 bg-black shadow-2xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div
            onClick={handleVideoSurfaceTap}
            onTouchStart={handleGestureTouchStart}
            onTouchMove={handleGestureTouchMove}
            onTouchEnd={handleGestureTouchEnd}
            onTouchCancel={handleGestureTouchEnd}
            className={`pmf-video-stage relative flex items-center justify-center w-full h-full min-h-0 ${
              theaterMode || isFullscreen ? '' : 'max-w-[1600px] mx-auto'
            }`}
            style={{ width: '100%', height: '100%' }}
          >
            <video
              ref={videoRef}
              poster={movie.backdrop || movie.poster}
              playsInline
              preload="auto"
              crossOrigin={availableSubtitles.length > 0 ? 'anonymous' : undefined}
              style={{ objectFit: isFullscreen ? 'contain' : videoFit, objectPosition: 'center center', filter: `brightness(${brightness}%)`, width: '100%', height: '100%' }}
              className="h-full w-full bg-black"
              onLoadStart={() => {
                setStreamStage('connecting')
                setShowBufferingOverlay(true)
              }}
              onLoadedMetadata={(e) => {
                if (startupTimerRef.current) {
                  window.clearTimeout(startupTimerRef.current)
                  startupTimerRef.current = null
                }
                const v = e.currentTarget
                setDuration(v.duration || 0)

                // Restore initial or retry playback position once metadata is ready
                if (!hasRestoredInitialTimeRef.current) {
                  hasRestoredInitialTimeRef.current = true
                  const targetResume = lastSavedTimeRef.current || initialTimeRef.current
                  if (targetResume > 0 && (!v.duration || targetResume < v.duration - 5)) {
                    try {
                      v.currentTime = targetResume
                      setCurrentTime(targetResume)
                    } catch {}
                  }
                }

                // Detect real embedded audio tracks if exposed by browser/WebView
                const vAny = v as unknown as {
                  audioTracks?: {
                    length: number
                    [index: number]: {
                      id?: string
                      label?: string
                      language?: string
                      enabled: boolean
                    }
                  }
                }
                if (vAny.audioTracks && vAny.audioTracks.length > 0) {
                  const list: DetectedAudioTrack[] = []
                  for (let i = 0; i < vAny.audioTracks.length; i++) {
                    const t = vAny.audioTracks[i]
                    list.push({
                      id: t.id || String(i),
                      label: t.label || t.language || `Audio Track ${i + 1}`,
                      language: t.language || 'und',
                      enabled: Boolean(t.enabled),
                    })
                  }
                  setDetectedAudioTracks(list)
                } else {
                  setDetectedAudioTracks([])
                }
              }}
              onProgress={() => {
                evaluateBufferAndCushion()
              }}
              onCanPlay={() => {
                if (startupTimerRef.current) {
                  window.clearTimeout(startupTimerRef.current)
                  startupTimerRef.current = null
                }
                retryCountRef.current = 0
                startupFailureRetryRef.current = 0
                // If we are holding for a mid-stream rebuffer cushion, let evaluateBufferAndCushion release it
                if (!isHoldingForCushionRef.current) {
                  setShowBufferingOverlay(false)
                  setStreamStage('ready')
                } else {
                  evaluateBufferAndCushion()
                }
              }}
              onPlay={() => {
                void ensureAudioBoost()
                setIsPlaying(true)
                if (!isHoldingForCushionRef.current) {
                  setStreamStage('ready')
                }
              }}
              onPlaying={() => {
                if (startupTimerRef.current) {
                  window.clearTimeout(startupTimerRef.current)
                  startupTimerRef.current = null
                }
                if (spinnerDebounceRef.current) {
                  window.clearTimeout(spinnerDebounceRef.current)
                  spinnerDebounceRef.current = null
                }
                setShowBufferingOverlay(false)
                setIsPlaying(true)
                setStreamStage('ready')
              }}
              onPause={() => {
                // Keep UI in playing state if we only paused briefly to accumulate a smooth rebuffer cushion
                if (!isHoldingForCushionRef.current) {
                  setIsPlaying(false)
                }
              }}
              onWaiting={() => {
                const v = videoRef.current
                if (!v) return
                const { bufferedAhead } = getContiguousBufferMetrics(v)

                // If plenty of buffer is already ahead (e.g. minor decoder hiccup), do not enter stall hold
                if (bufferedAhead >= 4.0) {
                  return
                }

                setStreamStage('buffering')
                lastBufferAdvanceAtRef.current = Date.now()

                // Automatically enable the larger recovery cushion when playback stalls.
                // The network panel remains available for users who prefer to disable it.
                setWeakNetworkSmoothMode(true)

                // Debounce spinner by 450ms so brief micro-stalls never flash an overlay
                if (spinnerDebounceRef.current) {
                  window.clearTimeout(spinnerDebounceRef.current)
                }
                spinnerDebounceRef.current = window.setTimeout(() => {
                  setShowBufferingOverlay(true)
                }, 450)

                // Activate Smart Rebuffer Hysteresis Cushion on mid-stream stalls
                if (v.currentTime > 1.5 && !isLocalOfflineStream && !isHoldingForCushionRef.current) {
                  diagStatsRef.current.bufferingCount += 1
                  stallStartedAtRef.current = Date.now()
                  isHoldingForCushionRef.current = true
                  const targetCushion = getAdaptiveResumeCushionSec()

                  logStreamDiagnostic('midstream_stall_cushion_hold', {
                    bufferingCount: diagStatsRef.current.bufferingCount,
                    bufferedAheadSec: Number(bufferedAhead.toFixed(2)),
                    targetCushionSec: targetCushion,
                    currentTimeSec: Number(v.currentTime.toFixed(1)),
                  })

                  // Pause playhead advancement briefly while HTTP 206 stream fills the safe cushion
                  try {
                    v.pause()
                  } catch {}
                }
              }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget
                setCurrentTime(v.currentTime)
                evaluateBufferAndCushion()
              }}
              onEnded={() => {
                userIntendedPlayRef.current = false
                isHoldingForCushionRef.current = false
                setShowBufferingOverlay(false)
                setIsPlaying(false)
                setShowControls(true)
              }}
              onError={(e) => {
                setIsPlaying(false)
                setShowControls(true)
                void diagnoseStreamFailure(e.currentTarget.error)
              }}
            >
              {availableSubtitles.map((sub) => (
                <track
                  key={sub.id}
                  kind="subtitles"
                  src={sub.src}
                  srcLang={sub.language}
                  label={sub.label}
                  default={sub.default}
                />
              ))}
            </video>

            {gestureHud && (
              <div className="pmf-gesture-hud pointer-events-none absolute left-5 top-1/2 z-50 -translate-y-1/2" aria-live="polite">
                <div className="flex min-w-[84px] flex-col items-center gap-2 rounded-2xl border border-white/15 bg-black/75 px-4 py-3 text-white shadow-2xl backdrop-blur-md">
                  {gestureHud.kind === 'brightness' ? <SunMedium size={23} /> : <Volume2 size={23} />}
                  <div className="text-[11px] font-black">{gestureHud.kind === 'brightness' ? `☼ ${gestureHud.value}%` : `VOL+ ${gestureHud.value}%`}</div>
                </div>
              </div>
            )}

            {/* Double-Tap Seek Feedback Ripples */}
            {doubleTapRipple === 'left' && (
              <div className="pointer-events-none absolute inset-y-0 left-0 flex w-1/3 items-center justify-center bg-white/10 backdrop-blur-[2px] rounded-r-full animate-pulse">
                <div className="flex flex-col items-center text-white">
                  <RotateCcw size={32} />
                  <span className="mt-1 text-xs font-black uppercase tracking-widest">-10s</span>
                </div>
              </div>
            )}
            {doubleTapRipple === 'right' && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex w-1/3 items-center justify-center bg-white/10 backdrop-blur-[2px] rounded-l-full animate-pulse">
                <div className="flex flex-col items-center text-white">
                  <RotateCw size={32} />
                  <span className="mt-1 text-xs font-black uppercase tracking-widest">+10s</span>
                </div>
              </div>
            )}

            {/* Controlled Debounced Loading / Buffering Indicator */}
            {showBufferingOverlay &&
              (streamStage === 'resolving' ||
                streamStage === 'connecting' ||
                streamStage === 'buffering' ||
                streamStage === 'retrying') && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px]">
                  <div className="h-14 w-14 animate-spin rounded-full border-4 border-amber-400/25 border-t-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.4)]" />
                  <span className="mt-3 text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                    {stageLabel}
                  </span>
                  {currentTime > 0 && (
                    <span className="mt-1 text-[10px] text-white/55">
                      Position preserved at {formatClock(currentTime)} • +{diagnostics.bufferedAheadSec}s
                      buffered
                    </span>
                  )}
                </div>
              )}

            {/* Actionable Stream Error Recovery Overlay */}
            {streamStage === 'error' && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-6 backdrop-blur-md"
              >
                <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-[#0c0918] p-6 text-center shadow-2xl">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
                    <AlertTriangle size={28} />
                  </div>
                  <h3 className="text-lg font-black text-white">Stream Playback Interrupted</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/65">
                    {errorDetails ||
                      'This stream is temporarily unavailable or could not be loaded on your current connection.'}
                  </p>
                  {currentTime > 0 && (
                    <p className="mt-2 text-[11px] font-semibold text-amber-300">
                      Saved playback position: {formatClock(currentTime)}
                    </p>
                  )}
                  <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={handleRetryStream}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-amber-300 active:scale-95"
                    >
                      <RefreshCw size={14} />
                      <span>Retry Stream</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClosePlayer}
                      className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/10"
                    >
                      Back
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Center Play/Pause Overlay Button when user explicitly paused */}
            {streamStage === 'ready' && !isPlaying && !isHoldingForCushionRef.current && !isLocked && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  togglePlay()
                }}
                aria-label="Play video"
                className="group flex h-20 w-20 items-center justify-center rounded-full border border-amber-400/40 bg-black/70 text-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.35)] backdrop-blur-xl transition-transform duration-300 hover:scale-110 hover:bg-amber-400 hover:text-black"
              >
                <Play size={32} fill="currentColor" className="ml-1" />
              </button>
            )}
          </div>
        )}

        {/* Settings Drawers (Speed, Real Subtitles & Audio, Network & Buffer Health, Display/Brightness) */}
        {activeDrawer !== 'none' && !isLocked && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-24 right-4 sm:right-8 z-40 w-80 rounded-2xl border border-white/15 bg-[#090714]/95 p-4 shadow-2xl backdrop-blur-2xl"
          >
            {activeDrawer === 'speed' && (
              <div>
                <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                  Playback Speed
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => changePlaybackRate(rate)}
                      className={`rounded-xl border py-2 text-xs font-bold transition ${
                        playbackRate === rate
                          ? 'border-amber-400 bg-amber-400 text-black font-black'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {rate === 1 ? '1x Normal' : `${rate}x`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeDrawer === 'network' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                    <Wifi size={12} />
                    Buffer & Network Health
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      diagnostics.networkProfile === 'fast'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : diagnostics.networkProfile === 'weak'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                    }`}
                  >
                    {diagnostics.networkProfile} link
                  </span>
                </div>

                {/* Live Buffer Runway Meter */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/60">Buffer Ahead</span>
                    <span className="font-mono font-bold text-emerald-300">
                      {diagnostics.bufferedAheadSec}s / {formatClock(diagnostics.targetBufferSec)} target
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300"
                      style={{ width: `${bufferTargetFillPercent}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-white/45">
                    <span>
                      Stream: {technicalProfile?.codecLabel || `MP4 • ~${streamBitrateKbps} kbps`}
                    </span>
                    <span>Cushion: {diagnostics.requiredCushionSec}s</span>
                  </div>
                </div>

                {/* Weak Network Smooth Mode Toggle */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-white">Weak Network Smooth Mode</p>
                      <p className="text-[10px] text-white/50">
                        Builds a {weakNetworkSmoothMode ? '12s–16s' : '6s'} safety cushion on slow mobile data to prevent 5s stalls
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWeakNetworkSmoothMode((prev) => !prev)}
                      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                        weakNetworkSmoothMode
                          ? 'bg-amber-400 text-black'
                          : 'border border-white/15 bg-white/5 text-white/70 hover:text-white'
                      }`}
                    >
                      {weakNetworkSmoothMode ? 'Active' : 'Auto'}
                    </button>
                  </div>
                </div>

                {/* HLS Adaptive Quality Selector (when HLS renditions exist) */}
                {hlsLevels.length > 1 && (
                  <div className="border-t border-white/10 pt-2.5">
                    <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-purple-300">
                      Adaptive Bitrate Rendition
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => handleSelectHlsQuality(-1)}
                        className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold transition ${
                          activeHlsLevel === -1
                            ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                            : 'border-white/10 bg-white/5 text-white/65'
                        }`}
                      >
                        Auto (Adaptive)
                      </button>
                      {hlsLevels.map((lvl) => (
                        <button
                          key={lvl.index}
                          type="button"
                          onClick={() => handleSelectHlsQuality(lvl.index)}
                          className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold transition ${
                            activeHlsLevel === lvl.index
                              ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                              : 'border-white/10 bg-white/5 text-white/65'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session Buffering Telemetry */}
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] py-1.5">
                    <div className="text-white/45">Stalls</div>
                    <div className="font-mono font-bold text-white">{diagnostics.bufferingCount}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] py-1.5">
                    <div className="text-white/45">Recovered</div>
                    <div className="font-mono font-bold text-emerald-300">
                      {diagnostics.recoveryCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] py-1.5">
                    <div className="text-white/45">Last Stall</div>
                    <div className="font-mono font-bold text-amber-300">
                      {diagnostics.lastStallDurationMs > 0
                        ? `${(diagnostics.lastStallDurationMs / 1000).toFixed(1)}s`
                        : '0.0s'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeDrawer === 'tracks' && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                    <Subtitles size={12} />
                    Subtitles & Captions
                  </p>
                  {availableSubtitles.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] text-white/50">
                      No embedded subtitle tracks in this stream source.
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      <button
                        type="button"
                        onClick={() => handleSelectSubtitle('off')}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                          activeSubtitle === 'off'
                            ? 'bg-amber-400/15 font-bold text-amber-300'
                            : 'text-white/65 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span>Subtitles Off</span>
                        {activeSubtitle === 'off' && <Check size={12} />}
                      </button>
                      {availableSubtitles.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSelectSubtitle(sub.language || sub.id)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                            activeSubtitle === (sub.language || sub.id)
                              ? 'bg-amber-400/15 font-bold text-amber-300'
                              : 'text-white/65 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span>{sub.label}</span>
                          {activeSubtitle === (sub.language || sub.id) && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-purple-300">
                    <Headphones size={12} />
                    Audio Track
                  </p>
                  {detectedAudioTracks.length <= 1 ? (
                    <div className="flex items-center justify-between rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-200">
                      <span>Original Master Audio (Stereo/AAC)</span>
                      <Check size={12} />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {detectedAudioTracks.map((aud) => (
                        <button
                          key={aud.id}
                          type="button"
                          onClick={() => handleSelectAudioTrack(aud.id)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                            activeAudioTrackId === aud.id
                              ? 'bg-purple-500/20 font-bold text-purple-200'
                              : 'text-white/65 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span>{aud.label}</span>
                          {activeAudioTrackId === aud.id && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeDrawer === 'display' && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                    <SunMedium size={12} />
                    Video Brightness ({brightness}%)
                  </p>
                  <input
                    type="range"
                    min={40}
                    max={130}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                    <Volume2 size={12} />
                    Sound Booster ({Math.round(soundBoost * 100)}%)
                  </p>
                  <input type="range" min={1} max={3} step={0.1} value={soundBoost} onPointerDown={() => { void ensureAudioBoost() }} onChange={(e) => { const next = Number(e.target.value); setSoundBoost(next); const gain = ensureAudioBoost(); if (gain) gain.gain.value = next }} className="w-full accent-amber-400 cursor-pointer" aria-label="Sound booster up to 300 percent" />
                  <p className="mt-1 text-[10px] text-white/45">Amplification depends on browser audio support and may distort at high levels.</p>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                    <Scaling size={12} />
                    Screen Fit Mode
                  </p>
                  <div className="space-y-1">
                    {VIDEO_FIT_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setVideoFit(mode.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                          videoFit === mode.id
                            ? 'bg-amber-400/15 font-bold text-amber-300'
                            : 'text-white/65 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span>{mode.label}</span>
                        {videoFit === mode.id && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Transport Controls */}
      {!isYoutube && !isLocked && (
        <div
          className={`relative z-30 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-4 pb-5 pt-6 sm:px-8 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Interactive Timeline Scrubber */}
          <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-3">
            <span className="w-12 text-right font-mono text-[11px] font-bold text-white/85">
              {formatClock(currentTime)}
            </span>

            <div className="group relative flex-1 flex items-center py-2">
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/15 transition-all group-hover:h-2.5">
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-400/35 transition-all"
                  style={{ width: `${bufferedPercentage}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 via-amber-400 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.5}
                value={currentTime}
                onChange={(e) => handleTimelineScrub(Number(e.target.value))}
                aria-label="Seek timeline"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>

            <span className="w-12 font-mono text-[11px] font-bold text-white/50">
              {formatClock(duration)}
            </span>
          </div>

          {/* Primary Buttons Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            {/* Left Transport Controls */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" className="ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => seekBy(-10)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white active:scale-90"
                aria-label="Rewind 10 seconds"
                title="Rewind 10s"
              >
                <RotateCcw size={15} />
              </button>

              <button
                type="button"
                onClick={() => seekBy(10)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white active:scale-90"
                aria-label="Forward 10 seconds"
                title="Forward 10s"
              >
                <RotateCw size={15} />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2 pl-1">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX size={16} className="text-amber-400" />
                  ) : (
                    <Volume2 size={16} />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  aria-label="Volume"
                  className="hidden sm:block w-20 accent-amber-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Right Cinema Utility Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              {nextMovieTitle && onNext && (
                <button
                  type="button"
                  onClick={onNext}
                  className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-white/75 hover:bg-white/10 hover:text-white"
                >
                  <SkipForward size={13} />
                  <span className="max-w-[140px] truncate">Next: {nextMovieTitle}</span>
                </button>
              )}

              {/* Buffer & Network Health Drawer */}
              {!isLocalOfflineStream && (
                <button
                  type="button"
                  onClick={() => setActiveDrawer((d) => (d === 'network' ? 'none' : 'network'))}
                  className={`flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-bold transition ${
                    activeDrawer === 'network' || weakNetworkSmoothMode
                      ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                      : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Buffer & Network Health"
                >
                  <Wifi size={14} />
                  <span className="hidden sm:inline">
                    {diagnostics.bufferedAheadSec > 0
                      ? `+${Math.round(diagnostics.bufferedAheadSec)}s`
                      : 'Buffer'}
                  </span>
                </button>
              )}

              {/* Audio & Subtitles */}
              <button
                type="button"
                onClick={() => setActiveDrawer((d) => (d === 'tracks' ? 'none' : 'tracks'))}
                className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-bold transition ${
                  activeDrawer === 'tracks' || activeSubtitle !== 'off'
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                    : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
                }`}
                title="Audio & Subtitles"
              >
                <Subtitles size={14} />
                <span className="hidden sm:inline">
                  {availableSubtitles.length > 0 ? 'Subtitles' : 'Audio'}
                </span>
              </button>

              {/* Playback Speed */}
              <button
                type="button"
                onClick={() => setActiveDrawer((d) => (d === 'speed' ? 'none' : 'speed'))}
                className={`flex h-9 items-center gap-1 rounded-xl border px-2.5 text-[10px] font-bold transition ${
                  activeDrawer === 'speed' || playbackRate !== 1
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                    : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
                }`}
                title="Playback Speed"
              >
                <Gauge size={14} />
                <span>{playbackRate}x</span>
              </button>

              {/* Display & Brightness */}
              <button
                type="button"
                onClick={() => setActiveDrawer((d) => (d === 'display' ? 'none' : 'display'))}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                  activeDrawer === 'display'
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                    : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
                }`}
                title="Display & Brightness"
                aria-label="Display settings"
              >
                <SunMedium size={15} />
              </button>

              {/* Picture-in-Picture */}
              <button
                type="button"
                onClick={togglePiP}
                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white"
                title="Picture in Picture"
                aria-label="Picture in Picture"
              >
                <PictureInPicture2 size={15} />
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/15 hover:text-white"
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
