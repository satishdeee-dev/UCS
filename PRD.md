# UCS — Offline-first Unified Communications for Field Teams

## Product Overview

UCS is a messaging, voice-note, and lightweight-video app for field teams operating in intermittent-connectivity environments: construction sites, disaster response, rural healthcare.

The product is **offline-first**: every action works without a network connection. Data is written locally, and syncs opportunistically when connectivity returns. Conflict resolution is automatic via CRDTs.

Core differentiators:
1. **Offline-first by default** — local-first writes, background sync, no "you're offline" dead-ends.
2. **CRDT-based conflict resolution** — concurrent edits from multiple field users merge cleanly.
3. **On-device AI** — voice notes are transcribed and made searchable locally, with no round trip to the cloud.
4. **Adaptive media compression** — voice and image payloads scaled to available bandwidth.

## Tech Stack (finalized)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript | Server components for static shell, client components for offline-aware UI |
| Styling | Tailwind CSS + shadcn/ui | |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) | Cloud source-of-truth |
| Local DB | Dexie (IndexedDB) | Local-first store, persists across sessions |
| Sync / CRDT | Yjs + custom Supabase persistence adapter | Conflict-free merge of concurrent edits |
| On-device AI | Transformers.js — Whisper-tiny (transcription), all-MiniLM-L6-v2 (embeddings) | Runs in browser, no network required |
| Cloud AI | OpenRouter | Used only when online; degrades gracefully |
| Forms | React Hook Form + Zod | |
| Payments | MyFatoorah or Tap | Phase 2+ |
| Monitoring | Sentry + Google Analytics | |
| Deployment | Vercel | |

## Architectural Principles

1. **Local store is the source of truth for the UI.** Reads always come from Dexie. The UI never blocks on a network call.
2. **Writes go to Dexie first, then enqueue for sync.** A background worker drains the queue when online.
3. **CRDT-backed entities** (messages, comments, document edits) merge automatically across devices. Non-CRDT entities (user profile, role) use last-write-wins with server timestamp.
4. **Realtime is a fast lane, not the source of truth.** Supabase Realtime pushes updates *into* Dexie; the UI re-renders from Dexie.
5. **AI features split by network requirement:**
   - **Always works offline:** voice transcription, semantic search over local history
   - **Requires connection:** chatbot, summarization, content generation, image analysis, sentiment

---

## MVP — Phase 1

> Scope: prove the offline-first thesis end-to-end. Auth, messaging, voice notes with on-device transcription, semantic search. No maps, no group chat, no admin panel in Phase 1.

### 1. Email & Password Auth
- [ ] Register with email + password (min 8 chars), hashed by Supabase Auth
- [ ] Login fails gracefully with "Invalid credentials"
- [ ] Forgot-password email reset flow
- [ ] **Offline behavior:** users who logged in once can use the app offline; auth token cached in IndexedDB with refresh on reconnect

### 2. Local-First Data Layer
- [ ] Dexie schema for `messages`, `voice_notes`, `users` tables
- [ ] All reads come from Dexie; UI never awaits a network call
- [ ] Yjs document per conversation, persisted to Dexie
- [ ] Sync queue table tracks pending writes with retry + backoff

### 3. Background Sync
- [ ] Service worker (or browser online/offline events) detects connectivity changes
- [ ] On reconnect, sync queue drains: local writes → Supabase
- [ ] Supabase Realtime subscribes to remote changes → merged into local Yjs docs
- [ ] Sync status indicator in UI (synced / syncing / offline)

### 4. 1:1 Messaging (CRDT-backed)
- [ ] User can send a text message to another user; message visible instantly in own UI
- [ ] Message persisted to Dexie + Yjs doc; enqueued for sync
- [ ] When online, message replicates to recipient via Supabase
- [ ] Concurrent messages from both sides merge in chronological order
- [ ] Message history paginated (50 per load) from Dexie

### 5. Voice Notes
- [ ] User records audio in browser via MediaRecorder API
- [ ] Audio stored as Blob in Dexie; uploaded to Supabase Storage when online
- [ ] Adaptive compression: bitrate scales to network conditions (Opus codec)
- [ ] Playback works offline once downloaded once

### 6. On-Device Transcription
- [ ] Whisper-tiny model loaded via Transformers.js on first voice note (lazy load)
- [ ] Transcription runs locally after recording; result stored in Dexie alongside audio
- [ ] Transcript shown under voice note; searchable
- [ ] Model cached in IndexedDB / Cache Storage after first download (~75MB one-time)

### 7. Semantic Search
- [ ] all-MiniLM-L6-v2 embedding model loaded via Transformers.js
- [ ] Every message + transcript embedded on creation; vector stored in Dexie
- [ ] Search bar accepts natural language query → embedded → cosine similarity over local vectors
- [ ] Results returned in <500ms for up to 10k messages
- [ ] Works fully offline

### 8. Online / Offline Presence
- [ ] Presence tracked via Supabase Realtime when online
- [ ] Green dot for online; "last seen" timestamp when offline
- [ ] Updates within 5s of connect/disconnect

### 9. User Avatars
- [ ] Avatar uploaded to Supabase Storage `avatars` bucket (public)
- [ ] Avatar URL cached in Dexie; image cached by service worker for offline display
- [ ] Falls back to initials placeholder

### 10. Image Uploads (in messages)
- [ ] User attaches an image to a message
- [ ] Image stored locally in Dexie as Blob; thumbnail generated client-side
- [ ] Upload to Supabase Storage when online; bucket is user-scoped via RLS
- [ ] Max 5MB; jpg/png/webp only; Supabase image transform generates 200×200 + 800px variants

### 11. In-App Notifications
- [ ] `notifications` table in Supabase mirrored to Dexie
- [ ] Unread count in nav bar, updates via Realtime when online
- [ ] Tapping a notification marks read + navigates

---

## Phase 2 — Post-MVP

> Adds features that depend on Phase 1 working, or that are explicitly cloud-bound.

### Group Chat (CRDT-backed)
- Same model as 1:1, with a member list on the Yjs doc.

### Typing Indicators & Read Receipts
- Realtime-only (no offline meaning); presence channel.

### Cloud AI (OpenRouter)
- **AI Chatbot** — domain-scoped assistant, requires connection, message history in Dexie
- **Summarization** — long-form content summary, on-demand, online-only
- **Sentiment analysis** — color-coded badge, online-only, batched
- **Content generation** — draft generator, online-only
- **Image analysis** — vision model, online-only

Each cloud AI feature shows a "requires connection" state when offline rather than failing silently.

### Maps & Location
- Map render (Mapbox or Leaflet), responsive, tiles cached for offline view of last-seen region
- Location markers from Supabase
- Geocoding search (online-only)
- Distance calc (Haversine, offline)
- Live location sharing (online-only; 5s broadcast cadence; ephemeral, not persisted)

### Documents
- PDF/DOCX upload to Supabase Storage, max 10MB
- Stored locally as Blob in Dexie when downloaded for offline access

### Social
- Likes / reactions (CRDT counter)
- Comments (CRDT list)
- Follows
- @mentions with autocomplete + notification
- Activity feed (followed users)

### Admin
- User management (list, search, deactivate, audit log)
- Content moderation (soft delete)
- Analytics dashboard (Recharts, 5-min refresh)
- CSV export

### Notifications
- Email (Resend, branded template, unsubscribe)
- Transactional emails (welcome, action confirmations)
- Preferences (JSONB in users table, toggleable)
- Scheduled reminders (Supabase cron)

### Predictive Analytics
- OpenRouter generates forecasts from historical Supabase data; confidence indicator shown

---

## Phase 3 — Research Spike

> Not committed. Time-boxed exploration only.

### Native Mesh Networking
- Package the app via Capacitor as a native iOS/Android shell
- Use platform mesh APIs (Multipeer Connectivity on iOS, Wi-Fi Direct + Bluetooth on Android) or libp2p
- Sync Yjs docs peer-to-peer over local mesh when no internet is available
- This is a hard research problem; treat as a 2-week spike to assess viability, not a feature commitment

---

## Out of Scope

- 1:1 messaging is the only conversation type in Phase 1 (group chat is Phase 2)
- No video calls (the PRD said "lightweight video" — interpreted as recorded video clips, deferred to Phase 2 alongside voice notes scope expansion)
- No payment integration in Phase 1
- No mesh networking in Phase 1 (Phase 3 research spike)
- No Phi-3-mini on-device LLM (too heavy for browser; OpenRouter handles summarization when online)

## Open Questions

1. **Multi-device per user:** does a single user need to be logged in on multiple devices simultaneously with CRDT sync across them? (Affects Yjs awareness setup.)
2. **Voice note retention:** do voice notes expire after some time, or persist forever? (Affects Storage cost and local cache eviction policy.)
3. **Vector storage at scale:** Dexie-stored vectors work for ~10k messages per user. Beyond that, do we need pgvector + cloud fallback?
4. **Auth offline policy:** how long is a cached auth token valid before forcing reconnection? (Default: 7 days, configurable.)
