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

// GET — public, returns map_image_url
export async function GET() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('journey_settings')
    .select('key, value')

  const settings: Record<string, string> = {}
  for (const row of data ?? []) settings[row.key] = row.value
  return NextResponse.json(settings)
}

// POST — admin only, upserts a key/value
export async function POST(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { key, value } = body
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('journey_settings')
    .upsert({ key, value }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
