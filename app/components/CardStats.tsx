// Renders the four stat circles: Score | Aura | Skill | Stamina
// Used on every card surface across the app.

interface Props {
  aura: number
  skill: number
  stamina: number
  totalScore: number
  /** 'sm' for compact card thumbnails, 'md' for full-size cards */
  size?: 'sm' | 'md'
}

const SIZES = {
  sm: { circle: 'w-7 h-7',  num: 'text-[11px]', label: 'text-[9px]',  border: 'border-2' },
  md: { circle: 'w-12 h-12', num: 'text-lg',     label: 'text-sm',     border: 'border-2' },
}

const STATS = (a: number, sk: number, st: number, sc: number) => [
  { label: 'Score',   value: sc, border: 'border-purple-400', text: 'text-purple-900' },
  { label: 'Aura',    value: a,  border: 'border-red-500',    text: 'text-red-900'    },
  { label: 'Skill',   value: sk, border: 'border-green-500',  text: 'text-green-900'  },
  { label: 'Stamina', value: st, border: 'border-yellow-500', text: 'text-yellow-900' },
]

export default function CardStats({ aura, skill, stamina, totalScore, size = 'md' }: Props) {
  const s = SIZES[size]
  return (
    <div className="flex items-start justify-around gap-0.5 w-full">
      {STATS(aura, skill, stamina, totalScore).map(({ label, value, border, text }) => (
        <div key={label} className="flex flex-col items-center gap-0.5">
          <div className={`${s.circle} ${s.border} ${border} rounded-full bg-white flex items-center justify-center shrink-0`}>
            <span className={`${s.num} font-black ${text} leading-none`}>{value}</span>
          </div>
          <span className={`${s.label} text-gray-500 leading-none`}>{label}</span>
        </div>
      ))}
    </div>
  )
}
