import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

async function assertAdmin() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase())
  if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) return null
  return user
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

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
  const path = `opponents/${id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient()
  await admin.storage.from('avatars').remove([`opponents/${id}.jpg`, `opponents/${id}.png`])

  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(path, buffer, { upsert: true, contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = `${publicUrl}?t=${Date.now()}`

  const { error: dbError } = await admin
    .from('cpu_opponents')
    .update({ avatar_url: avatarUrl })
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ avatarUrl })
}
