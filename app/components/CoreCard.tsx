// CoreCard — the unified card design used across the entire app.
// Use the `scale` prop to resize without distorting proportions.
// The outer div takes up exactly (320*scale × 448*scale) pixels in the layout.

const BASE_W = 320
const BASE_H = 448

type Rarity = 'Core' | 'Rare' | 'Very Rare' | 'Epic' | 'Spectacular'

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

export default function CoreCard({
  name, aura, skill, stamina, totalScore, imageUrl,
  rarity = 'Core', scale = 1,
}: CoreCardProps) {
  const t = THEME[rarity] ?? THEME.Core

  return (
    // Outer div: takes correct space in the layout
    <div style={{ width: BASE_W * scale, height: BASE_H * scale, position: 'relative', flexShrink: 0 }}>
      {/* Inner div: renders at full size then scaled */}
      <div style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute' }}>

        <div className={`absolute inset-0 bg-gradient-to-b ${t.bg} rounded-3xl shadow-2xl overflow-hidden border-[10px] ${t.border}`}>

          {/* VEE FRIENDS banner */}
          <div className={`bg-gradient-to-r ${t.banner} py-2.5 text-center border-b-4 ${t.border}`}>
            <p className="text-lg font-black text-white tracking-[4px] drop-shadow">VEE FRIENDS</p>
          </div>

          {/* Art frame */}
          <div className={`mx-4 mt-3 rounded-2xl overflow-hidden border-4 ${t.frame} shadow-inner bg-black/40`} style={{ height: 148 }}>
            {imageUrl
              ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🃏</div>
            }
          </div>

          {/* Name */}
          <div className="px-4 mt-2 text-center">
            <p className="text-[15px] font-black text-white drop-shadow-md leading-tight line-clamp-1">{name}</p>
          </div>

          {/* Aura / Skill / Stamina */}
          <div className="px-4 mt-2 flex gap-2">
            <div className="flex-1 bg-white/90 rounded-xl py-2 border-2 border-red-500 text-center shadow-md">
              <p className="text-red-600 font-bold text-[9px] tracking-widest">AURA</p>
              <p className="text-red-600 text-2xl font-black leading-none mt-0.5">{aura}</p>
            </div>
            <div className="flex-1 bg-white/90 rounded-xl py-2 border-2 border-green-500 text-center shadow-md">
              <p className="text-green-600 font-bold text-[9px] tracking-widest">SKILL</p>
              <p className="text-green-600 text-2xl font-black leading-none mt-0.5">{skill}</p>
            </div>
            <div className="flex-1 bg-white/90 rounded-xl py-2 border-2 border-yellow-500 text-center shadow-md">
              <p className="text-yellow-600 font-bold text-[9px] tracking-widest">STAMINA</p>
              <p className="text-yellow-600 text-2xl font-black leading-none mt-0.5">{stamina}</p>
            </div>
          </div>

          {/* Total Score */}
          <div className="flex flex-col items-center mt-3">
            <p className="text-white/70 text-[9px] font-bold tracking-[3px] mb-1.5">TOTAL SCORE</p>
            <div className={`w-[76px] h-[76px] rounded-full bg-gradient-to-br ${t.scoreBg} flex items-center justify-center shadow-xl`}
              style={{ border: '5px solid rgba(255,255,255,0.5)' }}>
              <p className={`text-4xl font-black ${t.scoreText}`}>{totalScore}</p>
            </div>
          </div>

          {/* Rarity bar */}
          <div className={`absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-r ${t.bar} flex items-center px-5`}>
            <p className={`font-black text-sm tracking-[3px] uppercase ${t.barText}`}>{rarity}</p>
          </div>

        </div>
      </div>
    </div>
  )
}
