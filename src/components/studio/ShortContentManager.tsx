import { useState, useEffect } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Check,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react'
import type { PMFShortContent, ShortContentCategory, ContentStatus } from '../../types/ownerContent'
import {
  getShortContent,
  saveShortContent,
  setShortContentStatus,
  deleteShortContent,
} from '../../services/ownerContentService'

interface ShortContentManagerProps {
  filterCategory?: ShortContentCategory
  titleLabel: string
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-amber-400/60 focus:bg-white/[0.07]'

const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'

export default function ShortContentManager({
  filterCategory,
  titleLabel,
}: ShortContentManagerProps) {
  const [items, setItems] = useState<PMFShortContent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string } | null>(null)

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ShortContentCategory>(filterCategory || 'comedy')
  const [creatorName, setCreatorName] = useState('')
  const [duration, setDuration] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [featured, setFeatured] = useState(false)
  const [displayOrder, setDisplayOrder] = useState(0)

  const loadData = async () => {
    setLoading(true)
    const data = await getShortContent(false) // fetch all, including drafts
    setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredItems = items.filter((item) => {
    if (!filterCategory) return true
    return item.category === filterCategory
  })

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setCategory(filterCategory || 'comedy')
    setCreatorName('')
    setDuration('')
    setThumbnailUrl('')
    setVideoUrl('')
    setStatus('draft')
    setFeatured(false)
    setDisplayOrder(0)
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const handleOpenCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const handleOpenEdit = (item: PMFShortContent) => {
    setEditingId(item.id)
    setTitle(item.title)
    setDescription(item.description)
    setCategory(item.category)
    setCreatorName(item.creator_name)
    setDuration(item.duration)
    setThumbnailUrl(item.thumbnail_url)
    setVideoUrl(item.video_url)
    setStatus(item.status)
    setFeatured(item.featured)
    setDisplayOrder(item.display_order)
    setError('')
    setShowForm(true)
  }

  const handleSave = async (saveAsStatus?: ContentStatus) => {
    setError('')
    setNotice('')

    if (!title.trim()) {
      setError('Title is mandatory.')
      return
    }
    if (!creatorName.trim()) {
      setError('Creator / Channel name is mandatory.')
      return
    }
    if (!thumbnailUrl.trim()) {
      setError('Thumbnail image URL is mandatory.')
      return
    }
    if (!videoUrl.trim()) {
      setError('Playable video media URL is mandatory.')
      return
    }

    setSaving(true)
    try {
      const targetStatus = saveAsStatus || status

      await saveShortContent({
        id: editingId || undefined,
        title: title.trim(),
        description: description.trim(),
        category,
        creator_name: creatorName.trim(),
        duration: duration.trim() || '2m 30s',
        thumbnail_url: thumbnailUrl.trim(),
        video_url: videoUrl.trim(),
        video_type: videoUrl.includes('youtube') ? 'youtube' : 'mp4',
        status: targetStatus,
        featured,
        display_order: Number(displayOrder) || 0,
      })

      setNotice(
        editingId
          ? `Successfully updated "${title}" (${targetStatus.toUpperCase()}).`
          : `Successfully registered "${title}" as ${targetStatus.toUpperCase()}.`,
      )
      resetForm()
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to save short-form media entry.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (item: PMFShortContent, nextStatus: ContentStatus) => {
    try {
      await setShortContentStatus(item.id, nextStatus)
      setNotice(`Updated "${item.title}" to ${nextStatus.toUpperCase()}`)
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to change status.')
    }
  }

  const handleDelete = async (item: PMFShortContent) => {
    if (!window.confirm(`Permanently remove "${item.title}" from PMF short-form catalogue?`)) {
      return
    }
    try {
      await deleteShortContent(item.id)
      setNotice(`Removed "${item.title}".`)
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to remove entry.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-xl font-black text-white">{titleLabel} Manager</h2>
          <p className="text-xs text-white/50">
            Owner publishing controls: create drafts, preview video, publish approved reels, and archive outdated clips.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className={`${buttonClass} bg-amber-400 text-black hover:bg-amber-300 shadow-lg shadow-amber-400/20`}
        >
          <Plus className="h-4 w-4" />
          <span>Add New {filterCategory === 'news' ? 'News Clip' : 'Comedy Skit'}</span>
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

      {/* Editor Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#090715] p-6 sm:p-8 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <h3 className="text-lg font-black text-white">
                {editingId ? 'Edit Short-Form Media' : 'Publish New Short-Form Media'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-white/10 p-2 text-white/50 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Market Day Comedy Drama Pt. 1"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ShortContentCategory)}
                    className={inputClass}
                  >
                    <option value="comedy">Comedy Skit</option>
                    <option value="news">News Clip / Report</option>
                    <option value="creator">Creator Video</option>
                    <option value="skit">Street Skit</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Creator / Channel Name *
                  </label>
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    placeholder="e.g. PMF Comedy Troupe"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Duration (e.g. 2m 45s)
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 3m 15s"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Display Order (Priority ranking)
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
                  Thumbnail / Poster URL *
                </label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://... image poster URL"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Playable Video Media URL *
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://... mp4, m3u8, or YouTube video link"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Description / Synopsis
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter context, sketch summary, or reporter notes..."
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
                  <span>Feature on Top Rails</span>
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

            {/* Modal Actions */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              {videoUrl ? (
                <button
                  type="button"
                  onClick={() => setPreviewVideo({ url: videoUrl, title })}
                  className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10"
                >
                  <Eye className="h-4 w-4" />
                  <span>Preview Video</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('draft')}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('published')}
                  className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 disabled:opacity-50 shadow-lg"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingId ? 'Update & Publish' : 'Approve & Publish'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-4">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-black">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <span className="text-xs font-bold text-white truncate">{previewVideo.title || 'Video Preview'}</span>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="rounded-lg p-1 text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black flex items-center justify-center">
              {previewVideo.url.includes('youtube') ? (
                <iframe
                  src={previewVideo.url}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={previewVideo.url} controls autoPlay className="h-full w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table of Content Entries */}
      {loading ? (
        <div className="py-12 text-center text-white/40">Loading entries...</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/40">
          No records registered yet. Click &ldquo;Add New&rdquo; to create your first owner-approved entry.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.04] text-[10px] font-black uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-4 py-3">Thumbnail</th>
                <th className="px-4 py-3">Title & Creator</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="h-12 w-8 rounded-lg object-cover bg-black"
                      onError={(e) => (e.currentTarget.src = '/pmf-flix-icon.png')}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{item.title}</div>
                    <div className="text-[10px] text-white/40">{item.creator_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase font-bold text-white/70">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">{item.duration}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        item.status === 'published'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : item.status === 'draft'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-neutral-500/20 text-neutral-300 border border-neutral-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-white/60">#{item.display_order}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.status !== 'published' ? (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item, 'published')}
                          className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item, 'draft')}
                          className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/30"
                        >
                          Unpublish
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
