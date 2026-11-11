import { supabase } from '../supabase'
import type {
  PMFShortContent,
  PMFNovel,
  PMFNovelChapter,
  PMFSportsEvent,
  ContentStatus,
} from '../types/ownerContent'

const SKITS_STORAGE_KEY = 'pmf_owner_short_content_v1'
const NOVELS_STORAGE_KEY = 'pmf_owner_novels_v1'
const CHAPTERS_STORAGE_KEY = 'pmf_owner_chapters_v1'
const SPORTS_STORAGE_KEY = 'pmf_owner_sports_events_v1'

type ContentListener = () => void
const listeners: Set<ContentListener> = new Set()

export const subscribeToContentUpdates = (listener: ContentListener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const notifyContentListeners = () => {
  listeners.forEach((cb) => {
    try {
      cb()
    } catch (e) {
      console.error('Error notifying content update listener:', e)
    }
  })
}

// Local storage helpers - strictly owner-controlled
const filterOutDemoContent = <T extends { id: string }>(items: T[]): T[] => {
  const demoPrefixes = [
    'skit-genesis',
    'skit-lagos',
    'skit-cinema',
    'skit-kings',
    'novel-lion',
    'novel-lagoon',
    'chap-sahel',
    'chap-lagoon',
    'sport-npfl',
    'sport-caf',
    'sport-mma',
  ]
  return items.filter((item) => !demoPrefixes.some((p) => item.id.startsWith(p)))
}

const getStored = <T extends { id: string }>(key: string, defaultValue: T[]): T[] => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultValue
    const parsed = JSON.parse(raw) as T[]
    return filterOutDemoContent(parsed)
  } catch {
    return defaultValue
  }
}

const setStored = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error(`Error saving to localStorage [${key}]:`, e)
  }
}

// ============================================================================
// 1. SHORT-FORM CONTENT (COMEDY SKITS & NEWS CLIPS) - OWNER ONLY
// ============================================================================

export const getShortContent = async (onlyPublished = true): Promise<PMFShortContent[]> => {
  // 1. Attempt Supabase fetch
  try {
    const query = supabase
      .from('pmf_short_skits')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (onlyPublished) {
      query.eq('status', 'published')
    }

    const { data, error } = await query
    if (!error && data && data.length > 0) {
      return filterOutDemoContent(data as PMFShortContent[])
    }
  } catch {
    // Supabase table may not exist yet or offline
  }

  // 2. Fallback to owner local store (strictly real owner items, NO hardcoded demo videos)
  const localItems = getStored<PMFShortContent>(SKITS_STORAGE_KEY, [])
  if (onlyPublished) {
    return localItems.filter((item) => item.status === 'published')
  }
  return localItems
}

export const saveShortContent = async (
  item: Omit<PMFShortContent, 'id' | 'created_at' | 'updated_at'> & { id?: string },
): Promise<PMFShortContent> => {
  const now = new Date().toISOString()
  const existing = getStored<PMFShortContent>(SKITS_STORAGE_KEY, [])

  let savedItem: PMFShortContent

  if (item.id) {
    savedItem = {
      ...item,
      id: item.id,
      created_at: existing.find((x) => x.id === item.id)?.created_at || now,
      updated_at: now,
    } as PMFShortContent
    const index = existing.findIndex((x) => x.id === item.id)
    if (index >= 0) {
      existing[index] = savedItem
    } else {
      existing.unshift(savedItem)
    }
  } else {
    savedItem = {
      ...item,
      id: `skit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: now,
      updated_at: now,
    } as PMFShortContent
    existing.unshift(savedItem)
  }

  setStored(SKITS_STORAGE_KEY, existing)

  try {
    await supabase.from('pmf_short_skits').upsert(savedItem)
  } catch {}

  notifyContentListeners()
  return savedItem
}

export const setShortContentStatus = async (
  id: string,
  status: ContentStatus,
): Promise<void> => {
  const existing = getStored<PMFShortContent>(SKITS_STORAGE_KEY, [])
  const item = existing.find((x) => x.id === id)
  if (item) {
    item.status = status
    item.updated_at = new Date().toISOString()
    setStored(SKITS_STORAGE_KEY, existing)
    try {
      await supabase.from('pmf_short_skits').update({ status, updated_at: item.updated_at }).eq('id', id)
    } catch {}
    notifyContentListeners()
  }
}

export const deleteShortContent = async (id: string): Promise<void> => {
  const existing = getStored<PMFShortContent>(SKITS_STORAGE_KEY, [])
  setStored(
    SKITS_STORAGE_KEY,
    existing.filter((x) => x.id !== id),
  )
  try {
    await supabase.from('pmf_short_skits').delete().eq('id', id)
  } catch {}
  notifyContentListeners()
}

// ============================================================================
// 2. PMF NOVELS & STORIES (LICENSED LITERARY LIBRARY) - OWNER ONLY
// ============================================================================

export const getNovels = async (onlyPublished = true): Promise<PMFNovel[]> => {
  try {
    const query = supabase
      .from('pmf_novels')
      .select('*, chapters:pmf_novel_chapters(*)')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (onlyPublished) {
      query.eq('status', 'published')
    }

    const { data, error } = await query
    if (!error && data && data.length > 0) {
      return filterOutDemoContent(data as PMFNovel[])
    }
  } catch {}

  // Fallback to local store
  const storedNovels = getStored<PMFNovel>(NOVELS_STORAGE_KEY, [])
  const chapters = getStored<PMFNovelChapter>(CHAPTERS_STORAGE_KEY, [])

  const novels = storedNovels.map((novel) => ({
    ...novel,
    chapters: chapters
      .filter((ch) => ch.novel_id === novel.id)
      .sort((a, b) => a.chapter_number - b.chapter_number),
  }))

  if (onlyPublished) {
    return novels.filter((n) => n.status === 'published')
  }
  return novels
}

export const saveNovel = async (
  item: Omit<PMFNovel, 'id' | 'created_at' | 'updated_at' | 'chapters'> & { id?: string },
): Promise<PMFNovel> => {
  const now = new Date().toISOString()
  const existing = getStored<PMFNovel>(NOVELS_STORAGE_KEY, [])

  let savedItem: PMFNovel

  if (item.id) {
    savedItem = {
      ...item,
      id: item.id,
      created_at: existing.find((x) => x.id === item.id)?.created_at || now,
      updated_at: now,
    }
    const index = existing.findIndex((x) => x.id === item.id)
    if (index >= 0) {
      existing[index] = savedItem
    } else {
      existing.unshift(savedItem)
    }
  } else {
    savedItem = {
      ...item,
      id: `novel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: now,
      updated_at: now,
    }
    existing.unshift(savedItem)
  }

  setStored(NOVELS_STORAGE_KEY, existing)

  try {
    const payload = { ...savedItem } as Record<string, unknown>
    delete payload.chapters
    await supabase.from('pmf_novels').upsert(payload)
  } catch {}

  notifyContentListeners()
  return savedItem
}

export const setNovelStatus = async (id: string, status: ContentStatus): Promise<void> => {
  const existing = getStored<PMFNovel>(NOVELS_STORAGE_KEY, [])
  const item = existing.find((x) => x.id === id)
  if (item) {
    item.status = status
    item.updated_at = new Date().toISOString()
    setStored(NOVELS_STORAGE_KEY, existing)
    try {
      await supabase.from('pmf_novels').update({ status, updated_at: item.updated_at }).eq('id', id)
    } catch {}
    notifyContentListeners()
  }
}

export const deleteNovel = async (id: string): Promise<void> => {
  const existing = getStored<PMFNovel>(NOVELS_STORAGE_KEY, [])
  setStored(
    NOVELS_STORAGE_KEY,
    existing.filter((x) => x.id !== id),
  )
  const existingChapters = getStored<PMFNovelChapter>(CHAPTERS_STORAGE_KEY, [])
  setStored(
    CHAPTERS_STORAGE_KEY,
    existingChapters.filter((c) => c.novel_id !== id),
  )
  try {
    await supabase.from('pmf_novel_chapters').delete().eq('novel_id', id)
    await supabase.from('pmf_novels').delete().eq('id', id)
  } catch {}
  notifyContentListeners()
}

export const saveChapter = async (
  chapter: Omit<PMFNovelChapter, 'id' | 'created_at' | 'updated_at'> & { id?: string },
): Promise<PMFNovelChapter> => {
  const now = new Date().toISOString()
  const existing = getStored<PMFNovelChapter>(CHAPTERS_STORAGE_KEY, [])

  let savedChapter: PMFNovelChapter

  if (chapter.id) {
    savedChapter = {
      ...chapter,
      id: chapter.id,
      created_at: existing.find((x) => x.id === chapter.id)?.created_at || now,
      updated_at: now,
      word_count: chapter.content.trim().split(/\s+/).length,
    }
    const idx = existing.findIndex((x) => x.id === chapter.id)
    if (idx >= 0) {
      existing[idx] = savedChapter
    } else {
      existing.push(savedChapter)
    }
  } else {
    savedChapter = {
      ...chapter,
      id: `chap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: now,
      updated_at: now,
      word_count: chapter.content.trim().split(/\s+/).length,
    }
    existing.push(savedChapter)
  }

  setStored(CHAPTERS_STORAGE_KEY, existing)

  try {
    await supabase.from('pmf_novel_chapters').upsert(savedChapter)
  } catch {}

  notifyContentListeners()
  return savedChapter
}

export const deleteChapter = async (chapterId: string): Promise<void> => {
  const existing = getStored<PMFNovelChapter>(CHAPTERS_STORAGE_KEY, [])
  setStored(
    CHAPTERS_STORAGE_KEY,
    existing.filter((x) => x.id !== chapterId),
  )
  try {
    await supabase.from('pmf_novel_chapters').delete().eq('id', chapterId)
  } catch {}
  notifyContentListeners()
}

// ============================================================================
// 3. LIVE SPORTS & BROADCASTS - OWNER ONLY
// ============================================================================

export const getSportsEvents = async (onlyPublished = true): Promise<PMFSportsEvent[]> => {
  try {
    const query = supabase
      .from('pmf_sports_events')
      .select('*')
      .order('scheduled_start', { ascending: true })

    if (onlyPublished) {
      query.eq('status', 'published')
    }

    const { data, error } = await query
    if (!error && data && data.length > 0) {
      return filterOutDemoContent(data as PMFSportsEvent[])
    }
  } catch {}

  const localItems = getStored<PMFSportsEvent>(SPORTS_STORAGE_KEY, [])
  if (onlyPublished) {
    return localItems.filter((e) => e.status === 'published')
  }
  return localItems
}

export const saveSportsEvent = async (
  item: Omit<PMFSportsEvent, 'id' | 'created_at' | 'updated_at'> & { id?: string },
): Promise<PMFSportsEvent> => {
  const now = new Date().toISOString()
  const existing = getStored<PMFSportsEvent>(SPORTS_STORAGE_KEY, [])

  let savedItem: PMFSportsEvent

  if (item.id) {
    savedItem = {
      ...item,
      id: item.id,
      created_at: existing.find((x) => x.id === item.id)?.created_at || now,
      updated_at: now,
    } as PMFSportsEvent
    const idx = existing.findIndex((x) => x.id === item.id)
    if (idx >= 0) {
      existing[idx] = savedItem
    } else {
      existing.unshift(savedItem)
    }
  } else {
    savedItem = {
      ...item,
      id: `sport-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: now,
      updated_at: now,
    } as PMFSportsEvent
    existing.unshift(savedItem)
  }

  setStored(SPORTS_STORAGE_KEY, existing)

  try {
    await supabase.from('pmf_sports_events').upsert(savedItem)
  } catch {}

  notifyContentListeners()
  return savedItem
}

export const setSportsEventStatus = async (
  id: string,
  event_status: PMFSportsEvent['event_status'],
): Promise<void> => {
  const existing = getStored<PMFSportsEvent>(SPORTS_STORAGE_KEY, [])
  const item = existing.find((x) => x.id === id)
  if (item) {
    item.event_status = event_status
    item.updated_at = new Date().toISOString()
    setStored(SPORTS_STORAGE_KEY, existing)
    try {
      await supabase.from('pmf_sports_events').update({ event_status, updated_at: item.updated_at }).eq('id', id)
    } catch {}
    notifyContentListeners()
  }
}

export const deleteSportsEvent = async (id: string): Promise<void> => {
  const existing = getStored<PMFSportsEvent>(SPORTS_STORAGE_KEY, [])
  setStored(
    SPORTS_STORAGE_KEY,
    existing.filter((x) => x.id !== id),
  )
  try {
    await supabase.from('pmf_sports_events').delete().eq('id', id)
  } catch {}
  notifyContentListeners()
}
