import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const { deckId } = await params

  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify the deck belongs to this user before deleting
  const { data: deck } = await admin
    .from('decks')
    .select('user_id')
    .eq('id', deckId)
    .single()

  if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
  if (deck.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin.from('decks').delete().eq('id', deckId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
