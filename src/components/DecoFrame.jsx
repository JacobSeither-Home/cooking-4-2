// Art Deco decorative components

// ── Diamond divider ───────────────────────────────────────────────────────────
export function DecoDivider({ label, className = '' }) {
  return (
    <div className={`flex items-center gap-3 my-4 ${className}`}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      {label
        ? <span className="text-gold/60 text-xs font-display tracking-widest uppercase px-1">{label}</span>
        : <DiamondIcon />
      }
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
    </div>
  )
}

function DiamondIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 0L10 5L5 10L0 5Z" fill="none" stroke="#C8973A" strokeWidth="1" opacity="0.6"/>
      <path d="M5 2L8 5L5 8L2 5Z" fill="#C8973A" opacity="0.4"/>
    </svg>
  )
}

// ── Sunburst ornament ─────────────────────────────────────────────────────────
export function DecoSunburst({ size = 40, className = '' }) {
  const r = size / 2
  const rays = 16
  const lines = Array.from({ length: rays }, (_, i) => {
    const angle = (i * 360) / rays
    const rad   = (angle * Math.PI) / 180
    const x1    = r + (r * 0.35) * Math.cos(rad)
    const y1    = r + (r * 0.35) * Math.sin(rad)
    const x2    = r + (r * 0.9)  * Math.cos(rad)
    const y2    = r + (r * 0.9)  * Math.sin(rad)
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C8973A" strokeWidth="0.75" opacity="0.4" />
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <circle cx={r} cy={r} r={r * 0.3} fill="none" stroke="#C8973A" strokeWidth="0.75" opacity="0.5" />
      <circle cx={r} cy={r} r={r * 0.15} fill="#C8973A" opacity="0.3" />
      {lines}
    </svg>
  )
}

// ── Corner ornament frame ─────────────────────────────────────────────────────
export function DecoCornerFrame({ children, className = '', accent = 'gold' }) {
  const color = accent === 'pink' ? '#E8628A' : '#C8973A'
  return (
    <div className={`relative ${className}`}>
      {/* Corners */}
      {[['top-0 left-0','0,0  16,0  0,16'],['top-0 right-0','0,0  -16,0  0,16'],['bottom-0 left-0','0,0  16,0  0,-16'],['bottom-0 right-0','0,0  -16,0  0,-16']].map(([pos, pts], i) => (
        <svg key={i} className={`absolute ${pos}`} width="20" height="20" viewBox="-2 -2 20 20">
          <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
        </svg>
      ))}
      {children}
    </div>
  )
}

// ── Page header with deco treatment ──────────────────────────────────────────
export function PageHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
              <Icon size={20} className="text-gold" />
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl text-cream leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-cream/40 mt-0.5 font-body">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-3 h-px bg-gradient-to-r from-gold/40 via-pink/20 to-transparent" />
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <div className="skeleton h-40 rounded-lg" />
      <div className="skeleton h-4 w-3/4 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center animate-fade-in">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
          <Icon size={28} className="text-cream/20" />
        </div>
      )}
      <h3 className="font-display text-lg text-cream/60 mb-1">{title}</h3>
      {message && <p className="text-sm text-cream/30 mb-5">{message}</p>}
      {action}
    </div>
  )
}

// ── Star rating display ───────────────────────────────────────────────────────
export function StarRating({ rating = 0, max = 5, size = 14, interactive = false, onChange }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          width={size} height={size}
          viewBox="0 0 24 24"
          fill={i < Math.round(rating) ? '#C8973A' : 'none'}
          stroke={i < Math.round(rating) ? '#C8973A' : '#3D1A22'}
          strokeWidth="1.5"
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
          onClick={() => interactive && onChange?.(i + 1)}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

// ── House badge ───────────────────────────────────────────────────────────────
export function HouseBadge({ house, size = 'sm' }) {
  const isJacob = house === 'jacob'
  const label   = isJacob ? 'Jacob' : 'Caroline'
  const classes = isJacob
    ? 'bg-gold/10 text-gold border-gold/30'
    : 'bg-pink/10 text-pink border-pink/30'
  return (
    <span className={`tag ${classes} ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}>
      {label}
    </span>
  )
}
