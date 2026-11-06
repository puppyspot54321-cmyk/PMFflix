import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'

const OTA_MANIFEST_URL =
  'https://github.com/puppyspot54321-cmyk/PMFflix/releases/latest/download/pmf-flix-ota.json'
const OTA_RELEASE_API =
  'https://api.github.com/repos/puppyspot54321-cmyk/PMFflix/releases/tags/'
const LAST_CHECK_KEY = 'pmf_ota_last_check_at_v3'
const CHECK_INTERVAL_MS = 60 * 1000

let lastCheckAt = 0

type OtaManifest = {
  format: 2
  enabled: boolean
  appId: 'com.pmf.flix'
  version: string
  nativeMinVersion: string
  releaseTag: string
  bundleUrl: string
  sha256: string
}

type GithubRelease = {
  draft?: boolean
  prerelease?: boolean
  tag_name?: string
  assets?: Array<{
    name?: string
    digest?: string | null
    browser_download_url?: string
  }>
}

function versionParts(value: string): number[] | null {
  if (!/^\d+(\.\d+){0,3}$/.test(value)) return null
  return value.split('.').map((part) => Number(part))
}

function compareVersions(left: string, right: string): number {
  const a = versionParts(left)
  const b = versionParts(right)
  if (!a || !b) return 0

  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference > 0 ? 1 : -1
  }
  return 0
}

function isValidManifest(value: unknown): value is OtaManifest {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<OtaManifest>
  return (
    manifest.format === 2 &&
    manifest.enabled === true &&
    manifest.appId === 'com.pmf.flix' &&
    typeof manifest.version === 'string' &&
    /^\d+(\.\d+){2,3}$/.test(manifest.version) &&
    typeof manifest.nativeMinVersion === 'string' &&
    versionParts(manifest.nativeMinVersion) !== null &&
    typeof manifest.releaseTag === 'string' &&
    manifest.releaseTag === `pmf-ota-${manifest.version}` &&
    typeof manifest.bundleUrl === 'string' &&
    manifest.bundleUrl ===
      `https://github.com/puppyspot54321-cmyk/PMFflix/releases/download/${manifest.releaseTag}/pmf-flix-ota.zip` &&
    typeof manifest.sha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(manifest.sha256)
  )
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })
  if (!response.ok) {
    throw new Error(`OTA request failed with HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

function shouldCheckNow(): boolean {
  const now = Date.now()
  let storedLastCheck = 0
  try {
    storedLastCheck = Number(localStorage.getItem(LAST_CHECK_KEY) || 0)
  } catch {
    // The in-memory throttle still works if browser storage is unavailable.
  }

  const previousCheck = Math.max(
    Number.isFinite(storedLastCheck) ? storedLastCheck : 0,
    lastCheckAt,
  )
  if (now - previousCheck < CHECK_INTERVAL_MS) return false

  lastCheckAt = now
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(now))
  } catch {
    // Do not block updates when local storage is unavailable.
  }
  return true
}

/**
 * Free OTA delivery: GitHub Releases host both the ZIP and its versioned
 * manifest asset. No Capgo Cloud account or subscription is used.
 * No Capgo Cloud account or subscription is used.
 */
export async function checkForFreeOtaUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return
  }
  if (!shouldCheckNow()) return

  try {
    const manifest = await fetchJson<unknown>(OTA_MANIFEST_URL)
    if (!isValidManifest(manifest)) return

    const current = await CapacitorUpdater.current()
    const activeVersion =
      current.bundle.id === 'builtin'
        ? current.native
        : current.bundle.version

    if (
      !versionParts(current.native) ||
      !versionParts(activeVersion) ||
      compareVersions(current.native, manifest.nativeMinVersion) < 0 ||
      compareVersions(manifest.version, activeVersion) <= 0
    ) {
      return
    }

    // Confirm the public GitHub Release still has the exact asset and digest
    // named by the manifest before asking the native updater to download it.
    const release = await fetchJson<GithubRelease>(
      `${OTA_RELEASE_API}${encodeURIComponent(manifest.releaseTag)}`,
    )
    if (
      release.draft ||
      release.prerelease ||
      release.tag_name !== manifest.releaseTag
    ) {
      return
    }

    const asset = release.assets?.find(
      (item) => item.name === 'pmf-flix-ota.zip',
    )
    if (
      !asset ||
      asset.browser_download_url !== manifest.bundleUrl ||
      asset.digest?.toLowerCase() !== `sha256:${manifest.sha256.toLowerCase()}`
    ) {
      console.warn('PMF-Flix OTA asset failed its GitHub SHA-256 metadata check.')
      return
    }

    const localBundles = await CapacitorUpdater.list({ raw: true })
    const alreadyAvailable = localBundles.bundles.some(
      (bundle) =>
        bundle.version === manifest.version &&
        (bundle.status === 'success' || bundle.status === 'pending'),
    )
    if (alreadyAvailable) return

    const downloaded = await CapacitorUpdater.download({
      url: manifest.bundleUrl,
      version: manifest.version,
      checksum: manifest.sha256,
    })
    await CapacitorUpdater.next({ id: downloaded.id })
    console.info(
      `PMF-Flix OTA ${manifest.version} is ready for the next app restart.`,
    )
  } catch (error) {
    // Update failures must never prevent the existing app from opening or playing media.
    console.warn('PMF-Flix OTA check was skipped; the installed app remains active.', error)
  }
}
