'use client'

import { useState } from 'react'
import NeonButton from './NeonButton'

interface Props {
  onClose: () => void
}

export default function BugReportModal({ onClose }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Submission failed.'); return }
      setSubmitted(true)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">

        {submitted ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-2">Report Sent!</h2>
            <p className="text-gray-400 text-sm mb-6">Thanks for helping us improve the game. We'll look into it.</p>
            <NeonButton variant="warning" size="md" fullWidth onClick={onClose}>Close</NeonButton>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Report a Bug</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition text-2xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
                  What went wrong?
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => { setTitle(e.target.value); setError(null) }}
                  placeholder="Brief summary of the issue"
                  maxLength={120}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
                  Details
                </label>
                <textarea
                  value={description}
                  onChange={e => { setDescription(e.target.value); setError(null) }}
                  placeholder="Steps to reproduce, what you expected, what happened instead…"
                  maxLength={2000}
                  rows={5}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition resize-none"
                />
                <p className="text-right text-xs text-gray-600 mt-1">{description.length}/2000</p>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-3 pt-1">
                <NeonButton type="button" variant="ghost" size="md" className="flex-1" onClick={onClose}>Cancel</NeonButton>
                <NeonButton type="submit" variant="danger" size="md" className="flex-1" disabled={submitting || !title.trim() || !description.trim()}>
                  {submitting ? 'Sending…' : 'Submit Report'}
                </NeonButton>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
