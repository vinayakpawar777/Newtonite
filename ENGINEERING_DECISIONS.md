# Engineering Decisions

## 1. Optimistic Concurrency Control
**Decision:** Implemented optimistic concurrency (using a `version` column) for updating work items, rather than pessimistic locking.
**Rationale:** In a high-read, highly concurrent environment, pessimistic locking (e.g., locking the row when a user starts editing) creates poor UX (users get locked out of items) and risks abandoned locks. Optimistic concurrency allows multiple people to view an item. If user A and user B both submit changes, user A succeeds, and user B gets a `409 Conflict` containing the new server state. The frontend then displays a diff/conflict resolution dialog, giving user B the option to overwrite or discard their changes.

## 2. Server-Side Idempotency via Middleware
**Decision:** Used `Idempotency-Key` headers on `POST` requests, cached via middleware.
**Rationale:** The brief mentions "a user repeating an action because they are unsure whether the first request succeeded." By generating a UUID (Idempotency Key) on the client for creations and assignments, the server can intercept duplicate keys and return the *exact same cached response* (stored in an `idempotency_keys` table) without executing the business logic twice. This prevents accidental double-creation of work items or redundant assignment events.

## 3. Append-Only Audit Log
**Decision:** Used a separate `work_item_events` table for history instead of relying solely on `updated_at` or event sourcing.
**Rationale:** To satisfy "users need to collaborate... and understand how an item has evolved over time", every mutation (create, assign, transition) inserts an append-only row in the events table in the same database transaction. While full event-sourcing (rebuilding state from events) is too complex for this timescale, an append-only audit log gives complete traceability of who did what, when, without over-engineering.

## 4. SQLite with WAL Mode and Immediate Transactions
**Decision:** Opted for SQLite (via `@libsql/client` and Drizzle) using `journal_mode=WAL` and single-node processing.
**Rationale:** Originally, Postgres was considered for `SELECT FOR UPDATE`. However, to prioritize deliverability within a single day and avoid Docker/dependency issues on Windows, SQLite was chosen. SQLite inherently serializes writes, meaning race conditions on assignments are prevented natively when wrapped in transactions, satisfying the requirement for correct behavior under concurrent usage.

## 5. Server-Sent Events (SSE) for Real-Time Updates
**Decision:** Used SSE to stream `work-item-update` events to the client, rather than WebSockets or HTTP Polling.
**Rationale:** The application requires users to see updates (e.g., someone else claiming an item) in real-time. SSE is much simpler to implement than WebSockets (since communication is strictly server-to-client), doesn't require a separate protocol, and natively handles reconnections. The frontend uses this stream to invalidate TanStack Query caches, seamlessly updating the UI without manual refreshes.
