import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, or WebP images are allowed.' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be under 5 MB.' }, { status: 400 })
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${user.id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient()

  // Delete old avatar regardless of extension before uploading new one
  await admin.storage.from('avatars').remove([`${user.id}.jpg`, `${user.id}.png`])

  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(path, buffer, { upsert: true, contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)

  // Bust the CDN cache by appending a timestamp
  const avatarUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await admin
    .from('user_profiles')
    .upsert({ user_id: user.id, avatar_url: avatarUrl }, { onConflict: 'user_id' })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ avatarUrl })
}
