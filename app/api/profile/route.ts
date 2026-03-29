import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export async function GET() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_profiles')
    .select('username, avatar_url, username_updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    username: data?.username ?? null,
    avatarUrl: data?.avatar_url ?? null,
    usernameUpdatedAt: data?.username_updated_at ?? null,
  })
}
