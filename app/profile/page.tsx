'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { validateUsername } from '@/lib/profanity'
import AvatarUpload from '@/app/components/AvatarUpload'
import NeonButton from '@/app/components/NeonButton'
import { createClient } from '@/lib/supabase'

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

export default function ProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [usernameUpdatedAt, setUsernameUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Username editing state
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [savingUsername, setSavingUsername] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/profile')
      if (res.status === 401) { router.push('/'); return }
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setUserId(data.userId)
      setEmail(data.email ?? '')
      setUsername(data.username ?? '')
      setAvatarUrl(data.avatarUrl ?? null)
      setUsernameUpdatedAt(data.usernameUpdatedAt ?? null)
      setLoading(false)
    }
    load()
  }, [router])

  // Compute cooldown remaining
  const cooldownDaysRemaining = (() => {
    if (!usernameUpdatedAt || !username) return 0
    const remaining = TWO_WEEKS_MS - (Date.now() - new Date(usernameUpdatedAt).getTime())
    if (remaining <= 0) return 0
    return Math.ceil(remaining / (24 * 60 * 60 * 1000))
  })()

  async function saveUsername() {
    const trimmed = newUsername.trim()
    const err = validateUsername(trimmed)
    if (err) { setUsernameError(err); return }

    setSavingUsername(true)
    setUsernameError(null)

    try {
      const res = await fetch('/api/profile/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) { setUsernameError(json.error ?? 'Failed to save.'); return }
      setUsername(json.username)
      setUsernameUpdatedAt(json.username_updated_at ?? null)
      setEditingUsername(false)
    } catch {
      setUsernameError('Network error. Try again.')
    } finally {
      setSavingUsername(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-950 text-white overflow-hidden min-h-0">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4 shrink-0">
        <Link href="/" className="text-gray-400 hover:text-white transition text-sm">← Back</Link>
        <h1 className="text-xl font-bold">My Profile</h1>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0"><div className="max-w-lg mx-auto p-8 space-y-8">

        {/* Avatar section */}
        <section className="flex flex-col items-center gap-4">
          {userId && (
            <AvatarUpload
              userId={userId}
              avatarUrl={avatarUrl}
              email={email}
              size="xl"
              onUpload={setAvatarUrl}
            />
          )}
          <p className="text-sm text-gray-500">Tap to upload a new photo · JPG or PNG, max 5 MB</p>
        </section>

        {/* Username section */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Username</h2>

          {editingUsername ? (
            <div className="space-y-3">
              <input
                type="text"
                value={newUsername}
                onChange={e => { setNewUsername(e.target.value); setUsernameError(null) }}
                placeholder={username}
                maxLength={20}
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500 rounded-xl px-4 py-3 text-base text-white focus:outline-none transition"
              />
              {usernameError && <p className="text-red-400 text-sm">{usernameError}</p>}
              <div className="flex gap-3">
                <NeonButton variant="warning" size="md" className="flex-1" onClick={saveUsername} disabled={savingUsername || newUsername.trim().length < 3}>
                  {savingUsername ? 'Saving…' : 'Save'}
                </NeonButton>
                <NeonButton variant="ghost" size="md" onClick={() => { setEditingUsername(false); setUsernameError(null) }}>
                  Cancel
                </NeonButton>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{username || <span className="text-gray-500 italic">Not set</span>}</span>
                {cooldownDaysRemaining > 0 ? (
                  <span className="text-xs text-gray-500">
                    Can change in {cooldownDaysRemaining} day{cooldownDaysRemaining === 1 ? '' : 's'}
                  </span>
                ) : (
                  <NeonButton variant="warning" size="xs" onClick={() => { setNewUsername(username); setEditingUsername(true) }}>
                    Edit
                  </NeonButton>
                )}
              </div>
              {cooldownDaysRemaining > 0 && (
                <p className="text-xs text-gray-600">
                  Usernames can only be changed once every 2 weeks.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Account section */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Account</h2>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Email</span>
            <span className="text-gray-300 text-sm">{email}</span>
          </div>
          <NeonButton variant="ghost" size="md" fullWidth onClick={async () => {
            await supabase.auth.signOut()
            router.push('/')
          }}>
            Sign Out
          </NeonButton>
        </section>

      </div></div>
    </div>
  )
}
