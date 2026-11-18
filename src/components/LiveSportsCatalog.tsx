import { useState, useEffect } from 'react'
import {
  Trophy,
  Calendar,
  Clock,
  Radio,
  PlusCircle,
  ExternalLink,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import type { PMFSportsEvent, SportsEventStatus } from '../types/ownerContent'
import { getSportsEvents, subscribeToContentUpdates } from '../services/ownerContentService'

interface LiveSportsCatalogProps {
  onOpenStudio?: () => void
}

export default function LiveSportsCatalog({ onOpenStudio }: LiveSportsCatalogProps) {
  const [events, setEvents] = useState<PMFSportsEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | SportsEventStatus>('all')
  const [activeEvent, setActiveEvent] = useState<PMFSportsEvent | null>(null)
  const [selectedSport, setSelectedSport] = useState('All')

  const loadData = async () => {
    setLoading(true)
    const data = await getSportsEvents(true)
    setEvents(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const unsubscribe = subscribeToContentUpdates(loadData)
    return () => unsubscribe()
  }, [])

  const sports = ['All', ...Array.from(new Set(events.map((e) => e.sport).filter(Boolean)))]

  const filteredEvents = events.filter((ev) => {
    if (activeTab !== 'all' && ev.event_status !== activeTab) return false
    if (selectedSport !== 'All' && ev.sport !== selectedSport) return false
    return true
  })

  const liveCount = events.filter((e) => e.event_status === 'live').length
  const upcomingCount = events.filter((e) => e.event_status === 'upcoming').length

  const formatEventDate = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  return (
    <section className="relative min-h-[60vh] py-12 px-4 sm:px-8 lg:px-12 max-w-[1600px] mx-auto">
      {/* Header Banner */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">
            <Trophy className="h-3.5 w-3.5 fill-amber-400" />
            PMF-Flix Live Sports & Global Broadcasts
          </div>
          <h1 className="mt-1.5 text-3xl sm:text-4xl font-black text-white tracking-tight">
            Live Sports Arena & Fixtures
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-white/50 max-w-2xl leading-relaxed">
            Real-time event scheduling, authorized broadcasts, and verified tournament fixtures managed directly from the PMF-Flix sports desk.
          </p>
        </div>

        {/* Status Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'all'
                ? 'bg-amber-400 text-black'
                : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] border border-white/10'
            }`}
          >
            All Fixtures ({events.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'live'
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] border border-white/10'
            }`}
          >
            <Radio className="h-3.5 w-3.5 animate-pulse text-red-400" />
            <span>Live Now ({liveCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'upcoming'
                ? 'bg-amber-400 text-black'
                : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] border border-white/10'
            }`}
          >
            Upcoming ({upcomingCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'completed'
                ? 'bg-amber-400 text-black'
                : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] border border-white/10'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {sports.length > 2 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {sports.map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setSelectedSport(sp)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedSport === sp
                  ? 'bg-amber-400 text-black'
                  : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] border border-white/10'
              }`}
            >
              {sp}
            </button>
          ))}
        </div>
      )}

      {/* Grid or Honest Empty State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-white/40">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest">
            Syncing live sports schedules...
          </p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#070510]/80 p-12 text-center max-w-2xl mx-auto my-12 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <Trophy className="h-8 w-8" />
          </div>

          <h3 className="mt-5 text-xl font-black text-white">
            No Scheduled Sports Events In This View
          </h3>

          <p className="mt-2.5 text-xs text-white/50 leading-relaxed max-w-md mx-auto">
            Live sports coverage on PMF-Flix only displays fixtures and broadcasts authorized and entered by the owner. Static promotional images are never used as substitutes.
          </p>

          {onOpenStudio && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onOpenStudio}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Open PMF Studio to Schedule Sports Event</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const isLive = event.event_status === 'live'
            const isUpcoming = event.event_status === 'upcoming'

            return (
              <div
                key={event.id}
                onClick={() => setActiveEvent(event)}
                className={`group flex flex-col overflow-hidden rounded-2xl border bg-[#080613] p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                  isLive
                    ? 'border-red-500/40 shadow-[0_8px_30px_rgba(239,68,68,0.2)]'
                    : 'border-white/10 hover:border-amber-400/40'
                }`}
              >
                {/* Event Thumbnail */}
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black mb-4">
                  <img
                    src={event.thumbnail_url}
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.src = '/pmf-flix-icon.png'
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                  {/* Status Indicator Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    {isLive ? (
                      <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-red-600/50">
                        <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                        LIVE STREAM
                      </span>
                    ) : isUpcoming ? (
                      <span className="flex items-center gap-1.5 rounded-md bg-blue-600/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
                        <Clock className="h-3 w-3" />
                        UPCOMING
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-md bg-neutral-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                        <CheckCircle2 className="h-3 w-3" />
                        FINAL
                      </span>
                    )}

                    <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-400 border border-white/10">
                      {event.sport}
                    </span>
                  </div>

                  {event.score && (
                    <div className="absolute bottom-3 right-3 rounded-lg bg-black/80 px-3 py-1 font-mono text-sm font-black text-amber-400 border border-amber-400/30">
                      {event.score}
                    </div>
                  )}
                </div>

                {/* Matchup Header */}
                <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                  <span>{event.competition}</span>
                  <span>{event.timezone}</span>
                </div>

                <h3 className="text-base font-black text-white group-hover:text-amber-300 transition line-clamp-1">
                  {event.title}
                </h3>

                <p className="mt-1 text-xs text-white/60 font-semibold">
                  {event.team_a} vs {event.team_b}
                </p>

                <p className="mt-2 text-xs text-white/50 line-clamp-2 leading-relaxed flex-1">
                  {event.description}
                </p>

                {/* Scheduled Time Banner */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
                  <div className="flex items-center gap-2 text-white/70">
                    <Calendar className="h-3.5 w-3.5 text-amber-400" />
                    <span>{formatEventDate(event.scheduled_start)}</span>
                  </div>

                  <span
                    className={`font-black text-[10px] uppercase tracking-wider ${
                      isLive ? 'text-red-400' : 'text-amber-400'
                    }`}
                  >
                    {isLive ? 'Broadcasting Now' : 'Coverage Scheduled'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Real Broadcast & Match Detail Modal */}
      {activeEvent && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-2xl">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/15 bg-[#090714] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-md px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    activeEvent.event_status === 'live'
                      ? 'bg-red-600 text-white'
                      : 'bg-white/10 text-white/70'
                  }`}
                >
                  {activeEvent.event_status.toUpperCase()}
                </span>
                <h2 className="text-sm sm:text-base font-black text-white truncate max-w-md sm:max-w-xl">
                  {activeEvent.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setActiveEvent(null)}
                className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Live Player / Honest Signal Status */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              {activeEvent.event_status === 'live' && activeEvent.broadcast_source_url ? (
                activeEvent.broadcast_source_url.includes('youtube') ? (
                  <iframe
                    src={
                      activeEvent.broadcast_source_url.includes('embed')
                        ? activeEvent.broadcast_source_url
                        : `https://www.youtube.com/embed/${activeEvent.broadcast_source_url.split('v=')[1]?.split('&')[0] || activeEvent.broadcast_source_url.split('/').pop()}?autoplay=1`
                    }
                    title={activeEvent.title}
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={activeEvent.broadcast_source_url}
                    poster={activeEvent.thumbnail_url}
                    controls
                    autoPlay
                    className="h-full w-full object-contain"
                  >
                    Your browser does not support live video playback.
                  </video>
                )
              ) : activeEvent.event_status === 'upcoming' ? (
                <div className="text-center p-8 max-w-lg">
                  <Clock className="h-12 w-12 text-amber-400 mx-auto mb-4 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400">
                    Coverage Scheduled
                  </span>
                  <h3 className="text-xl font-black text-white mt-1">
                    Kickoff: {formatEventDate(activeEvent.scheduled_start)}
                  </h3>
                  <p className="mt-2 text-xs text-white/60 leading-relaxed">
                    The PMF-Flix live streaming signal will activate immediately when coverage commences. Return here at the scheduled match time to access live transmission.
                  </p>
                </div>
              ) : activeEvent.event_status === 'completed' ? (
                <div className="text-center p-8 max-w-lg">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
                    Match Concluded
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1">
                    Final Result: {activeEvent.score || 'Full Time'}
                  </h3>
                  <p className="mt-2 text-xs text-white/60 leading-relaxed">
                    Broadcast has concluded. Match highlights and analysis will be published when available.
                  </p>
                </div>
              ) : (
                <div className="text-center p-8 max-w-lg">
                  <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                  <h3 className="text-lg font-black text-white">
                    Authorized Broadcast Stream Pending
                  </h3>
                  <p className="mt-2 text-xs text-white/60 leading-relaxed">
                    Live broadcast source has not yet been linked for this fixture in PMF Studio. Live video will begin once an authorized stream URL is configured by the owner.
                  </p>
                </div>
              )}
            </div>

            {/* Event Information Footer */}
            <div className="p-6 bg-[#06040d] border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  {activeEvent.competition} · {activeEvent.sport}
                </p>
                <h4 className="text-sm font-black text-white mt-0.5">
                  {activeEvent.team_a} vs {activeEvent.team_b}
                </h4>
                <p className="text-xs text-white/50 mt-1 max-w-xl">{activeEvent.description}</p>
              </div>

              {activeEvent.broadcast_source_url && (
                <a
                  href={activeEvent.broadcast_source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Authorized Feed Link</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
