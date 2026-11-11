import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { resolveMovieStreamUrl, type Movie } from '../movieData/movies'

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed'

export interface OfflineDownload {
  movieId: string
  movie: Movie
  status: DownloadStatus
  progress: number // 0 to 100
  downloadedBytes: number
  totalBytes: number
  localUri?: string
  downloadedAt?: number
  errorMessage?: string
}

const DB_NAME = 'pmf_offline_cinema_db'
const STORE_NAME = 'video_blobs'
const DB_VERSION = 1
const META_STORAGE_KEY = 'pmf_offline_downloads_meta_v3'
const DEFAULT_PROFILE_SCOPE = 'unselected'

function safeScope(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || DEFAULT_PROFILE_SCOPE
}

class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null
  private activeAbortControllers: Map<string, AbortController> = new Map()

  private scopedDownloadKey(movieId: string | number): string {
    return `${this.activeProfileScope}:${String(movieId)}`
  }
  private activeObjectUrls: Map<string, string> = new Map()
  private listeners: Set<(downloads: OfflineDownload[]) => void> = new Set()
  private sanitizedStaleSession = false
  private activeProfileScope = DEFAULT_PROFILE_SCOPE

  /** Select the profile namespace before showing or downloading offline media. */
  public setActiveProfile(profileId: string | null | undefined): void {
    const nextScope = safeScope(profileId || DEFAULT_PROFILE_SCOPE)
    if (nextScope === this.activeProfileScope) return
    this.activeProfileScope = nextScope
    this.sanitizedStaleSession = false
    this.revokeAllPlaybackUrls()
    this.notify()
  }

  private get metaStorageKey(): string {
    return `${META_STORAGE_KEY}:${this.activeProfileScope}`
  }

  private scopedMediaKey(movieId: string | number): string {
    return `${this.activeProfileScope}:${String(movieId)}`
  }

  private nativeFileName(movieId: string | number): string {
    return `pmf_${this.activeProfileScope}_movie_${String(movieId)}.mp4`
  }

  private revokeAllPlaybackUrls(): void {
    for (const url of this.activeObjectUrls.values()) {
      try { URL.revokeObjectURL(url) } catch {}
    }
    this.activeObjectUrls.clear()
  }

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDB()
    }
    this.recoverStaleDownloadsOnStartup()
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result)
      }

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error)
      }
    })

    return this.dbPromise
  }

  private recoverStaleDownloadsOnStartup() {
    if (this.sanitizedStaleSession || typeof window === 'undefined') return
    this.sanitizedStaleSession = true
    try {
      const raw = localStorage.getItem(this.metaStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as OfflineDownload[]
      if (!Array.isArray(parsed)) return

      let modified = false
      const updated = parsed.map((item) => {
        if (
          (item.status === 'downloading' || item.status === 'queued') &&
          !this.activeAbortControllers.has(this.scopedDownloadKey(item.movieId))
        ) {
          modified = true
          return {
            ...item,
            status: 'failed' as DownloadStatus,
            errorMessage: 'Download was interrupted when the app closed. Tap Retry to download again.',
          }
        }
        return item
      })

      if (modified) {
        localStorage.setItem(this.metaStorageKey, JSON.stringify(updated))
      }
    } catch {}
  }

  public getDownloads(): OfflineDownload[] {
    this.recoverStaleDownloadsOnStartup()
    try {
      const raw = localStorage.getItem(this.metaStorageKey)
      if (!raw) return []
      const parsed = JSON.parse(raw) as OfflineDownload[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  public getDownloadById(movieId: string | number): OfflineDownload | undefined {
    const id = String(movieId)
    return this.getDownloads().find((item) => String(item.movieId) === id)
  }

  public getDownloadsCount(): number {
    return this.getDownloads().length
  }

  private saveDownloads(downloads: OfflineDownload[]) {
    try {
      localStorage.setItem(this.metaStorageKey, JSON.stringify(downloads))
    } catch (err) {
      console.warn('Failed to persist offline download metadata:', err)
    }
    this.notify()
  }

  private saveDownloadMeta(item: OfflineDownload) {
    const list = this.getDownloads()
    const index = list.findIndex((d) => String(d.movieId) === String(item.movieId))
    if (index >= 0) {
      list[index] = item
    } else {
      list.unshift(item)
    }
    this.saveDownloads(list)
  }

  public subscribe(listener: (downloads: OfflineDownload[]) => void): () => void {
    this.listeners.add(listener)
    listener(this.getDownloads())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    const current = this.getDownloads()
    this.listeners.forEach((fn) => fn(current))
  }

  public isDownloaded(movieId: string): boolean {
    const item = this.getDownloads().find((d) => String(d.movieId) === String(movieId))
    return item?.status === 'completed'
  }

  private parseTotalBytesFromHeaders(headers: Headers): number {
    const contentRange = headers.get('content-range')
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)/)
      if (match && match[1]) {
        const total = parseInt(match[1], 10)
        if (Number.isFinite(total) && total > 0) return total
      }
    }
    const contentLength = headers.get('content-length')
    if (contentLength) {
      const len = parseInt(contentLength, 10)
      if (Number.isFinite(len) && len > 0) return len
    }
    return 0
  }

  public async startDownload(movie: Movie): Promise<void> {
    const movieId = String(movie.id)
    const downloadKey = this.scopedDownloadKey(movieId)

    if (this.activeAbortControllers.has(downloadKey)) {
      return
    }

    const resolvedUrl = resolveMovieStreamUrl(movie)

    if (movie.downloadable === false) {
      this.saveDownloadMeta({
        movieId,
        movie,
        status: 'failed',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        errorMessage: 'Offline download is disabled for this title by the content owner.',
      })
      return
    }

    if (!resolvedUrl || movie.videoType === 'youtube' || /youtube\.com|youtu\.be/i.test(resolvedUrl)) {
      this.saveDownloadMeta({
        movieId,
        movie,
        status: 'failed',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        errorMessage: 'This title uses an external trailer embed and does not have a downloadable MP4 stream.',
      })
      return
    }

    const movieWithResolvedUrl: Movie = {
      ...movie,
      videoUrl: resolvedUrl,
    }

    const initialEntry: OfflineDownload = {
      movieId,
      movie: movieWithResolvedUrl,
      status: 'downloading',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
    }

    this.saveDownloadMeta(initialEntry)

    const abortController = new AbortController()
    this.activeAbortControllers.set(downloadKey, abortController)

    try {
      if (Capacitor.isNativePlatform()) {
        await this.performNativeDownload(movieWithResolvedUrl, initialEntry, abortController.signal)
      } else {
        await this.performWebDownload(movieWithResolvedUrl, initialEntry, abortController.signal)
      }
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string }
      if (errorObj?.name === 'AbortError') {
        const current = this.getDownloads().find((d) => String(d.movieId) === movieId)
        if (current && current.status !== 'paused') {
          this.saveDownloadMeta({
            ...current,
            status: 'paused',
            errorMessage: 'Download paused by user.',
          })
        }
      } else {
        const current = this.getDownloads().find((d) => String(d.movieId) === movieId) || initialEntry
        this.saveDownloadMeta({
          ...current,
          status: 'failed',
          errorMessage: errorObj?.message || 'Network connection interrupted during download.',
        })
      }
    } finally {
      this.activeAbortControllers.delete(downloadKey)
    }
  }

  /**
   * Capacitor Native Android Download Path:
   * Streams directly to app-private Directory.Data using native OS file I/O
   * without buffering hundreds of megabytes in WebView JS RAM and without downloading twice.
   */
  private async performNativeDownload(
    movie: Movie,
    entry: OfflineDownload,
    signal: AbortSignal,
  ): Promise<void> {
    const url = movie.videoUrl!
    let expectedTotalBytes = 0

    // Fast 2-byte range probe to validate stream availability and read total size
    const probeController = new AbortController()
    const onAbortProbe = () => probeController.abort()
    signal.addEventListener('abort', onAbortProbe, { once: true })

    try {
      const probeRes = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-1' },
        signal: probeController.signal,
      })

      if (!probeRes.ok && probeRes.status !== 206) {
        let serverDetail = `HTTP ${probeRes.status}`
        try {
          const errJson = await probeRes.json()
          if (errJson?.error) serverDetail = errJson.error
        } catch {}
        throw new Error(`Stream unavailable (${serverDetail})`)
      }

      const contentType = (probeRes.headers.get('content-type') || '').toLowerCase()
      if (contentType.includes('application/json') || contentType.includes('text/html')) {
        throw new Error('Server returned a webpage or JSON response instead of video media bytes.')
      }

      expectedTotalBytes = this.parseTotalBytesFromHeaders(probeRes.headers)
      // Immediately abort probe body so we don't keep the range stream open
      probeController.abort()
    } catch (probeErr: unknown) {
      if (signal.aborted) {
        const abortErr = new Error('Download aborted')
        abortErr.name = 'AbortError'
        throw abortErr
      }
      const msg = (probeErr as { message?: string })?.message || ''
      if (msg.includes('Stream unavailable') || msg.includes('instead of video media')) {
        throw probeErr
      }
      // If probe only aborted after reading headers, continue to native download
    } finally {
      signal.removeEventListener('abort', onAbortProbe)
    }

    if (expectedTotalBytes > 0) {
      this.saveDownloadMeta({
        ...entry,
        status: 'downloading',
        totalBytes: expectedTotalBytes,
      })
    }

    const fileName = this.nativeFileName(entry.movieId)
    let lastEmit = 0
    let latestDownloadedBytes = 0

    const progressHandle = await Filesystem.addListener('progress', (status) => {
      if (status.url && status.url !== url) return
      const now = Date.now()
      const total = status.contentLength > 0 ? status.contentLength : expectedTotalBytes
      latestDownloadedBytes = status.bytes
      if (now - lastEmit > 450) {
        lastEmit = now
        const pct = total > 0 ? Math.min(99, Math.round((status.bytes / total) * 100)) : 0
        this.saveDownloadMeta({
          ...entry,
          status: 'downloading',
          downloadedBytes: status.bytes,
          totalBytes: total,
          progress: pct,
        })
      }
    })

    try {
      const result = await Filesystem.downloadFile({
        url,
        path: fileName,
        directory: Directory.Data,
        progress: true,
      })

      if (signal.aborted) {
        await Filesystem.deleteFile({ path: fileName, directory: Directory.Data }).catch(() => {})
        const abortErr = new Error('Download aborted')
        abortErr.name = 'AbortError'
        throw abortErr
      }

      // Verify local file exists and has non-zero bytes before marking completed
      const stat = await Filesystem.stat({
        path: fileName,
        directory: Directory.Data,
      })

      const finalSize = stat.size || latestDownloadedBytes || expectedTotalBytes
      if (!finalSize || finalSize < 1024) {
        await Filesystem.deleteFile({ path: fileName, directory: Directory.Data }).catch(() => {})
        throw new Error('Downloaded file was empty or incomplete.')
      }

      this.saveDownloadMeta({
        ...entry,
        status: 'completed',
        progress: 100,
        downloadedBytes: finalSize,
        totalBytes: expectedTotalBytes || finalSize,
        localUri: result.path || stat.uri || fileName,
        downloadedAt: Date.now(),
        errorMessage: undefined,
      })
    } finally {
      await progressHandle.remove().catch(() => {})
    }
  }

  /**
   * Web / PWA IndexedDB Download Path:
   * Streams binary chunks into IndexedDB Blob store after validating response headers and byte counts.
   */
  private async performWebDownload(
    movie: Movie,
    entry: OfflineDownload,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await fetch(movie.videoUrl!, {
      method: 'GET',
      signal,
    })

    if (!response.ok && response.status !== 206) {
      let detail = `HTTP ${response.status}`
      try {
        const errJson = await response.json()
        if (errJson?.error) detail = errJson.error
      } catch {}
      throw new Error(`Download failed (${detail})`)
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (contentType.includes('application/json') || contentType.includes('text/html')) {
      throw new Error('Source returned JSON/HTML instead of a playable video stream.')
    }

    const totalBytes = this.parseTotalBytesFromHeaders(response.headers)

    if (!response.body) {
      const blob = await response.blob()
      if (blob.size < 1024) {
        throw new Error('Downloaded media stream was empty.')
      }
      await this.finalizeWebDownload(entry, blob, blob.size)
      return
    }

    const reader = response.body.getReader()
    const chunks: BlobPart[] = []
    let receivedBytes = 0
    let lastEmitTime = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      if (value) {
        chunks.push(new Uint8Array(value))
        receivedBytes += value.length

        const now = Date.now()
        if (now - lastEmitTime > 450) {
          lastEmitTime = now
          const progress =
            totalBytes > 0
              ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100))
              : Math.min(95, Math.round((receivedBytes / (25 * 1024 * 1024)) * 100))

          this.saveDownloadMeta({
            ...entry,
            status: 'downloading',
            progress,
            downloadedBytes: receivedBytes,
            totalBytes: totalBytes || receivedBytes,
          })
        }
      }
    }

    if (receivedBytes < 1024) {
      throw new Error('Downloaded stream ended prematurely before receiving media data.')
    }

    if (totalBytes > 0 && receivedBytes < totalBytes * 0.98) {
      throw new Error(
        `Download incomplete (${this.formatBytes(receivedBytes)} of ${this.formatBytes(totalBytes)} received). Tap Retry.`,
      )
    }

    const combinedBlob = new Blob(chunks, {
      type: response.headers.get('content-type') || 'video/mp4',
    })
    await this.finalizeWebDownload(entry, combinedBlob, receivedBytes)
  }

  private async finalizeWebDownload(entry: OfflineDownload, blob: Blob, byteSize: number) {
    const db = await this.initDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.put(blob, this.scopedMediaKey(entry.movieId))
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    // Verify the blob was stored in IndexedDB before marking completed
    const verifiedBlob = await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(this.scopedMediaKey(entry.movieId))
      req.onsuccess = () => resolve((req.result as Blob) || null)
      req.onerror = () => resolve(null)
    })

    if (!verifiedBlob || verifiedBlob.size < 1024) {
      throw new Error('Could not verify offline video storage in browser IndexedDB.')
    }

    this.saveDownloadMeta({
      ...entry,
      status: 'completed',
      progress: 100,
      downloadedBytes: byteSize,
      totalBytes: byteSize,
      localUri: `idb://${entry.movieId}`,
      downloadedAt: Date.now(),
      errorMessage: undefined,
    })
  }

  public cancelOrPauseDownload(movieId: string) {
    const id = String(movieId)
    const downloadKey = this.scopedDownloadKey(id)
    const controller = this.activeAbortControllers.get(downloadKey)
    if (controller) {
      controller.abort()
      this.activeAbortControllers.delete(downloadKey)
    }
    const current = this.getDownloads().find((d) => String(d.movieId) === id)
    if (current && current.status === 'downloading') {
      this.saveDownloadMeta({
        ...current,
        status: 'paused',
        errorMessage: 'Download paused.',
      })
    }
  }

  public revokePlaybackUrl(movieId: string) {
    const id = String(movieId)
    const existingUrl = this.activeObjectUrls.get(id)
    if (existingUrl) {
      try {
        URL.revokeObjectURL(existingUrl)
      } catch {}
      this.activeObjectUrls.delete(id)
    }
  }

  public async removeDownload(movieId: string): Promise<void> {
    const id = String(movieId)
    this.cancelOrPauseDownload(id)
    this.revokePlaybackUrl(id)

    const list = this.getDownloads().filter((d) => String(d.movieId) !== id)
    this.saveDownloads(list)

    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.deleteFile({
          path: this.nativeFileName(id),
          directory: Directory.Data,
        })
      } catch {}
    }

    try {
      const db = await this.initDB()
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        store.delete(this.scopedMediaKey(id))
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      })
    } catch {}
  }

  public async getPlaybackUrl(movieId: string): Promise<string | null> {
    const id = String(movieId)
    const entry = this.getDownloads().find((d) => String(d.movieId) === id)
    if (!entry || entry.status !== 'completed') return null

    if (Capacitor.isNativePlatform()) {
      try {
        const stat = await Filesystem.stat({
          path: this.nativeFileName(id),
          directory: Directory.Data,
        })
        if (stat.uri && (!stat.size || stat.size >= 1024)) {
          return Capacitor.convertFileSrc(stat.uri)
        }
      } catch {}
    }

    try {
      const db = await this.initDB()
      const blob = await new Promise<Blob | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.get(this.scopedMediaKey(id))
        req.onsuccess = () => resolve((req.result as Blob) || null)
        req.onerror = () => resolve(null)
      })

      if (blob && blob.size >= 1024) {
        this.revokePlaybackUrl(id)
        const objectUrl = URL.createObjectURL(blob)
        this.activeObjectUrls.set(id, objectUrl)
        return objectUrl
      }
    } catch {}

    return null
  }

  public formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(0)} KB`
    }
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`
    }
    return `${mb.toFixed(1)} MB`
  }
}

export const offlineStorage = new OfflineStorageService()
