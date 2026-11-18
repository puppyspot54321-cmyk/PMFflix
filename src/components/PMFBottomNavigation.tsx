import { Home, BookOpen, Download, User, Film } from 'lucide-react'

export type NavSection =
  | 'home'
  | 'movies'
  | 'series'
  | 'trending'
  | 'nollywood'
  | 'buzz-boss'
  | 'free-novels'
  | 'my-list'
  | 'offline'
  | 'shorts'
  | 'sports'
  | 'midnight-18'

interface PMFBottomNavigationProps {
  currentSection: NavSection
  onNavigate: (section: NavSection) => void
  onOpenMe: () => void
  downloadsCount: number
  profileAvatar?: string
}

export default function PMFBottomNavigation({
  currentSection,
  onNavigate,
  onOpenMe,
  downloadsCount,
  profileAvatar,
}: PMFBottomNavigationProps) {
  // If user is inside the full-screen Shorts view, the bottom bar is suppressed to give edge-to-edge reel
  if (currentSection === 'shorts') {
    return null
  }

  return (
    <nav
      aria-label="Mobile Navigation"
      className="xl:hidden fixed bottom-0 inset-x-0 z-40 select-none pb-[env(safe-area-inset-bottom,0px)] bg-[#040309]/92 backdrop-blur-2xl border-t border-purple-400/10 shadow-[0_-8px_32px_rgba(0,0,0,0.7)]"
    >
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {/* 1. HOME */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className={`group flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
            currentSection === 'home' ? 'text-amber-400' : 'text-white/45 hover:text-white/80'
          }`}
        >
          <div className="relative">
            <Home className="h-5 w-5 transition-transform group-hover:scale-110" />
            {currentSection === 'home' && (
              <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
            )}
          </div>
          <span className="mt-1 text-[10px] font-black uppercase tracking-wider">Home</span>
        </button>

        {/* 2. NOVELHUB */}
        <button
          type="button"
          onClick={() => onNavigate('free-novels')}
          className={`group flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
            currentSection === 'free-novels'
              ? 'text-amber-400'
              : 'text-white/45 hover:text-white/80'
          }`}
        >
          <div className="relative">
            <BookOpen className="h-5 w-5 transition-transform group-hover:scale-110" />
            {currentSection === 'free-novels' && (
              <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
            )}
          </div>
          <span className="mt-1 text-[10px] font-black uppercase tracking-wider">NovelHub</span>
        </button>

        {/* 3. CENTRAL SHORTS TRIGGER (Elevated Signature Circular Action) */}
        <div className="relative flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => onNavigate('shorts')}
            aria-label="Open PMF Shorts Experience"
            className="group relative -mt-6 flex h-14 w-14 items-center justify-center rounded-full p-[2.5px] transition-all duration-300 active:scale-90 hover:scale-105 shadow-[0_8px_24px_rgba(139,92,246,0.45)]"
          >
            {/* Animated Gradient Ring */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-600 via-amber-400 to-amber-300 opacity-90 transition-opacity group-hover:opacity-100 animate-pulse"
            />
            {/* Subtle Outer Glow */}
            <span
              aria-hidden="true"
              className="absolute -inset-1 rounded-full bg-amber-400/20 blur-md transition-all group-hover:bg-amber-400/35"
            />
            {/* Core Action Button */}
            <div className="relative flex h-full w-full flex-col items-center justify-center rounded-full bg-[#080514] text-white shadow-inner">
              <Film className="h-5 w-5 text-amber-300 group-hover:scale-110 transition-transform fill-amber-300/20" />
              <span className="text-[7.5px] font-black uppercase tracking-widest text-amber-300 -mt-0.5">
                Shorts
              </span>
            </div>
          </button>
        </div>

        {/* 4. DOWNLOADS */}
        <button
          type="button"
          onClick={() => onNavigate('offline')}
          className={`group flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
            currentSection === 'offline' ? 'text-amber-400' : 'text-white/45 hover:text-white/80'
          }`}
        >
          <div className="relative">
            <Download className="h-5 w-5 transition-transform group-hover:scale-110" />
            {downloadsCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-400 px-1 text-[8px] font-black text-black">
                {downloadsCount}
              </span>
            )}
            {currentSection === 'offline' && (
              <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
            )}
          </div>
          <span className="mt-1 text-[10px] font-black uppercase tracking-wider">Downloads</span>
        </button>

        {/* 5. ME / PROFILE */}
        <button
          type="button"
          onClick={onOpenMe}
          className="group flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 text-white/45 hover:text-white/80"
        >
          <div className="relative flex h-5 w-5 items-center justify-center text-sm">
            {profileAvatar ? (
              <span className="text-base leading-none group-hover:scale-110 transition-transform">
                {profileAvatar}
              </span>
            ) : (
              <User className="h-5 w-5 transition-transform group-hover:scale-110" />
            )}
          </div>
          <span className="mt-1 text-[10px] font-black uppercase tracking-wider">Me</span>
        </button>
      </div>
    </nav>
  )
}
