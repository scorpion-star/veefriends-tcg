'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type Difficulty = 'easy' | 'medium' | 'hard'

type Opponent = {
  id: string
  name: string
  avatar_url: string | null
  difficulty: Difficulty
  is_boss: boolean
  coins_reward: number
  stage_order: number
  section: number
  position_x: number
  position_y: number
}

const DIFF_ICON: Record<Difficulty, string> = { easy: '🟢', medium: '🟡', hard: '🔴' }
const BLANK_FORM = { name: '', difficulty: 'easy' as Difficulty, is_boss: false, coins_reward: 1, section: 1 }

function AvatarOrInitials({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div className="rounded-full overflow-hidden bg-gray-700 border border-gray-600 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}>
      {url
        ? <img src={url} alt={name} className="w-full h-full object-cover" />
        : <span className="font-bold text-gray-300" style={{ fontSize: size * 0.35 }}>{initials}</span>}
    </div>
  )
}

export default function AdminJourneyPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const mapRef = useRef<HTMLImageElement>(null)

  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(null)
  const [mapImages, setMapImages] = useState<Record<number, string>>({})
  const [uploadingMap, setUploadingMap] = useState(false)
  const [placingId, setPlacingId] = useState<string | null>(null)
  const [activeMapSection, setActiveMapSection] = useState(1)
  const TOTAL_MAPS = 10

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      await Promise.all([fetchOpponents(), fetchSettings()])
      setLoading(false)
    }
    load()
  }, [supabase, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchOpponents() {
    const res = await fetch('/api/admin/journey')
    if (res.status === 403) { setError('Admin access required.'); return }
    const d = await res.json()
    setOpponents(d.opponents ?? [])
  }

  async function fetchSettings() {
    const res = await fetch('/api/admin/journey/settings')
    if (res.ok) {
      const d = await res.json()
      const images: Record<number, string> = {}
      for (let i = 1; i <= TOTAL_MAPS; i++) {
        if (d[`map_${i}`]) images[i] = d[`map_${i}`]
      }
      setMapImages(images)
    }
  }

  async function handleMapUpload(file: File, section: number) {
    setUploadingMap(true)
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('section', String(section))
    const res = await fetch('/api/admin/journey/map', { method: 'POST', body: fd })
    if (res.ok) {
      const { mapUrl } = await res.json()
      setMapImages(prev => ({ ...prev, [section]: mapUrl }))
    } else {
      setError((await res.json()).error)
    }
    setUploadingMap(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)

    if (editingId) {
      const res = await fetch('/api/admin/journey', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form }),
      })
      if (!res.ok) { setError((await res.json()).error); setSaving(false); return }
    } else {
      const maxOrder = opponents.length > 0 ? Math.max(...opponents.map(o => o.stage_order)) : 0
      const res = await fetch('/api/admin/journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, stage_order: maxOrder + 1, position_x: 50, position_y: 50 }),
      })
      if (!res.ok) { setError((await res.json()).error); setSaving(false); return }
    }

    await fetchOpponents()
    setShowForm(false)
    setEditingId(null)
    setForm(BLANK_FORM)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this opponent?')) return
    await fetch('/api/admin/journey', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setOpponents(prev => prev.filter(o => o.id !== id))
  }

  async function handleMove(id: string, dir: 'up' | 'down') {
    const idx = opponents.findIndex(o => o.id === id)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === opponents.length - 1) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    const a = opponents[idx], b = opponents[swapIdx]
    const reordered = [...opponents]
    reordered[idx] = { ...b, stage_order: a.stage_order }
    reordered[swapIdx] = { ...a, stage_order: b.stage_order }
    setOpponents(reordered.sort((x, y) => x.stage_order - y.stage_order))
    await Promise.all([
      fetch('/api/admin/journey', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, stage_order: b.stage_order }) }),
      fetch('/api/admin/journey', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, stage_order: a.stage_order }) }),
    ])
  }

  async function handleAvatarUpload(opponent: Opponent, file: File) {
    setUploadingAvatarId(opponent.id)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/admin/journey/${opponent.id}/avatar`, { method: 'POST', body: fd })
    if (res.ok) {
      const { avatarUrl } = await res.json()
      setOpponents(prev => prev.map(o => o.id === opponent.id ? { ...o, avatar_url: avatarUrl } : o))
    } else {
      setError((await res.json()).error)
    }
    setUploadingAvatarId(null)
  }

  async function handleMapClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!placingId || !mapRef.current) return
    const rect = mapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const px = Math.round(x * 10) / 10
    const py = Math.round(y * 10) / 10

    setOpponents(prev => prev.map(o => o.id === placingId ? { ...o, position_x: px, position_y: py } : o))
    await fetch('/api/admin/journey', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: placingId, position_x: px, position_y: py }),
    })
    setPlacingId(null)
  }

  function openEdit(o: Opponent) {
    setEditingId(o.id)
    setForm({ name: o.name, difficulty: o.difficulty, is_boss: o.is_boss, coins_reward: o.coins_reward, section: o.section ?? 1 })
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-white text-sm transition">← Admin</Link>
        <h1 className="text-xl font-bold flex-1">Journey Opponents</h1>
        <button
          onClick={() => { setEditingId(null); setForm(BLANK_FORM); setShowForm(true) }}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-sm font-semibold transition"
        >
          + Add Opponent
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-950 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* ── Map section ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Journey Maps</h2>
              <div className="flex items-center gap-1">
                <button onClick={() => { setPlacingId(null); setActiveMapSection(s => Math.max(1, s - 1)) }} disabled={activeMapSection === 1} className="px-2 py-0.5 text-gray-400 hover:text-white disabled:opacity-20 transition text-lg">‹</button>
                <span className="text-sm font-bold text-white w-16 text-center">Map {activeMapSection}/{TOTAL_MAPS}</span>
                <button onClick={() => { setPlacingId(null); setActiveMapSection(s => Math.min(TOTAL_MAPS, s + 1)) }} disabled={activeMapSection === TOTAL_MAPS} className="px-2 py-0.5 text-gray-400 hover:text-white disabled:opacity-20 transition text-lg">›</button>
              </div>
            </div>
            <label className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-semibold transition ${
              uploadingMap ? 'bg-gray-700 opacity-50 cursor-wait' : 'bg-gray-700 hover:bg-gray-600'
            }`}>
              {uploadingMap ? 'Uploading…' : mapImages[activeMapSection] ? '↑ Replace Map' : '↑ Upload Map'}
              <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleMapUpload(f, activeMapSection) }} />
            </label>
          </div>

          {mapImages[activeMapSection] ? (
            <div className="relative rounded-2xl overflow-hidden border border-gray-700">
              {placingId && (
                <div className="absolute inset-0 z-10 bg-blue-900/30 border-2 border-blue-400 flex items-center justify-center pointer-events-none rounded-2xl">
                  <div className="bg-blue-900/90 text-blue-200 px-4 py-2 rounded-xl text-sm font-semibold shadow-xl pointer-events-none">
                    Click on the map to place "{opponents.find(o => o.id === placingId)?.name}"
                  </div>
                </div>
              )}
              <img
                ref={mapRef}
                src={mapImages[activeMapSection]}
                alt={`Map ${activeMapSection}`}
                className={`w-full h-auto block ${placingId ? 'cursor-crosshair' : ''}`}
                onClick={handleMapClick}
                draggable={false}
              />
              {/* Opponent nodes for this section only */}
              {opponents.filter(o => (o.section ?? 1) === activeMapSection).map(o => (
                <div key={o.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 ${placingId === o.id ? 'opacity-30' : ''}`}
                  style={{ left: `${o.position_x ?? 50}%`, top: `${o.position_y ?? 50}%`, pointerEvents: 'none' }}>
                  <div className={`rounded-full overflow-hidden border-2 shadow-lg ${o.is_boss ? 'border-yellow-400' : 'border-white'}`} style={{ width: 32, height: 32 }}>
                    {o.avatar_url
                      ? <img src={o.avatar_url} alt={o.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs font-black text-gray-300">{o.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                    }
                  </div>
                  <div className="bg-gray-900/90 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap shadow">
                    {o.name.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-700 rounded-2xl p-12 text-center text-gray-500">
              <p className="text-4xl mb-2">🗺</p>
              <p className="text-sm">Upload an image for Map {activeMapSection}</p>
            </div>
          )}

          {placingId && (
            <button onClick={() => setPlacingId(null)} className="mt-2 text-sm text-gray-400 hover:text-white transition">
              Cancel placement
            </button>
          )}
        </section>

        {/* ── Opponent list ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Opponents</h2>

          {opponents.length === 0 && !showForm && (
            <div className="text-center text-gray-500 py-12 bg-gray-900 rounded-2xl border border-gray-800">
              <p className="text-4xl mb-3">👤</p>
              <p className="text-gray-400">No opponents yet. Add one to get started.</p>
            </div>
          )}

          {opponents.map((o, index) => (
            <div key={o.id} className={`bg-gray-900 border rounded-2xl p-4 flex items-center gap-4 ${o.is_boss ? 'border-yellow-600/50' : 'border-gray-800'}`}>
              {/* Avatar + upload */}
              <div className="relative group shrink-0">
                <AvatarOrInitials url={o.avatar_url} name={o.name} size={52} />
                <button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/jpeg,image/png,image/webp'
                    input.onchange = e => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) handleAvatarUpload(o, file)
                    }
                    input.click()
                  }}
                  className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-semibold"
                >
                  {uploadingAvatarId === o.id ? '…' : '📷'}
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{o.name}</span>
                  {o.is_boss && <span className="text-xs bg-yellow-800/60 text-yellow-300 px-2 py-0.5 rounded-full">BOSS</span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-3 flex-wrap">
                  <span>{DIFF_ICON[o.difficulty]} {o.difficulty}</span>
                  <span>🪙 {o.coins_reward}</span>
                  <span className="text-gray-600">Map {o.section ?? 1} · #{index + 1}</span>
                  <span className="text-gray-600">
                    pos {Math.round(o.position_x ?? 50)}%, {Math.round(o.position_y ?? 50)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {mapImages[o.section ?? 1] && (
                  <button
                    onClick={() => { setActiveMapSection(o.section ?? 1); setPlacingId(placingId === o.id ? null : o.id) }}
                    className={`p-2 text-sm transition rounded-lg ${placingId === o.id ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-blue-400'}`}
                    title="Place on map"
                  >
                    📍
                  </button>
                )}
                <button onClick={() => handleMove(o.id, 'up')} disabled={index === 0} className="p-2 text-gray-500 hover:text-white disabled:opacity-20 transition">↑</button>
                <button onClick={() => handleMove(o.id, 'down')} disabled={index === opponents.length - 1} className="p-2 text-gray-500 hover:text-white disabled:opacity-20 transition">↓</button>
                <button onClick={() => openEdit(o)} className="p-2 text-gray-500 hover:text-blue-400 transition">✎</button>
                <button onClick={() => handleDelete(o.id)} className="p-2 text-gray-500 hover:text-red-400 transition">✕</button>
              </div>
            </div>
          ))}
        </section>

        {/* ── Add / Edit form ── */}
        {showForm && (
          <div className="bg-gray-900 border border-blue-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-lg">{editingId ? 'Edit Opponent' : 'New Opponent'}</h2>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Opponent name"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Difficulty</label>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                  <button key={d} onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 capitalize transition ${
                      form.difficulty === d
                        ? d === 'easy' ? 'border-green-500 bg-green-900/30' : d === 'medium' ? 'border-yellow-500 bg-yellow-900/20' : 'border-red-500 bg-red-900/30'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}>
                    {DIFF_ICON[d]} {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Coins Reward</label>
                <input type="number" min={0} value={form.coins_reward}
                  onChange={e => setForm(f => ({ ...f, coins_reward: Number(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Map Section</label>
                <input type="number" min={1} value={form.section}
                  onChange={e => setForm(f => ({ ...f, section: Number(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                  <input type="checkbox" checked={form.is_boss}
                    onChange={e => setForm(f => ({ ...f, is_boss: e.target.checked }))}
                    className="w-4 h-4 accent-yellow-400" />
                  <span className="text-sm">👑 Boss</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-semibold text-sm transition">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Opponent'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(BLANK_FORM) }}
                className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
