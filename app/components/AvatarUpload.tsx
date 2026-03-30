'use client'

import { useRef, useState } from 'react'

interface Props {
  userId: string
  avatarUrl: string | null
  email: string
  /** 'sm' = 40px used in-game, 'lg' = 80px used on home/profile screens */
  size?: 'sm' | 'lg' | 'xl'
  onUpload?: (url: string) => void
  readOnly?: boolean
}

export default function AvatarUpload({
  avatarUrl,
  email,
  size = 'lg',
  onUpload,
  readOnly = false,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const initials = email.slice(0, 2).toUpperCase()
  const sizeClass =
    size === 'xl' ? 'w-32 h-32 text-4xl' :
    size === 'lg' ? 'w-20 h-20 text-2xl' :
                    'w-10 h-10 text-sm'

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Show instant local preview
    setPreview(URL.createObjectURL(file))
    setUploading(true)

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        setPreview(null)
        alert(json.error ?? 'Upload failed.')
        return
      }

      onUpload?.(json.avatarUrl)
      setPreview(null) // use the real URL from now on
    } catch {
      setPreview(null)
      alert('Upload failed. Check your connection and try again.')
    } finally {
      setUploading(false)
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const displayUrl = preview ?? avatarUrl

  return (
    <div
      className={`${sizeClass} relative rounded-full overflow-hidden border-2 border-amber-500/60 bg-gray-800 flex items-center justify-center font-bold text-white select-none shrink-0 ${
        !readOnly ? 'cursor-pointer group' : ''
      }`}
      onClick={() => !readOnly && !uploading && inputRef.current?.click()}
    >
      <img
        src={displayUrl ?? '/card-back.png'}
        alt="Avatar"
        className="w-full h-full object-cover"
      />

      {!readOnly && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-full">
          <span className="text-lg">{uploading ? '⏳' : '📷'}</span>
        </div>
      )}

      {uploading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {!readOnly && (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFile}
        />
      )}
    </div>
  )
}
