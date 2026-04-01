// CoreCard — unified card design across the entire app.
// `scale` controls display size. Outer div takes (320*scale × 448*scale) px in layout.

const BASE_W = 320
const BASE_H = 448

interface CoreCardProps {
  name: string
  aura: number
  skill: number
  stamina: number
  totalScore: number
  imageUrl: string | null
  rarity?: string
  scale?: number
}

const THEME: Record<string, {
  border: string; bg: string; banner: string; frame: string
  scoreBg: string; scoreText: string; bar: string; barText: string
}> = {
  Core: {
    border:    'border-yellow-300',
    bg:        'from-yellow-400 via-amber-500 to-yellow-600',
    banner:    'from-amber-600 to-yellow-500',
    frame:     'border-yellow-200',
    scoreBg:   'from-yellow-300 to-amber-400',
    scoreText: 'text-amber-900',
    bar:       'from-amber-700 to-yellow-600',
    barText:   'text-white',
  },
  Rare: {
    border:    'border-amber-400',
    bg:        'from-amber-500 via-amber-600 to-amber-800',
    banner:    'from-amber-800 to-amber-600',
    frame:     'border-amber-300',
    scoreBg:   'from-amber-300 to-amber-500',
    scoreText: 'text-amber-950',
    bar:       'from-amber-900 to-amber-700',
    barText:   'text-amber-100',
  },
  'Very Rare': {
    border:    'border-orange-400',
    bg:        'from-orange-500 via-orange-600 to-red-700',
    banner:    'from-orange-700 to-orange-500',
    frame:     'border-orange-200',
    scoreBg:   'from-orange-300 to-orange-500',
    scoreText: 'text-orange-950',
    bar:       'from-red-800 to-orange-700',
    barText:   'text-orange-100',
  },
  Epic: {
    border:    'border-green-400',
    bg:        'from-green-600 via-emerald-700 to-green-900',
    banner:    'from-green-800 to-emerald-600',
    frame:     'border-green-300',
    scoreBg:   'from-green-300 to-emerald-500',
    scoreText: 'text-green-950',
    bar:       'from-green-900 to-emerald-800',
    barText:   'text-green-100',
  },
  Spectacular: {
    border:    'border-blue-400',
    bg:        'from-blue-600 via-indigo-700 to-purple-900',
    banner:    'from-indigo-800 to-blue-600',
    frame:     'border-blue-300',
    scoreBg:   'from-blue-300 to-indigo-500',
    scoreText: 'text-blue-950',
    bar:       'from-purple-900 to-indigo-800',
    barText:   'text-blue-100',
  },
}

const HOVER_GLOW: Record<string, string> = {
  Core:        'rgba(234,179,8,0.55)',
  Rare:        'rgba(217,119,6,0.55)',
  'Very Rare': 'rgba(249,115,22,0.55)',
  Epic:        'rgba(34,197,94,0.55)',
  Spectacular: 'rgba(99,102,241,0.55)',
}

export default function CoreCard({
  name, aura, skill, stamina, totalScore, imageUrl,
  rarity = 'Core', scale = 1,
}: CoreCardProps) {
  const t = THEME[rarity] ?? THEME.Core
  const glow = HOVER_GLOW[rarity] ?? HOVER_GLOW.Core
  const popY = `-${Math.max(8, Math.round(20 * scale))}px`

  return (
    <div
      className="core-card-root group cursor-pointer"
      style={{
        '--shimmy-y': popY,
        '--shimmy-glow': glow,
        width: BASE_W * scale,
        height: BASE_H * scale,
        position: 'relative',
        flexShrink: 0,
        willChange: 'transform',
      } as React.CSSProperties}
    >
      <div style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute' }}>

        <div className={`absolute inset-0 bg-gradient-to-b ${t.bg} rounded-3xl shadow-2xl overflow-hidden border-[10px] ${t.border}`}>

          {/* Banner */}
          <div className={`bg-gradient-to-r ${t.banner} py-1.5 text-center border-b-4 ${t.border}`}>
            <p className="text-base font-black text-white tracking-[4px] drop-shadow">VEE FRIENDS</p>
          </div>

          {/* Art frame — maximized */}
          <div className={`mx-3 mt-2 rounded-2xl overflow-hidden border-4 ${t.frame} shadow-inner bg-black/40 relative`} style={{ height: 238 }}>
            {imageUrl
              ? <img src={imageUrl} alt={name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              : <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">🃏</div>
            }
            {/* Total score badge — bottom-right of art */}
            <div className={`absolute bottom-2 right-2 w-14 h-14 rounded-full bg-gradient-to-br ${t.scoreBg} flex flex-col items-center justify-center shadow-xl`}
              style={{ border: '3px solid rgba(255,255,255,0.6)' }}>
              <p className={`text-[10px] font-bold ${t.scoreText} leading-none`}>TOTAL</p>
              <p className={`text-xl font-black ${t.scoreText} leading-none`}>{totalScore}</p>
            </div>
          </div>

          {/* Character name */}
          <div className="px-3 mt-2 text-center">
            <p className="text-[22px] font-black text-white drop-shadow-md leading-tight line-clamp-1">{name}</p>
          </div>

          {/* Stats — Aura / Skill / Stamina */}
          <div className="px-3 mt-2 flex gap-2">
            <div className="flex-1 bg-white/90 rounded-xl py-3 border-2 border-red-500 text-center shadow-md">
              <p className="text-red-600 font-black text-[11px] tracking-widest">AURA</p>
              <p className="text-red-600 text-[32px] font-black leading-none mt-1">{aura}</p>
            </div>
            <div className="flex-1 bg-white/90 rounded-xl py-3 border-2 border-green-500 text-center shadow-md">
              <p className="text-green-600 font-black text-[11px] tracking-widest">SKILL</p>
              <p className="text-green-600 text-[32px] font-black leading-none mt-1">{skill}</p>
            </div>
            <div className="flex-1 bg-white/90 rounded-xl py-3 border-2 border-yellow-500 text-center shadow-md">
              <p className="text-yellow-600 font-black text-[11px] tracking-widest">STAMINA</p>
              <p className="text-yellow-600 text-[32px] font-black leading-none mt-1">{stamina}</p>
            </div>
          </div>

          {/* Rarity bar */}
          <div className={`absolute bottom-0 left-0 right-0 h-[11px] bg-gradient-to-r ${t.bar}`} />

        </div>
      </div>
    </div>
  )
}
