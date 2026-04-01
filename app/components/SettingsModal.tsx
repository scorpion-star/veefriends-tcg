'use client'

import { useSettings } from './SettingsContext'
import { BACKGROUNDS, BackgroundId } from '@/app/lib/settings'
import NeonButton from './NeonButton'

export default function SettingsModal() {
  const {
    closeSettings,
    musicMuted, setMusicMuted,
    sfxMuted, setSfxMuted,
    background, setBackground,
  } = useSettings()

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur flex items-center justify-center p-6">
      <div
        className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm shadow-2xl"
        style={{ border: '1px solid rgba(34,211,238,0.3)', boxShadow: '0 0 40px rgba(34,211,238,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-black text-white tracking-widest uppercase" style={{ textShadow: '0 0 10px rgba(34,211,238,0.4)' }}>
            ⚙ Settings
          </h2>
          <button onClick={closeSettings} className="text-gray-500 hover:text-white transition text-2xl leading-none">×</button>
        </div>

        {/* Audio */}
        <section className="mb-7">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Audio</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Music</span>
              <button
                onClick={() => setMusicMuted(!musicMuted)}
                className={`neon-toggle${!musicMuted ? ' neon-toggle--on' : ''}`}
                aria-label="Toggle music"
              >
                <div className="neon-toggle-knob" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Sound Effects</span>
              <button
                onClick={() => setSfxMuted(!sfxMuted)}
                className={`neon-toggle${!sfxMuted ? ' neon-toggle--on' : ''}`}
                aria-label="Toggle SFX"
              >
                <div className="neon-toggle-knob" />
              </button>
            </div>
          </div>
        </section>

        {/* Background */}
        <section className="mb-8">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Background</h3>

          {/* Preview swatch */}
          <div
            className="w-full h-16 rounded-xl mb-3 border border-gray-700 transition-all duration-500"
            style={{ background: background.css }}
          />

          <select
            value={background.id}
            onChange={e => setBackground(e.target.value as BackgroundId)}
            className="neon-select w-full"
          >
            {BACKGROUNDS.map(bg => (
              <option key={bg.id} value={bg.id}>{bg.name}</option>
            ))}
          </select>
        </section>

        <NeonButton variant="ghost" size="md" fullWidth onClick={closeSettings}>Close</NeonButton>
      </div>
    </div>
  )
}
