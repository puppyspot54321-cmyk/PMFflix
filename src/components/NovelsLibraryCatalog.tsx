import { useState, useEffect, useRef } from 'react'
import {
  BookOpen,
  Search,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Type,
  Sun,
  Moon,
  List,
  X,
} from 'lucide-react'
import type { PMFNovel, PMFNovelChapter } from '../types/ownerContent'
import { getNovels, subscribeToContentUpdates } from '../services/ownerContentService'

interface NovelsLibraryCatalogProps {
  onOpenStudio?: () => void
}

type ReaderTheme = 'obsidian' | 'sepia' | 'light'

export default function NovelsLibraryCatalog({ onOpenStudio }: NovelsLibraryCatalogProps) {
  const [novels, setNovels] = useState<PMFNovel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('All')
  const [selectedLanguage, setSelectedLanguage] = useState('All')

  // Reading Experience State
  const [activeNovel, setActiveNovel] = useState<PMFNovel | null>(null)
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)
  const [showChapterList, setShowChapterList] = useState(false)
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('obsidian')
  const [fontSize, setFontSize] = useState<number>(17) // in px
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif')
  const [swipeHintVisible, setSwipeHintVisible] = useState(true)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const [bookmarkedChapters, setBookmarkedChapters] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('pmf_novel_bookmarks')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const loadData = async () => {
    setLoading(true)
    const data = await getNovels(true)
    setNovels(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const unsubscribe = subscribeToContentUpdates(loadData)
    return () => unsubscribe()
  }, [])

  const genres = ['All', ...Array.from(new Set(novels.map((n) => n.genre).filter(Boolean)))]
  const languages = ['All', ...Array.from(new Set(novels.map((n) => n.language).filter(Boolean)))]

  const filteredNovels = novels.filter((novel) => {
    if (selectedGenre !== 'All' && novel.genre !== selectedGenre) return false
    if (selectedLanguage !== 'All' && novel.language !== selectedLanguage) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchTitle = novel.title.toLowerCase().includes(q)
      const matchAuthor = novel.author.toLowerCase().includes(q)
      const matchDesc = novel.description.toLowerCase().includes(q)
      if (!matchTitle && !matchAuthor && !matchDesc) return false
    }
    return true
  })

  const handleOpenNovel = (novel: PMFNovel) => {
    setActiveNovel(novel)
    const savedBookmark = bookmarkedChapters[novel.id]
    if (typeof savedBookmark === 'number' && novel.chapters && novel.chapters[savedBookmark]) {
      setActiveChapterIndex(savedBookmark)
    } else {
      setActiveChapterIndex(0)
    }
  }

  const handleToggleBookmark = () => {
    if (!activeNovel) return
    const updated = { ...bookmarkedChapters, [activeNovel.id]: activeChapterIndex }
    setBookmarkedChapters(updated)
    try {
      localStorage.setItem('pmf_novel_bookmarks', JSON.stringify(updated))
    } catch {}
  }

  const currentChapters = activeNovel?.chapters || []
  const currentChapter: PMFNovelChapter | undefined = currentChapters[activeChapterIndex]

  const handleReaderTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleReaderTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start || showChapterList || !currentChapters.length) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.25) return
    setSwipeHintVisible(false)
    if (dx < 0 && activeChapterIndex < currentChapters.length - 1) setActiveChapterIndex((i) => i + 1)
    if (dx > 0 && activeChapterIndex > 0) setActiveChapterIndex((i) => i - 1)
  }

  return (
    <section className="relative min-h-[60vh] py-12 px-4 sm:px-8 lg:px-12 max-w-[1600px] mx-auto">
      {/* Header Banner */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">
            <BookOpen className="h-3.5 w-3.5 fill-amber-400" />
            PMF Licensed Literary Library
          </div>
          <h1 className="mt-1.5 text-3xl sm:text-4xl font-black text-white tracking-tight">
            PMF Novels, Serials & African Epics
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-white/50 max-w-2xl leading-relaxed">
            Authorized literary works, serialized epics, and novels distributed exclusively through the Prince Mufasa Flix publishing imprint. No AI-scraped or unauthorized books.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, author..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-4 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-amber-400/60"
            />
          </div>

          {genres.length > 2 && (
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#090714] px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
            >
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g === 'All' ? 'All Genres' : g}
                </option>
              ))}
            </select>
          )}

          {languages.length > 2 && (
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#090714] px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
            >
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l === 'All' ? 'All Languages' : l}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Grid or Honest Empty State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-white/40">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest">
            Loading literary works...
          </p>
        </div>
      ) : filteredNovels.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#070510]/80 p-12 text-center max-w-2xl mx-auto my-12 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <BookOpen className="h-8 w-8" />
          </div>

          <h3 className="mt-5 text-xl font-black text-white">
            Literary Catalogue Currently Empty
          </h3>

          <p className="mt-2.5 text-xs text-white/50 leading-relaxed max-w-md mx-auto">
            PMF-Flix only hosts novels, short stories, and manuscripts authorized and supplied directly by the owner. Random AI-generated books are never populated as placeholders.
          </p>

          {onOpenStudio && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onOpenStudio}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Open PMF Studio to Add Authorized Books</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredNovels.map((novel) => {
            const chapterCount = novel.chapters?.length || 0
            const isBookmarked = typeof bookmarkedChapters[novel.id] === 'number'

            return (
              <div
                key={novel.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#080613] p-5 transition-all duration-300 hover:border-amber-400/40 hover:shadow-[0_12px_30px_rgba(245,158,11,0.15)]"
              >
                {/* Book Cover */}
                <div
                  onClick={() => handleOpenNovel(novel)}
                  className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10 bg-black cursor-pointer mb-4"
                >
                  <img
                    src={novel.cover_url}
                    alt={novel.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.src = '/pmf-flix-icon.png'
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-75" />

                  <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                    <span className="rounded-md bg-amber-400/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">
                      {novel.genre}
                    </span>
                  </div>

                  {isBookmarked && (
                    <div className="absolute top-2.5 right-2.5 rounded-full bg-amber-400 p-1.5 text-black shadow-lg">
                      <Bookmark className="h-3.5 w-3.5 fill-black" />
                    </div>
                  )}

                  <div className="absolute bottom-2.5 left-2.5 right-2.5">
                    <p className="text-[10px] text-white/60">
                      {chapterCount} {chapterCount === 1 ? 'Chapter' : 'Chapters'} · {novel.language}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <h3
                  onClick={() => handleOpenNovel(novel)}
                  className="text-base font-black text-white cursor-pointer group-hover:text-amber-300 transition line-clamp-1"
                >
                  {novel.title}
                </h3>
                <p className="mt-0.5 text-xs text-white/50">By {novel.author}</p>

                <p className="mt-3 text-xs text-white/60 line-clamp-3 leading-relaxed flex-1">
                  {novel.description}
                </p>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => handleOpenNovel(novel)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-amber-400 hover:text-black hover:border-amber-400 transition"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>
                    {isBookmarked
                      ? `Continue Chapter ${(bookmarkedChapters[novel.id] || 0) + 1}`
                      : 'Read Edition'}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Complete Dedicated Literary Reader Modal */}
      {activeNovel && (
        <div
          className={`fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-6 backdrop-blur-2xl transition-colors duration-300 ${
            readerTheme === 'obsidian'
              ? 'bg-black/95 text-white'
              : readerTheme === 'sepia'
              ? 'bg-[#1b1511]/95 text-[#e8dfcf]'
              : 'bg-neutral-100/95 text-neutral-900'
          }`}
        >
          <div
            className={`relative flex flex-col w-full max-w-4xl h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-3xl border shadow-2xl overflow-hidden ${
              readerTheme === 'obsidian'
                ? 'bg-[#090714] border-white/15'
                : readerTheme === 'sepia'
                ? 'bg-[#2a221a] border-[#44382c]'
                : 'bg-white border-neutral-300'
            }`}
          >
            {/* Reader Header Toolbar */}
            <div
              className={`flex items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4 border-b shrink-0 ${
                readerTheme === 'obsidian'
                  ? 'border-white/10 bg-[#06040d]'
                  : readerTheme === 'sepia'
                  ? 'border-[#3f3429] bg-[#221b14]'
                  : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3 truncate min-w-0 flex-1 sm:max-w-md">
                <button
                  type="button"
                  onClick={() => setShowChapterList(!showChapterList)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-2 sm:px-3 sm:py-1.5 text-xs font-bold border-white/10 hover:bg-white/10 transition"
                  title="Table of Contents"
                >
                  <List className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Chapters</span>
                </button>

                <div className="truncate">
                  <h2 className="text-xs sm:text-sm font-black truncate">{activeNovel.title}</h2>
                  <p className="text-[10px] opacity-60">
                    {currentChapter ? currentChapter.title : 'Overview'} · By {activeNovel.author}
                  </p>
                </div>
              </div>

              {/* Reader Controls: Font Family, Font Size, Theme, Bookmark, Close */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleBookmark}
                  className={`p-2 rounded-xl border transition ${
                    bookmarkedChapters[activeNovel.id] === activeChapterIndex
                      ? 'bg-amber-400 text-black border-amber-400'
                      : 'border-white/10 opacity-70 hover:opacity-100'
                  }`}
                  title="Bookmark Chapter"
                >
                  <Bookmark className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setFontFamily(fontFamily === 'serif' ? 'sans' : 'serif')}
                  className="p-2 rounded-xl border border-white/10 text-xs font-bold hover:bg-white/10"
                  title="Toggle Serif / Sans Font"
                >
                  <Type className="h-4 w-4" />
                </button>

                {/* Font Size Buttons */}
                <button
                  type="button"
                  onClick={() => setFontSize(Math.max(14, fontSize - 1))}
                  className="px-2 py-1 rounded-xl border border-white/10 text-xs font-bold hover:bg-white/10"
                  title="Decrease Font Size"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize(Math.min(26, fontSize + 1))}
                  className="px-2 py-1 rounded-xl border border-white/10 text-xs font-bold hover:bg-white/10"
                  title="Increase Font Size"
                >
                  A+
                </button>

                {/* Theme Selector */}
                <button
                  type="button"
                  onClick={() =>
                    setReaderTheme(
                      readerTheme === 'obsidian' ? 'sepia' : readerTheme === 'sepia' ? 'light' : 'obsidian',
                    )
                  }
                  className="p-2 rounded-xl border border-white/10 text-xs hover:bg-white/10"
                  title="Cycle Reading Themes (Obsidian / Sepia / Light)"
                >
                  {readerTheme === 'light' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveNovel(null)}
                  className="p-2 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition ml-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Reading Content Area */}
            <div onTouchStart={handleReaderTouchStart} onTouchEnd={handleReaderTouchEnd} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-7 sm:p-12 lg:p-16">
              {showChapterList ? (
                <div className="max-w-xl mx-auto py-6">
                  <h3 className="text-lg font-black mb-4">Table of Contents</h3>
                  <div className="space-y-2">
                    {currentChapters.map((ch, idx) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          setActiveChapterIndex(idx)
                          setShowChapterList(false)
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition ${
                          activeChapterIndex === idx
                            ? 'bg-amber-400 text-black font-black border-amber-400'
                            : 'border-white/10 hover:bg-white/5 font-semibold'
                        }`}
                      >
                        <div>
                          <span className="text-[10px] uppercase tracking-wider block opacity-70">
                            Chapter {ch.chapter_number}
                          </span>
                          <span>{ch.title}</span>
                        </div>
                        {ch.word_count && (
                          <span className="text-xs opacity-60">{ch.word_count} words</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : currentChapter ? (
                <article
                  style={{
                    fontSize: `${fontSize}px`,
                    fontFamily: fontFamily === 'serif' ? 'Georgia, Cambria, serif' : 'system-ui, sans-serif',
                    lineHeight: '1.9',
                  }}
                  className="max-w-2xl mx-auto pb-16"
                >
                  <div className="mb-10 text-center border-b pb-8 border-current/10">
                    <span className="text-xs font-black uppercase tracking-[0.25em] opacity-60">
                      Chapter {currentChapter.chapter_number}
                    </span>
                    <h1 className="mt-2 text-2xl sm:text-3xl font-black">{currentChapter.title}</h1>
                  </div>

                  {swipeHintVisible && currentChapters.length > 1 && <p className="mb-5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] opacity-40">Swipe left for next chapter · right for previous</p>}
                  <div key={currentChapter.id} className="whitespace-pre-line leading-relaxed text-justify animate-[pmfPageIn_260ms_ease-out]">
                    {currentChapter.content}
                  </div>
                </article>
              ) : (
                <div className="max-w-xl mx-auto py-16 text-center opacity-70">
                  <BookOpen className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-black">Manuscript in Final Typesetting</h3>
                  <p className="mt-2 text-xs leading-relaxed">
                    This authorized edition is registered in the PMF-Flix library. Complete chapters will be accessible once published by the author desk.
                  </p>
                </div>
              )}
            </div>

            {/* Reader Footer Navigation */}
            {currentChapters.length > 0 && !showChapterList && (
              <div
                className={`flex items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4 border-t shrink-0 ${
                  readerTheme === 'obsidian'
                    ? 'border-white/10 bg-[#06040d]'
                    : readerTheme === 'sepia'
                    ? 'border-[#3f3429] bg-[#221b14]'
                    : 'border-neutral-200 bg-neutral-50'
                }`}
              >
                <button
                  type="button"
                  disabled={activeChapterIndex <= 0}
                  onClick={() => setActiveChapterIndex(activeChapterIndex - 1)}
                  className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl border border-current/15 text-[10px] sm:text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-current/5 transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous Chapter</span>
                </button>

                <span className="text-xs font-bold opacity-60">
                  Chapter {activeChapterIndex + 1} of {currentChapters.length}
                </span>

                <button
                  type="button"
                  disabled={activeChapterIndex >= currentChapters.length - 1}
                  onClick={() => setActiveChapterIndex(activeChapterIndex + 1)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-current/15 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-current/5 transition"
                >
                  <span className="hidden sm:inline">Next Chapter</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
