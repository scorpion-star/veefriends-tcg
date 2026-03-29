import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { validateUsername } from '@/lib/profanity'

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username } = await req.json()
  const validationError = validateUsername(username?.trim() ?? '')
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const trimmed = username.trim()
  const admin = createAdminClient()

  // Load current profile
  const { data: current } = await admin
    .from('user_profiles')
    .select('username, username_updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  // Enforce 2-week cooldown (skip if this is the first time setting a username)
  if (current?.username && current.username !== trimmed) {
    if (current.username_updated_at) {
      const lastChanged = new Date(current.username_updated_at).getTime()
      const remaining = TWO_WEEKS_MS - (Date.now() - lastChanged)
      if (remaining > 0) {
        const days  = Math.ceil(remaining / (24 * 60 * 60 * 1000))
        return NextResponse.json(
          { error: `You can change your username again in ${days} day${days === 1 ? '' : 's'}.` },
          { status: 429 }
        )
      }
    }
  }

  // Enforce uniqueness — once taken, permanently reserved for that user
  const { data: taken } = await admin
    .from('user_profiles')
    .select('user_id')
    .eq('username', trimmed)
    .neq('user_id', user.id)
    .maybeSingle()

  if (taken) return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 })

  const now = new Date().toISOString()
  const isChanging = current?.username && current.username !== trimmed

  const { error } = await admin
    .from('user_profiles')
    .upsert(
      {
        user_id:              user.id,
        username:             trimmed,
        username_updated_at:  isChanging ? now : (current?.username_updated_at ?? now),
      },
      { onConflict: 'user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    username: trimmed,
    username_updated_at: isChanging ? now : current?.username_updated_at ?? now,
  })
}
