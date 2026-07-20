# MAPPING_NOTES — eou admin telemetry

App id: `eou`  
Contract: Unified Telemetry Contract (admin-dashboard-spec.md §2)  
Dashboard: embedded at `/admin` (aggregator-ready endpoints under `/api/admin/telemetry/*`)

## Active user definition

- **Creator-active (documented primary):** increments `active_users` on daily rollups when a signed-in actor emits `content.created` or `content.updated`. This is a **counter**, not distinct DAU — treat as activity volume among creators.
- **Consumer volume:** `quiz_attempts.created_at` counts. Attempts have **no `user_id`** (anonymous respondents), so true consumer DAU/retention is **not available**. Do not invent identities.

## Registration

- Authoritative: `profiles.created_at` (created by `handle_new_user` on `auth.users` insert).
- Live emit: `AuthController.signup` → `user.registered`.
- Backfill: all `profiles` rows.
- PII: admin UI shows `display_name` + truncated `user_id` only (no email).

## Content entities (`content.*`)

| entity_type | Source | Notes |
|---|---|---|
| `quiz` | `quizzes` create/draft | Drafts have `user_id=null` + `draft_token` |
| `versus_quiz` | `quizzes` with `title LIKE '[Versus]%'` | Convention only — not a DB enum |
| `question_pack` | `question_packs` CRUD | |
| `couple_session` | create / join / finalize completed | Completed also counted as content.created |

`content.updated` includes draft claim and quiz patch.

## Links (§5.4 — applicable)

- **link.created** = `invitations` rows.
- **link.interacted** = `quiz_attempts` with metadata:
  - `interaction_kind: 'invite_attempt'` when `invitation_id` set
  - `interaction_kind: 'open_quiz_attempt'` when quiz `is_open`
- Apps without links would show N/A; eou **has** invitations.

## Errors (§5.5)

Definition (most user-meaningful available):
1. Server unhandled / 5xx via `errorHandler` → `error.reported` (`source: server`)
2. Client reports via `POST /api/admin/telemetry/client-error` (`source: client`)
3. Versus integrity: `versusFlags.cheated` / `timedOut` on attempt submit → `error.reported` severity `warn` with `kind: versus_cheated|versus_timed_out`

**v1 is read-only** — no acknowledge/resolve writes.

## System health (§5.6)

- In-process latency ring buffer (5-minute window) + DB ping via `profiles` head select.
- Snapshots persisted every 5 minutes to `telemetry_health_snapshots`.
- **N/A:** queue depth, DB connection pool metrics (not exposed by Supabase client).

## Funnel (eou-specific drill-down)

Drafts (`user_id` null + `draft_token`) → owned quizzes → invitations → attempts → couple completed.  
**Gap:** no `claimed_at` timestamp — claim only clears `draft_token`.

## Explicit N/A (do not invent)

- Page views / route analytics
- Session duration / last_active on profiles
- Pack → quiz attribution
- `polls` table (unused in product flows)
- Billing / subscriptions
- Multi-app aggregator UI (this repo is single-app)

## Timezone

- All storage UTC (`occurred_at`, rollup `date` as UTC calendar day).
- UI renders with `toLocaleString()` in the admin’s local timezone.

## Backfill

- Settings → Telemetry → “Run backfill” calls `POST /api/admin/telemetry/backfill`.
- Skips if `telemetry_events` already has rows for `app_id=eou`.
- Historical rollups rebuilt as events are inserted.

## Auth

- Every telemetry/usage admin route: `requireAuth` + `requireAdmin` (`has_role(..., 'admin')`).
- Dashboard gear icon shown only when `useAuth().isAdmin`.
- Soft UI gate; server 403 is authoritative.

## SSE limitation

- Live stream is in-process `EventEmitter` — **single API instance only**. Multiple replicas would need Redis pub/sub (out of scope).
