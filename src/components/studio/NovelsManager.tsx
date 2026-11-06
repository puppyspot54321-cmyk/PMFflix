import { useState, useEffect } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  Check,
  AlertCircle,
  Loader2,
  X,
  List,
  Upload,
} from 'lucide-react'
import type { PMFNovel, PMFNovelChapter, ContentStatus } from '../../types/ownerContent'
import {
  getNovels,
  saveNovel,
  setNovelStatus,
  deleteNovel,
  saveChapter,
  deleteChapter,
} from '../../services/ownerContentService'

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-amber-400/60 focus:bg-white/[0.07]'

const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'

export default function NovelsManager() {
  const [novels, setNovels] = useState<PMFNovel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  // Novel Form State
  const [showNovelModal, setShowNovelModal] = useState(false)
  const [editingNovelId, setEditingNovelId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [genre, setGenre] = useState('Epic Fiction')
  const [language, setLanguage] = useState('English')
  const [publicationYear, setPublicationYear] = useState<number>(2026)
  const [rightsNotes, setRightsNotes] = useState('')
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [featured, setFeatured] = useState(false)
  const [displayOrder, setDisplayOrder] = useState(0)

  // Chapter Manager State
  const [managingChaptersNovel, setManagingChaptersNovel] = useState<PMFNovel | null>(null)
  const [showChapterModal, setShowChapterModal] = useState(false)
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [chapterNumber, setChapterNumber] = useState<number>(1)
  const [chapterTitle, setChapterTitle] = useState('')
  const [chapterContent, setChapterContent] = useState('')
  const [chapterStatus, setChapterStatus] = useState<ContentStatus>('published')

  const loadData = async () => {
    setLoading(true)
    const data = await getNovels(false) // fetch all, including drafts
    setNovels(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const resetNovelForm = () => {
    setTitle('')
    setAuthor('')
    setDescription('')
    setCoverUrl('')
    setGenre('Epic Fiction')
    setLanguage('English')
    setPublicationYear(2026)
    setRightsNotes('')
    setStatus('draft')
    setFeatured(false)
    setDisplayOrder(0)
    setEditingNovelId(null)
    setShowNovelModal(false)
    setError('')
  }

  const handleOpenCreateNovel = () => {
    resetNovelForm()
    setShowNovelModal(true)
  }

  const handleOpenEditNovel = (novel: PMFNovel) => {
    setEditingNovelId(novel.id)
    setTitle(novel.title)
    setAuthor(novel.author)
    setDescription(novel.description)
    setCoverUrl(novel.cover_url)
    setGenre(novel.genre)
    setLanguage(novel.language)
    setPublicationYear(novel.publication_year || 2026)
    setRightsNotes(novel.rights_notes || '')
    setStatus(novel.status)
    setFeatured(novel.featured)
    setDisplayOrder(novel.display_order)
    setError('')
    setShowNovelModal(true)
  }

  const handleSaveNovel = async (saveAsStatus?: ContentStatus) => {
    setError('')
    setNotice('')

    if (!title.trim()) {
      setError('Title is mandatory.')
      return
    }
    if (!author.trim()) {
      setError('Author name is mandatory.')
      return
    }
    if (!coverUrl.trim()) {
      setError('Cover image URL is mandatory.')
      return
    }

    setSaving(true)
    try {
      const targetStatus = saveAsStatus || status

      await saveNovel({
        id: editingNovelId || undefined,
        title: title.trim(),
        author: author.trim(),
        description: description.trim(),
        cover_url: coverUrl.trim(),
        genre: genre.trim() || 'Fiction',
        language: language.trim() || 'English',
        publication_year: Number(publicationYear) || 2026,
        rights_notes: rightsNotes.trim(),
        status: targetStatus,
        featured,
        display_order: Number(displayOrder) || 0,
      })

      setNotice(
        editingNovelId
          ? `Updated "${title}" (${targetStatus.toUpperCase()}).`
          : `Created "${title}" as ${targetStatus.toUpperCase()}.`,
      )
      resetNovelForm()
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to save novel entry.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleNovelStatus = async (novel: PMFNovel, nextStatus: ContentStatus) => {
    try {
      await setNovelStatus(novel.id, nextStatus)
      setNotice(`Updated "${novel.title}" to ${nextStatus.toUpperCase()}`)
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to update status.')
    }
  }

  const handleDeleteNovel = async (novel: PMFNovel) => {
    if (!window.confirm(`Permanently delete "${novel.title}" and all its chapters?`)) {
      return
    }
    try {
      await deleteNovel(novel.id)
      setNotice(`Deleted "${novel.title}".`)
      if (managingChaptersNovel?.id === novel.id) {
        setManagingChaptersNovel(null)
      }
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to delete novel.')
    }
  }

  // Import a complete TXT/Markdown manuscript and create chapters from clear headings.
  // Supported headings include "Chapter 1", "CHAPTER ONE", "Part II", and Markdown headings.
  const handleFullManuscriptImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !managingChaptersNovel) return
    if (!/\.(txt|md)$/i.test(file.name)) {
      setError('Please choose a .txt or .md manuscript file.')
      return
    }
    if (managingChaptersNovel.chapters?.length && !window.confirm(
      'This book already has chapters. Import will ADD chapters after the existing sequence; it will not replace or delete anything. Continue?'
    )) return

    setError('')
    setNotice('')
    setSaving(true)
    try {
      const raw = await file.text()
      const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
      if (!normalized) throw new Error('The selected manuscript file is empty.')

      // Split only on explicit, standalone chapter/part headings so ordinary prose stays intact.
      const lines = normalized.split('\n')
      const headingPattern = /^\s*(?:#{1,3}\s*)?(?:(?:chapter|part|book|section)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[a-z]+)(?:\s*[:.\-–—]?\s*.*)?|prologue|epilogue|preface|foreword|afterword)\s*$/i
      const sections: { title: string; lines: string[] }[] = []
      let current: { title: string; lines: string[] } | null = null
      for (const line of lines) {
        if (headingPattern.test(line.trim()) && line.trim().length < 120) {
          if (current) sections.push(current)
          current = { title: line.trim().replace(/^#+\s*/, ''), lines: [] }
        } else {
          if (!current) current = { title: '', lines: [] }
          current.lines.push(line)
        }
      }
      if (current) sections.push(current)
      const usable = sections.map(s => ({ title: s.title.trim(), content: s.lines.join('\n').trim() })).filter(s => s.content)
      const hasExplicitHeadings = sections.some(s => Boolean(s.title))
      const chunks = hasExplicitHeadings ? usable : [{ title: file.name.replace(/\.(txt|md)$/i, ''), content: normalized }]
      if (!chunks.length) throw new Error('No readable manuscript text was found.')

      const startNumber = (managingChaptersNovel.chapters?.length || 0) + 1
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index]
        const numberedTitle = chunk.title || `Chapter ${startNumber + index}`
        await saveChapter({
          novel_id: managingChaptersNovel.id,
          chapter_number: startNumber + index,
          title: numberedTitle,
          content: chunk.content,
          status: 'draft',
        })
      }
      setNotice(`Imported ${chunks.length} chapter${chunks.length === 1 ? '' : 's'} from ${file.name} as DRAFT. Review chapter titles and publish only when ready.`)
      const refreshed = await getNovels(false)
      setNovels(refreshed)
      setManagingChaptersNovel(refreshed.find(n => n.id === managingChaptersNovel.id) || null)
    } catch (err: any) {
      setError(err?.message || 'Could not import this manuscript.')
    } finally {
      setSaving(false)
    }
  }

  // Chapter management handlers
  const handleOpenChapters = (novel: PMFNovel) => {
    setManagingChaptersNovel(novel)
  }

  const handleOpenAddChapter = () => {
    if (!managingChaptersNovel) return
    const nextNum = (managingChaptersNovel.chapters?.length || 0) + 1
    setEditingChapterId(null)
    setChapterNumber(nextNum)
    setChapterTitle(`Chapter ${nextNum}: `)
    setChapterContent('')
    setChapterStatus('published')
    setShowChapterModal(true)
  }

  const handleOpenEditChapter = (chapter: PMFNovelChapter) => {
    setEditingChapterId(chapter.id)
    setChapterNumber(chapter.chapter_number)
    setChapterTitle(chapter.title)
    setChapterContent(chapter.content)
    setChapterStatus(chapter.status)
    setShowChapterModal(true)
  }

  const handleSaveChapter = async () => {
    if (!managingChaptersNovel) return
    if (!chapterTitle.trim()) {
      setError('Chapter title is mandatory.')
      return
    }
    if (!chapterContent.trim()) {
      setError('Chapter manuscript content cannot be empty.')
      return
    }

    setSaving(true)
    try {
      await saveChapter({
        id: editingChapterId || undefined,
        novel_id: managingChaptersNovel.id,
        chapter_number: Number(chapterNumber) || 1,
        title: chapterTitle.trim(),
        content: chapterContent.trim(),
        status: chapterStatus,
      })

      setNotice(`Saved chapter "${chapterTitle}".`)
      setShowChapterModal(false)
      const refreshed = await getNovels(false)
      setNovels(refreshed)
      const updatedManaging = refreshed.find((n) => n.id === managingChaptersNovel.id) || null
      setManagingChaptersNovel(updatedManaging)
    } catch (err: any) {
      setError(err?.message || 'Failed to save chapter.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteChapter = async (chapter: PMFNovelChapter) => {
    if (!window.confirm(`Delete "${chapter.title}"?`)) return
    try {
      await deleteChapter(chapter.id)
      setNotice(`Deleted chapter.`)
      const refreshed = await getNovels(false)
      setNovels(refreshed)
      if (managingChaptersNovel) {
        setManagingChaptersNovel(refreshed.find((n) => n.id === managingChaptersNovel.id) || null)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete chapter.')
    }
  }

  // Handle manuscript file upload (.txt, .md)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text === 'string') {
        setChapterContent(text)
        if (!chapterTitle || chapterTitle.startsWith('Chapter')) {
          setChapterTitle(file.name.replace(/\.[^/.]+$/, ''))
        }
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-xl font-black text-white">PMF Novels & Literary Imprint Manager</h2>
          <p className="text-xs text-white/50">
            Publish authorized serialized novels, epics, and manuscripts with complete chapter sequencing and rights tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateNovel}
          className={`${buttonClass} bg-amber-400 text-black hover:bg-amber-300 shadow-lg shadow-amber-400/20`}
        >
          <Plus className="h-4 w-4" />
          <span>Add Novel or Serial</span>
        </button>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-xs font-bold text-emerald-300 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-xs font-bold text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Novel Modal */}
      {showNovelModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#090715] p-6 sm:p-8 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <h3 className="text-lg font-black text-white">
                {editingNovelId ? 'Edit Literary Work' : 'Register New Novel'}
              </h3>
              <button
                type="button"
                onClick={resetNovelForm}
                className="rounded-xl border border-white/10 p-2 text-white/50 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Book Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chronicles of the Palm Citadel"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Author / Storyteller *
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="e.g. Prince Mufasa / Author Name"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Genre / Category *
                  </label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="e.g. Historical Fiction, Afrofuturism, Romance"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Language
                  </label>
                  <input
                    type="text"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="English"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Publication Year
                  </label>
                  <input
                    type="number"
                    value={publicationYear}
                    onChange={(e) => setPublicationYear(parseInt(e.target.value) || 2026)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Book Cover Image URL *
                </label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://... cover image URL"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Synopsis / Book Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Compelling overview of the novel or narrative arc..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Rights & Licensing Notes (Administrative Reference)
                </label>
                <input
                  type="text"
                  value={rightsNotes}
                  onChange={(e) => setRightsNotes(e.target.value)}
                  placeholder="e.g. Exclusive worldwide digital publishing license held by PMF Media"
                  className={inputClass}
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white/80">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-400"
                  />
                  <span>Feature on Homepage Literary Carousel</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/60">Status:</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ContentStatus)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                  >
                    <option value="draft">Draft (Private)</option>
                    <option value="published">Published (Public)</option>
                    <option value="archived">Archived (Hidden)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveNovel('draft')}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Save Draft
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveNovel('published')}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 disabled:opacity-50 shadow-lg"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{editingNovelId ? 'Update & Publish' : 'Approve & Publish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chapter Manager Drawer / Modal */}
      {managingChaptersNovel && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#090715] p-6 sm:p-8 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Chapter Sequence Manager
                </span>
                <h3 className="text-xl font-black text-white">{managingChaptersNovel.title}</h3>
                <p className="text-xs text-white/50">By {managingChaptersNovel.author}</p>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/20">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{saving ? 'Importing…' : 'Import Full TXT/MD'}</span>
                  <input type="file" accept=".txt,.md,text/plain,text/markdown" disabled={saving} onChange={handleFullManuscriptImport} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={handleOpenAddChapter}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-black hover:bg-amber-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Chapter</span>
                </button>

                <button
                  type="button"
                  onClick={() => setManagingChaptersNovel(null)}
                  className="rounded-xl border border-white/10 p-2 text-white/50 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Chapter List */}
            {(!managingChaptersNovel.chapters || managingChaptersNovel.chapters.length === 0) ? (
              <div className="py-12 text-center text-white/40">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-60" />
                <p className="text-sm font-bold">No chapters created yet for this novel.</p>
                <p className="text-xs mt-1">Import a complete .txt/.md manuscript to create chapters automatically, or add a chapter manually.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {managingChaptersNovel.chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-400/20 px-2 py-0.5 font-mono text-[10px] font-black text-amber-300">
                          CH #{ch.chapter_number}
                        </span>
                        <h4 className="font-bold text-sm text-white">{ch.title}</h4>
                      </div>
                      <p className="text-[11px] text-white/40 mt-1">
                        {ch.word_count || ch.content.split(/\s+/).length} words · Status: {ch.status}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditChapter(ch)}
                        className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
                        title="Edit Manuscript"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteChapter(ch)}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-500/20"
                        title="Delete Chapter"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chapter Edit Modal */}
      {showChapterModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-4 backdrop-blur-2xl">
          <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#090715] p-6 sm:p-8 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <h3 className="text-lg font-black text-white">
                {editingChapterId ? 'Edit Chapter Content' : 'Add New Chapter'}
              </h3>
              <button
                type="button"
                onClick={() => setShowChapterModal(false)}
                className="rounded-xl border border-white/10 p-2 text-white/50 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Chapter # *
                  </label>
                  <input
                    type="number"
                    value={chapterNumber}
                    onChange={(e) => setChapterNumber(parseInt(e.target.value) || 1)}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Chapter Title *
                  </label>
                  <input
                    type="text"
                    value={chapterTitle}
                    onChange={(e) => setChapterTitle(e.target.value)}
                    placeholder="e.g. Chapter 1: The Whispering Savannah"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                    Manuscript Content *
                  </label>

                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 cursor-pointer hover:underline">
                    <Upload className="h-3 w-3" />
                    <span>Upload .txt/.md Manuscript File</span>
                    <input
                      type="file"
                      accept=".txt,.md"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  rows={14}
                  value={chapterContent}
                  onChange={(e) => setChapterContent(e.target.value)}
                  placeholder="Paste or type complete chapter text here..."
                  className={`${inputClass} font-serif leading-relaxed`}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-white/40">
                  Estimated words: {chapterContent.trim() ? chapterContent.trim().split(/\s+/).length : 0}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/60">Status:</span>
                  <select
                    value={chapterStatus}
                    onChange={(e) => setChapterStatus(e.target.value as ContentStatus)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setShowChapterModal(false)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveChapter}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 disabled:opacity-50 shadow-lg"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Chapter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Novels List Table */}
      {loading ? (
        <div className="py-12 text-center text-white/40">Loading literary catalogue...</div>
      ) : novels.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/40">
          No novels registered yet. Click &ldquo;Add Novel or Serial&rdquo; to publish your first authorized book.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.04] text-[10px] font-black uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-4 py-3">Cover</th>
                <th className="px-4 py-3">Title & Author</th>
                <th className="px-4 py-3">Genre / Language</th>
                <th className="px-4 py-3">Chapters</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {novels.map((novel) => {
                const chapterCount = novel.chapters?.length || 0

                return (
                  <tr key={novel.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <img
                        src={novel.cover_url}
                        alt={novel.title}
                        className="h-14 w-10 rounded-lg object-cover bg-black"
                        onError={(e) => (e.currentTarget.src = '/pmf-flix-icon.png')}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-white text-sm">{novel.title}</div>
                      <div className="text-[11px] text-white/50">By {novel.author} ({novel.publication_year})</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white/80 font-medium">{novel.genre}</div>
                      <div className="text-[10px] text-white/40">{novel.language}</div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleOpenChapters(novel)}
                        className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-white/10 border border-white/10"
                      >
                        <List className="h-3 w-3" />
                        <span>{chapterCount} Chapters</span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          novel.status === 'published'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : novel.status === 'draft'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-neutral-500/20 text-neutral-300 border border-neutral-500/30'
                        }`}
                      >
                        {novel.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {novel.status !== 'published' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleNovelStatus(novel, 'published')}
                            className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30"
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleNovelStatus(novel, 'draft')}
                            className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/30"
                          >
                            Unpublish
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenEditNovel(novel)}
                          className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                          title="Edit Book Details"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteNovel(novel)}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                          title="Delete Novel"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
