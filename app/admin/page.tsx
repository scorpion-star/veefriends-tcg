'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

type Report = {
  filename: string
  content: string
}

function parseField(content: string, field: string): string {
  const line = content.split('\n').find(l => l.startsWith(`${field}:`))
  return line ? line.slice(field.length + 1).trim() : '—'
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const res = await fetch('/api/admin/bug-reports')
      if (res.status === 403) { router.push('/'); return }
      if (!res.ok) { setError('Failed to load reports.'); setLoading(false); return }

      const json = await res.json()
      setReports(json.reports)
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = reports.filter(r =>
    !search.trim() ||
    r.content.toLowerCase().includes(search.toLowerCase()) ||
    r.filename.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white transition text-sm">← Home</Link>
          <h1 className="text-xl font-bold">Admin — Bug Reports</h1>
        </div>
        <span className="text-sm text-gray-500">{reports.length} total</span>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-5">
        {error && <p className="text-red-400">{error}</p>}

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search reports…"
          className="w-full bg-gray-900 border border-gray-700 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition"
        />

        {filtered.length === 0 && (
          <p className="text-gray-500 text-center py-16">
            {reports.length === 0 ? 'No bug reports yet.' : 'No reports match your search.'}
          </p>
        )}

        <div className="space-y-3">
          {filtered.map(report => {
            const title    = parseField(report.content, 'Title') === '—'
              ? report.content.split('\n').find(l => l.trim() && !l.includes(':')) ?? report.filename
              : (() => {
                  // Title is on the line after "Title:"
                  const lines = report.content.split('\n')
                  const idx = lines.findIndex(l => l.startsWith('Title:'))
                  return idx !== -1 ? (lines[idx + 1]?.trim() || report.filename) : report.filename
                })()
            const username = parseField(report.content, 'Username')
            const date     = parseField(report.content, 'Date')
            const isOpen   = expanded === report.filename

            return (
              <div key={report.filename} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-800/50 transition"
                  onClick={() => setExpanded(isOpen ? null : report.filename)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{username} · {date}</p>
                  </div>
                  <span className="text-gray-600 shrink-0">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-800 px-5 py-4">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {report.content}
                    </pre>
                    <p className="text-xs text-gray-600 mt-3 font-mono">File: bug-reports/{report.filename}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
