interface PMFLogoProps {
  size?: number
  className?: string
  showWordmark?: boolean
  wordmarkClassName?: string
}

/** Official PMF-Flix brand artwork supplied by the owner. */
export default function PMFLogo({
  size = 36,
  className = '',
  showWordmark = false,
  wordmarkClassName = '',
}: PMFLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <img
        src="/pmf-flix-official-icon.jpg"
        alt="PMF-Flix"
        width={size}
        height={size}
        className="shrink-0 rounded-[22%] object-contain drop-shadow-[0_2px_12px_rgba(134,59,255,0.45)]"
        loading="eager"
        draggable={false}
      />
      {showWordmark && (
        <div className={`flex flex-col ${wordmarkClassName}`}>
          <span className="text-[15px] font-black tracking-tight leading-none text-white">
            PMF<span className="text-purple-400">-FLIX</span>
          </span>
          <span className="text-[7px] font-bold uppercase tracking-[0.24em] text-white/40 mt-1">
            Prince Mufasa Flix
          </span>
        </div>
      )}
    </div>
  )
}
