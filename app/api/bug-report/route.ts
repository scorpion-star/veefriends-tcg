import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, description } = await req.json()
  if (!title?.trim())       return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  if (!description?.trim()) return NextResponse.json({ error: 'Description is required.' }, { status: 400 })
  if (title.trim().length > 120)        return NextResponse.json({ error: 'Title too long (max 120 chars).' }, { status: 400 })
  if (description.trim().length > 2000) return NextResponse.json({ error: 'Description too long (max 2000 chars).' }, { status: 400 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('user_profiles')
    .select('username')
    .eq('user_id', user.id)
    .maybeSingle()

  const { error } = await admin
    .from('bug_reports')
    .insert({
      user_id:     user.id,
      username:    profile?.username ?? null,
      email:       user.email,
      title:       title.trim(),
      description: description.trim(),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
