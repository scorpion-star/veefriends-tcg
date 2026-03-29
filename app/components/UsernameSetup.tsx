'use client'

import { useState } from 'react'
import { validateUsername } from '@/lib/profanity'

interface Props {
  onComplete: (username: string) => void
}

export default function UsernameSetup({ onComplete }: Props) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    const clientError = validateUsername(trimmed)
    if (clientError) { setError(clientError); return }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/profile/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong.'); return }
      onComplete(json.username)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-amber-700/40 rounded-3xl p-10 w-full max-w-sm shadow-2xl">
        <h2 className="text-2xl font-black text-white mb-2 text-center">Choose a Username</h2>
        <p className="text-gray-400 text-sm text-center mb-8">
          3–20 characters · letters, numbers, underscores only
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={value}
            onChange={e => { setValue(e.target.value); setError(null) }}
            placeholder="e.g. VeeFan99"
            maxLength={20}
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500 rounded-2xl px-5 py-4 text-lg text-white focus:outline-none transition"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={saving || value.trim().length < 3}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl text-lg transition shadow-lg shadow-amber-900/30"
          >
            {saving ? 'Saving…' : 'Set Username'}
          </button>
        </form>
      </div>
    </div>
  )
}
