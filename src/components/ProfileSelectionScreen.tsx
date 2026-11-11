import { useState } from 'react'
import {
  Check,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react'
import PMFLogo from './PMFLogo'

export interface PMFProfile {
  id: string
  name: string
  avatar: string
  accentColor: string
  isKids: boolean
  createdAt: number
}

interface ProfileSelectionScreenProps {
  profiles: PMFProfile[]
  activeProfileId: string | null
  onSelectProfile: (profile: PMFProfile) => void
  onCreateProfile: (profile: Omit<PMFProfile, 'id' | 'createdAt'>) => void
  onUpdateProfile: (profile: PMFProfile) => void
  onDeleteProfile: (profileId: string) => void
  onSignOut: () => void
  logoSrc?: string
}

const DEFAULT_AVATARS = [
  { emoji: '👑', label: 'Royalty', color: 'from-amber-500 to-yellow-600' },
  { emoji: '🦁', label: 'Mufasa', color: 'from-amber-600 to-orange-700' },
  { emoji: '🎬', label: 'Director', color: 'from-purple-600 to-indigo-700' },
  { emoji: '🍿', label: 'Cinema', color: 'from-purple-500 to-pink-600' },
  { emoji: '🔥', label: 'Blockbuster', color: 'from-red-500 to-amber-600' },
  { emoji: '⭐', label: 'Superstar', color: 'from-amber-400 to-purple-600' },
  { emoji: '🚀', label: 'Sci-Fi', color: 'from-cyan-500 to-blue-600' },
  { emoji: '🎭', label: 'Drama', color: 'from-purple-700 to-violet-900' },
  { emoji: '🧒', label: 'Kids & Family', color: 'from-emerald-500 to-teal-600' },
]

export default function ProfileSelectionScreen({
  profiles,
  activeProfileId,
  onSelectProfile,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onSignOut,
}: ProfileSelectionScreenProps) {
  const [isManaging, setIsManaging] = useState(false)
  const [editingProfile, setEditingProfile] = useState<PMFProfile | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('👑')
  const [accentColor, setAccentColor] = useState('from-amber-500 to-yellow-600')
  const [isKids, setIsKids] = useState(false)
  const [error, setError] = useState('')

  const handleOpenCreate = () => {
    if (profiles.length >= 4) {
      setError('Account capacity reached: Maximum 4 profiles permitted.')
      return
    }
    setName('')
    setAvatar('🎬')
    setAccentColor('from-purple-600 to-indigo-700')
    setIsKids(false)
    setError('')
    setShowCreateModal(true)
  }

  const handleOpenEdit = (profile: PMFProfile) => {
    setEditingProfile(profile)
    setName(profile.name)
    setAvatar(profile.avatar)
    setAccentColor(profile.accentColor)
    setIsKids(profile.isKids)
    setError('')
  }

  const handleSaveCreate = () => {
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Please provide a profile name.')
      return
    }
    onCreateProfile({
      name: cleanName,
      avatar,
      accentColor,
      isKids,
    })
    setShowCreateModal(false)
  }

  const handleSaveEdit = () => {
    if (!editingProfile) return
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Please provide a profile name.')
      return
    }
    onUpdateProfile({
      ...editingProfile,
      name: cleanName,
      avatar,
      accentColor,
      isKids,
    })
    setEditingProfile(null)
  }

  return (
    <div className="pmf-profile-screen relative min-h-screen bg-[#030208] text-white flex flex-col items-center justify-between px-6 py-10 selection:bg-amber-400 selection:text-black">
      {/* Background cinematic aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-gradient-to-b from-purple-900/20 via-amber-600/10 to-transparent blur-[160px]"
      />

      {/* Top Header with official logo */}
      <header className="relative z-10 w-full max-w-6xl flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <img
            src="/pmf-flix-logo.png"
            alt="PMF-Flix"
            className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const fb = document.getElementById('pmf-prof-logo-fallback')
              if (fb) fb.style.display = 'flex'
            }}
          />
          <div id="pmf-prof-logo-fallback" style={{ display: 'none' }}>
            <PMFLogo size={42} showWordmark={true} />
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition py-2 px-4 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5"
        >
          Sign Out
        </button>
      </header>

      {/* Center Profile Selection Experience */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center py-12 w-full max-w-5xl text-center">
        <div className="mb-10 sm:mb-14">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-400/80 mb-2">
            The PMF-Flix Signature Profile Universe
          </p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Who is watching tonight?
          </h1>
          <p className="mt-3 text-xs sm:text-sm text-white/50 max-w-md mx-auto">
            Choose your personal cinema profile to restore your watchlist, continue points, and personalized recommendations.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Profile Avatars Row */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {profiles.map((profile) => {
            const isSelected = activeProfileId === profile.id

            return (
              <div
                key={profile.id}
                className="group flex flex-col items-center cursor-pointer"
                onClick={() => {
                  if (isManaging) {
                    handleOpenEdit(profile)
                  } else {
                    onSelectProfile(profile)
                  }
                }}
              >
                {/* Avatar Card */}
                <div className="relative">
                  <div
                    className={`relative flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center rounded-3xl border-2 transition-all duration-300 overflow-hidden shadow-2xl ${
                      isSelected
                        ? 'border-amber-400 ring-4 ring-amber-400/20 scale-105'
                        : 'border-white/15 hover:border-amber-400/70 hover:scale-105'
                    } bg-gradient-to-br ${profile.accentColor}`}
                  >
                    <span className="text-5xl sm:text-6xl select-none transition-transform duration-300 group-hover:scale-110">
                      {profile.avatar}
                    </span>

                    {/* Kids safety badge */}
                    {profile.isKids && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-black backdrop-blur">
                        <Shield className="h-2.5 w-2.5" />
                        Kids
                      </div>
                    )}

                    {/* Manage overlay indicator */}
                    {isManaging && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-xs font-bold text-white">
                        Edit
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Name */}
                <div className="mt-3.5 flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-bold text-white/80 group-hover:text-white transition">
                    {profile.name}
                  </span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-amber-400" />
                  )}
                </div>
              </div>
            )
          })}

          {/* Add Profile Button (if under 4 profiles) */}
          {profiles.length < 4 && (
            <div
              onClick={handleOpenCreate}
              className="group flex flex-col items-center cursor-pointer"
            >
              <div className="flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center rounded-3xl border-2 border-dashed border-white/20 bg-white/[0.02] hover:bg-white/[0.05] hover:border-amber-400/50 hover:scale-105 transition-all duration-300">
                <Plus className="h-8 w-8 text-white/40 group-hover:text-amber-400 transition" />
              </div>
              <span className="mt-3.5 text-sm font-bold text-white/40 group-hover:text-white transition">
                Add Profile
              </span>
            </div>
          )}
        </div>

        {/* Management Toggle Button */}
        <div className="mt-12 sm:mt-16">
          <button
            type="button"
            onClick={() => setIsManaging(!isManaging)}
            className={`rounded-xl border px-6 py-3 text-xs font-black uppercase tracking-[0.2em] transition ${
              isManaging
                ? 'border-amber-400 bg-amber-400 text-black font-extrabold shadow-[0_0_25px_rgba(251,191,36,0.4)]'
                : 'border-white/20 bg-white/5 text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            {isManaging ? 'Done Managing' : 'Manage Profiles'}
          </button>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 w-full max-w-6xl text-center py-4 border-t border-white/[0.06] text-[10px] text-white/30">
        PMF-Flix Signature Security • Authenticated Account Protected • Up to 4 Personal Cinema Profiles
      </footer>

      {/* Create Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#090714] p-6 sm:p-8 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <h2 className="text-xl font-black">Add New Profile</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mufasa, Cinephile, Kids"
                  maxLength={20}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2">
                  Choose Avatar Artwork
                </label>
                <div className="grid grid-cols-5 gap-2.5">
                  {DEFAULT_AVATARS.map((av) => (
                    <button
                      key={av.emoji}
                      type="button"
                      onClick={() => {
                        setAvatar(av.emoji)
                        setAccentColor(av.color)
                      }}
                      className={`flex h-12 items-center justify-center rounded-xl text-2xl border transition ${
                        avatar === av.emoji
                          ? 'border-amber-400 bg-white/15 scale-105'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    Kids Profile (Safe Mode)
                  </span>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Filters out mature 18+ titles automatically.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isKids}
                  onChange={(e) => setIsKids(e.target.checked)}
                  className="h-5 w-5 rounded border-white/20 text-amber-400 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveCreate}
                className="flex-1 rounded-xl bg-amber-400 py-3 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition"
              >
                Create Profile
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-white/10 py-3 px-4 text-xs font-bold text-white/60 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#090714] p-6 sm:p-8 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <h2 className="text-xl font-black">Edit Profile</h2>
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="text-white/40 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2">
                  Change Avatar
                </label>
                <div className="grid grid-cols-5 gap-2.5">
                  {DEFAULT_AVATARS.map((av) => (
                    <button
                      key={av.emoji}
                      type="button"
                      onClick={() => {
                        setAvatar(av.emoji)
                        setAccentColor(av.color)
                      }}
                      className={`flex h-12 items-center justify-center rounded-xl text-2xl border transition ${
                        avatar === av.emoji
                          ? 'border-amber-400 bg-white/15 scale-105'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    Kids Profile (Safe Mode)
                  </span>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Filters out mature 18+ titles automatically.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isKids}
                  onChange={(e) => setIsKids(e.target.checked)}
                  className="h-5 w-5 rounded border-white/20 text-amber-400 focus:ring-amber-400"
                />
              </div>

              {profiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteProfile(editingProfile.id)
                    setEditingProfile(null)
                  }}
                  className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 pt-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete this profile
                </button>
              )}
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 rounded-xl bg-amber-400 py-3 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="rounded-xl border border-white/10 py-3 px-4 text-xs font-bold text-white/60 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
