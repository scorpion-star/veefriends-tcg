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
}

const DIFF_ICON: Record<Difficulty, string> = { easy: '🟢', medium: '🟡', hard: '🔴' }

const BLANK_FORM = { name: '', difficulty: 'easy' as Difficulty, is_boss: false, coins_reward: 1 }

function AvatarOrInitials({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div
      className="rounded-full overflow-hidden bg-gray-700 border border-gray-600 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {url
        ? <img src={url} alt={name} className="w-full h-full object-cover" />
        : <span className="font-bold text-gray-300" style={{ fontSize: size * 0.35 }}>{initials}</span>}
    </div>
  )
}

export default function AdminJourneyPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      await fetchOpponents()
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
        body: JSON.stringify({ ...form, stage_order: maxOrder + 1 }),
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
    const a = opponents[idx]
    const b = opponents[swapIdx]

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
      const d = await res.json()
      setError(d.error)
    }
    setUploadingAvatarId(null)
  }

  function openEdit(o: Opponent) {
    setEditingId(o.id)
    setForm({ name: o.name, difficulty: o.difficulty, is_boss: o.is_boss, coins_reward: o.coins_reward })
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

      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {error && (
          <div className="bg-red-950 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {opponents.length === 0 && !showForm && (
          <div className="text-center text-gray-500 py-16">
            <p className="text-5xl mb-4">🗺</p>
            <p className="text-gray-400">No opponents yet. Add one to get started.</p>
          </div>
        )}

        {/* Opponent list */}
        {opponents.map((o, index) => (
          <div key={o.id} className={`bg-gray-900 border rounded-2xl p-4 flex items-center gap-4 ${o.is_boss ? 'border-yellow-600/50' : 'border-gray-800'}`}>
            {/* Avatar + upload */}
            <div className="relative group shrink-0">
              <AvatarOrInitials url={o.avatar_url} name={o.name} size={56} />
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
                <span className="font-bold text-base">{o.name}</span>
                {o.is_boss && <span className="text-xs bg-yellow-800/60 text-yellow-300 px-2 py-0.5 rounded-full">BOSS</span>}
              </div>
              <div className="text-sm text-gray-400 mt-0.5 flex items-center gap-3">
                <span>{DIFF_ICON[o.difficulty]} {o.difficulty}</span>
                <span>🪙 {o.coins_reward} coin{o.coins_reward !== 1 ? 's' : ''}</span>
                <span className="text-gray-600">Stage {index + 1}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => handleMove(o.id, 'up')} disabled={index === 0} className="p-2 text-gray-500 hover:text-white disabled:opacity-20 transition">↑</button>
              <button onClick={() => handleMove(o.id, 'down')} disabled={index === opponents.length - 1} className="p-2 text-gray-500 hover:text-white disabled:opacity-20 transition">↓</button>
              <button onClick={() => openEdit(o)} className="p-2 text-gray-500 hover:text-blue-400 transition">✎</button>
              <button onClick={() => handleDelete(o.id)} className="p-2 text-gray-500 hover:text-red-400 transition">✕</button>
            </div>
          </div>
        ))}

        {/* Add / Edit form */}
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
                  <button
                    key={d}
                    onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 capitalize transition ${
                      form.difficulty === d
                        ? d === 'easy' ? 'border-green-500 bg-green-900/30'
                          : d === 'medium' ? 'border-yellow-500 bg-yellow-900/20'
                          : 'border-red-500 bg-red-900/30'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    {DIFF_ICON[d]} {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Coins Reward</label>
                <input
                  type="number"
                  min={0}
                  value={form.coins_reward}
                  onChange={e => setForm(f => ({ ...f, coins_reward: Number(e.target.value) }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                  <input
                    type="checkbox"
                    checked={form.is_boss}
                    onChange={e => setForm(f => ({ ...f, is_boss: e.target.checked }))}
                    className="w-4 h-4 accent-yellow-400"
                  />
                  <span className="text-sm">👑 Boss stage</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 py-3 rounded-xl font-semibold text-sm transition"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Opponent'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setForm(BLANK_FORM) }}
                className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input ref (unused but kept for ref pattern) */}
      <input ref={avatarInputRef} type="file" className="hidden" accept="image/*" />
    </div>
  )
}
