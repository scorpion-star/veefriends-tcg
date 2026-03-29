---
name: Game system architecture
description: How the multiplayer game system is structured — tables, routes, realtime
type: project
---

Per-user isolation confirmed: decks and user_inventory both filtered by user_id with RLS.

Game system uses server-authoritative API routes to prevent cheating:
- POST /api/game/create — matchmaking (quick/private) and game session creation
- POST /api/game/action — validates and applies game actions (challenge/accept/decline/sprint)
- POST /api/game/cancel-queue — removes user from matchmaking queue

Realtime via Supabase postgres_changes on game_sessions and matchmaking_queue tables.

**Why:** Admin/service-role client used in API routes so game state cannot be manipulated client-side.
**How to apply:** Never allow clients to write game_state directly; always go through /api/game/action.
