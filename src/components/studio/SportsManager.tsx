import { useState, useEffect } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  X,
  Eye,
  Info,
} from 'lucide-react'
import type { PMFSportsEvent, SportsEventStatus, ContentStatus } from '../../types/ownerContent'
import {
  getSportsEvents,
  saveSportsEvent,
  setSportsEventStatus,
  deleteSportsEvent,
} from '../../services/ownerContentService'

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-amber-400/60 focus:bg-white/[0.07]'

const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'

export default function SportsManager() {
  const [events, setEvents] = useState<PMFSportsEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewStream, setPreviewStream] = useState<{ url: string; title: string } | null>(null)

  // Form State
  const [title, setTitle] = useState('')
  const [sport, setSport] = useState('Football')
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [competition, setCompetition] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [scheduledStart, setScheduledStart] = useState('')
  const [timezone, setTimezone] = useState('WAT (GMT+1)')
  const [eventStatus, setEventStatus] = useState<SportsEventStatus>('upcoming')
  const [broadcastSourceUrl, setBroadcastSourceUrl] = useState('')
  const [broadcastSourceType, setBroadcastSourceType] = useState<'hls' | 'mp4' | 'embed' | 'none'>('hls')
  const [status, setStatus] = useState<ContentStatus>('draft')
  const [featured, setFeatured] = useState(false)
  const [score, setScore] = useState('')

  const loadData = async () => {
    setLoading(true)
    const data = await getSportsEvents(false) // fetch all, including drafts
    setEvents(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const resetForm = () => {
    setTitle('')
    setSport('Football')
    setTeamA('')
    setTeamB('')
    setCompetition('')
    setDescription('')
    setThumbnailUrl('')
    setScheduledStart('')
    setTimezone('WAT (GMT+1)')
    setEventStatus('upcoming')
    setBroadcastSourceUrl('')
    setBroadcastSourceType('hls')
    setStatus('draft')
    setFeatured(false)
    setScore('')
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const handleOpenCreate = () => {
    resetForm()
    // Pre-populate with next hour
    const now = new Date()
    now.setHours(now.getHours() + 2)
    setScheduledStart(now.toISOString().slice(0, 16))
    setShowForm(true)
  }

  const handleOpenEdit = (event: PMFSportsEvent) => {
    setEditingId(event.id)
    setTitle(event.title)
    setSport(event.sport)
    setTeamA(event.team_a)
    setTeamB(event.team_b)
    setCompetition(event.competition)
    setDescription(event.description)
    setThumbnailUrl(event.thumbnail_url)
    setScheduledStart(event.scheduled_start ? event.scheduled_start.slice(0, 16) : '')
    setTimezone(event.timezone)
    setEventStatus(event.event_status)
    setBroadcastSourceUrl(event.broadcast_source_url || '')
    setBroadcastSourceType(event.broadcast_source_type || 'hls')
    setStatus(event.status)
    setFeatured(event.featured)
    setScore(event.score || '')
    setError('')
    setShowForm(true)
  }

  const handleSave = async (saveAsStatus?: ContentStatus) => {
    setError('')
    setNotice('')

    if (!title.trim()) {
      setError('Event title is mandatory.')
      return
    }
    if (!teamA.trim() || !teamB.trim()) {
      setError('Both participating competitors/teams are required.')
      return
    }
    if (!competition.trim()) {
      setError('Competition or League name is required.')
      return
    }
    if (!scheduledStart) {
      setError('Scheduled start time is required.')
      return
    }
    if (!thumbnailUrl.trim()) {
      setError('Event thumbnail/poster image URL is required.')
      return
    }

    setSaving(true)
    try {
      const targetStatus = saveAsStatus || status

      await saveSportsEvent({
        id: editingId || undefined,
        title: title.trim(),
        sport: sport.trim(),
        team_a: teamA.trim(),
        team_b: teamB.trim(),
        competition: competition.trim(),
        description: description.trim(),
        thumbnail_url: thumbnailUrl.trim(),
        scheduled_start: new Date(scheduledStart).toISOString(),
        timezone,
        event_status: eventStatus,
        broadcast_source_url: broadcastSourceUrl.trim() || undefined,
        broadcast_source_type: broadcastSourceType,
        status: targetStatus,
        featured,
        score: score.trim() || undefined,
      })

      setNotice(
        editingId
          ? `Updated fixture "${title}" (${targetStatus.toUpperCase()}).`
          : `Scheduled fixture "${title}" as ${targetStatus.toUpperCase()}.`,
      )
      resetForm()
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to save sports event.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleLiveState = async (event: PMFSportsEvent, newLiveStatus: SportsEventStatus) => {
    try {
      await setSportsEventStatus(event.id, newLiveStatus)
      setNotice(`Updated "${event.title}" match status to ${newLiveStatus.toUpperCase()}`)
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to update live state.')
    }
  }

  const handleDelete = async (event: PMFSportsEvent) => {
    if (!window.confirm(`Permanently remove fixture "${event.title}" from PMF Sports?`)) {
      return
    }
    try {
      await deleteSportsEvent(event.id)
      setNotice(`Removed "${event.title}".`)
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to delete event.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-xl font-black text-white">Live Sports Arena & Broadcast Manager</h2>
          <p className="text-xs text-white/50">
            Schedule real fixtures, configure authorized HLS/MP4 broadcast sources, update live scores, and toggle transmission states.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className={`${buttonClass} bg-amber-400 text-black hover:bg-amber-300 shadow-lg shadow-amber-400/20`}
        >
          <Plus className="h-4 w-4" />
          <span>Create Sports Fixture</span>
        </button>
      </div>

      {/* Broadcast Provider Advisory Note */}
      <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-xs text-blue-200 flex items-start gap-3">
        <Info className="h-5 w-5 shrink-0 text-blue-400 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="block font-bold text-white">Authorized Broadcast Integration Notice:</strong>
          Live sports video transmission requires a legitimate, licensed streaming feed URL (e.g. HLS <code className="text-amber-300">.m3u8</code> manifest, RTMP transcoded stream, or authorized CDN stream embed). PMF-Flix never scrapes or pirate-mirrors unauthorized channels. If a fixture does not yet have a live signal, PMF-Flix displays an honest &ldquo;Coverage Scheduled&rdquo; or &ldquo;Broadcast Pending&rdquo; state instead of a fake player.
        </div>
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

      {/* Fixture Editor Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#090715] p-6 sm:p-8 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <h3 className="text-lg font-black text-white">
                {editingId ? 'Edit Sports Event' : 'Schedule New Sports Event'}
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
                  Event Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Enyimba FC vs Rivers United — Super 6 Clash"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Team / Fighter A *
                  </label>
                  <input
                    type="text"
                    value={teamA}
                    onChange={(e) => setTeamA(e.target.value)}
                    placeholder="e.g. Enyimba FC"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Team / Fighter B *
                  </label>
                  <input
                    type="text"
                    value={teamB}
                    onChange={(e) => setTeamB(e.target.value)}
                    placeholder="e.g. Rivers United"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Sport *
                  </label>
                  <select
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Football">Football / Soccer</option>
                    <option value="Basketball">Basketball</option>
                    <option value="Boxing / MMA">Boxing / MMA</option>
                    <option value="Motorsport">Motorsport</option>
                    <option value="Athletics">Athletics</option>
                    <option value="Tennis">Tennis</option>
                    <option value="Other">Other Sport</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Competition / Tournament *
                  </label>
                  <input
                    type="text"
                    value={competition}
                    onChange={(e) => setCompetition(e.target.value)}
                    placeholder="e.g. CAF Champions League / NPFL"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Scheduled Kickoff / Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledStart}
                    onChange={(e) => setScheduledStart(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Timezone Description
                  </label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="WAT (GMT+1)"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Match / Event Status *
                  </label>
                  <select
                    value={eventStatus}
                    onChange={(e) => setEventStatus(e.target.value as SportsEventStatus)}
                    className={inputClass}
                  >
                    <option value="upcoming">Upcoming (Scheduled)</option>
                    <option value="live">Live Broadcasting Now</option>
                    <option value="completed">Completed (Final Result)</option>
                    <option value="cancelled">Cancelled / Postponed</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Live Score / Result (Optional)
                  </label>
                  <input
                    type="text"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="e.g. 2 - 1 (68') or Final"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Event Thumbnail / Match Banner URL *
                </label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://... match poster or banner image"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Authorized Live Broadcast Stream URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={broadcastSourceUrl}
                    onChange={(e) => setBroadcastSourceUrl(e.target.value)}
                    placeholder="https://... .m3u8, mp4, or stream link"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                    Stream Format
                  </label>
                  <select
                    value={broadcastSourceType}
                    onChange={(e) => setBroadcastSourceType(e.target.value as any)}
                    className={inputClass}
                  >
                    <option value="hls">HLS (.m3u8)</option>
                    <option value="mp4">Direct MP4</option>
                    <option value="embed">Embed Player</option>
                    <option value="none">Pending Provider</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                  Match Synopsis / Fixture Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Broadcast notes, venue location, key rivalries..."
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
                  <span>Feature on Sports Top Banner</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/60">Catalogue Status:</span>
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
              {broadcastSourceUrl ? (
                <button
                  type="button"
                  onClick={() => setPreviewStream({ url: broadcastSourceUrl, title })}
                  className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10"
                >
                  <Eye className="h-4 w-4" />
                  <span>Test Feed Playback</span>
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
                  Save Draft
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('published')}
                  className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 disabled:opacity-50 shadow-lg"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingId ? 'Update Fixture' : 'Publish Fixture'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stream Preview Modal */}
      {previewStream && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-4">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-black">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <span className="text-xs font-bold text-white truncate">{previewStream.title || 'Broadcast Signal Test'}</span>
              <button
                type="button"
                onClick={() => setPreviewStream(null)}
                className="rounded-lg p-1 text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-video w-full bg-black flex items-center justify-center">
              <video src={previewStream.url} controls autoPlay className="h-full w-full object-contain">
                Live stream format test preview.
              </video>
            </div>
          </div>
        </div>
      )}

      {/* Fixtures Table */}
      {loading ? (
        <div className="py-12 text-center text-white/40">Loading sports schedules...</div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/40">
          No sports fixtures registered yet. Click &ldquo;Create Sports Fixture&rdquo; to add your first real match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.04] text-[10px] font-black uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-4 py-3">Banner</th>
                <th className="px-4 py-3">Fixture & Competition</th>
                <th className="px-4 py-3">Sport</th>
                <th className="px-4 py-3">Scheduled Time</th>
                <th className="px-4 py-3">Event State</th>
                <th className="px-4 py-3">Signal Feed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {events.map((event) => {
                const isLive = event.event_status === 'live'

                return (
                  <tr key={event.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <img
                        src={event.thumbnail_url}
                        alt={event.title}
                        className="h-10 w-16 rounded-lg object-cover bg-black"
                        onError={(e) => (e.currentTarget.src = '/pmf-flix-icon.png')}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{event.title}</div>
                      <div className="text-[10px] text-white/50">
                        {event.team_a} vs {event.team_b} · {event.competition}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/80">{event.sport}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-white/70">
                      {new Date(event.scheduled_start).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={event.event_status}
                        onChange={(e) => handleToggleLiveState(event, e.target.value as any)}
                        className={`rounded px-2 py-1 text-[10px] font-black uppercase tracking-wider border outline-none ${
                          isLive
                            ? 'bg-red-500/20 text-red-400 border-red-500/40'
                            : event.event_status === 'upcoming'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30'
                        }`}
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="live">🔴 Live Now</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {event.broadcast_source_url ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <Check className="h-3 w-3" />
                          <span>Linked ({event.broadcast_source_type || 'Stream'})</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400/80">Pending Feed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(event)}
                          className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                          title="Edit Fixture"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(event)}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                          title="Delete Fixture"
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
