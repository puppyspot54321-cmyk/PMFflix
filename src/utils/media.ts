import type {
  StreamingProtocol,
  VideoAsset,
  VideoQuality,
} from '../types/media'

const QUALITY_ORDER: VideoQuality[] = [
  '480p',
  '720p',
  '1080p',
  '1440p',
  '4k',
]

export function sortVideoAssets(
  assets: VideoAsset[],
): VideoAsset[] {
  return [...assets].sort(
    (a, b) =>
      QUALITY_ORDER.indexOf(a.quality) -
      QUALITY_ORDER.indexOf(b.quality),
  )
}

export function getBestVideoAsset(
  assets: VideoAsset[],
): VideoAsset | undefined {
  const sortedAssets = sortVideoAssets(assets)

  return sortedAssets.at(-1)
}

export function getVideoAsset(
  assets: VideoAsset[],
  quality: VideoQuality,
): VideoAsset | undefined {
  return assets.find(
    (asset) => asset.quality === quality,
  )
}

export function isStreamingProtocol(
  protocol: StreamingProtocol,
): boolean {
  return (
    protocol === 'hls' ||
    protocol === 'dash'
  )
}

export function hasMultipleQualities(
  assets: VideoAsset[],
): boolean {
  const qualities = new Set(
    assets.map((asset) => asset.quality),
  )

  return qualities.size > 1
}
