import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await params
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_profiles')
    .select('username, avatar_url')
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json({
    username: data?.username ?? null,
    avatarUrl: data?.avatar_url ?? null,
  })
}
