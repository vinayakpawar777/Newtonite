# Newtonite OpsBoard

A high-performance operational work-item management system built for the Newtonite Engineering Challenge.

## Features & Critical Behaviors

This application implements several critical non-CRUD behaviors to ensure data integrity in a highly concurrent environment:

1. **Optimistic Concurrency Control**: Uses a `version` field and HTTP `If-Match` headers to prevent stale updates. If a user tries to modify a record that has changed since they fetched it, they receive a `409 Conflict` and a resolution UI.
2. **Idempotent Mutations**: Uses `Idempotency-Key` headers for creations and assignments. The server intercepts duplicate keys and returns the cached response, preventing accidental double-submissions.
3. **Atomic Assignment**: While originally designed with `SELECT FOR UPDATE` on Postgres, the SQLite implementation uses an atomic transaction under WAL mode coupled with an optimistic version check to guarantee that two users cannot claim the same item simultaneously.
4. **State Machine Transitions**: Status updates (e.g., `open` -> `in_progress`) enforce strict workflow rules defined centrally in the backend. 
5. **Resource-Level Authorization**: API endpoints verify team membership and roles before allowing mutations, preventing unauthorized users from modifying items outside their purview.

## Technologies Used

- **Backend**: Node.js, Express, TypeScript, Zod
- **Database**: SQLite (via `@libsql/client`), Drizzle ORM
- **Frontend**: React, Vite, TypeScript, TanStack Query, Vanilla CSS (Glassmorphism theme)
- **Real-time**: Server-Sent Events (SSE)

## How to Run

Since Docker was not available in this environment, the application uses a local SQLite database, removing the need for external infrastructure.

### 1. Start the Backend

```bash
cd server
npm install
npm run db:push
npm run db:seed
npm run dev
```

The server will start on `http://localhost:3000`. The database will be seeded with an admin and standard user account.

### 2. Start the Frontend

Open a new terminal:

```bash
cd client
npm install
npm run dev
```

The frontend will start on `http://localhost:5173`.

### 3. Demo Credentials

The database is seeded with two accounts:

- **Admin User**: `admin@newtonite.com` / `password`
- **Standard User**: `user@newtonite.com` / `password`

## Running Tests

Integration tests cover the highest-risk behaviors (Concurrency, Idempotency, State Machine).

```bash
cd server
npm test
```

## Known Limitations

- **File Attachments**: Not implemented.
- **Advanced Filtering/Sorting**: The backend supports pagination and basic querying, but the frontend currently only fetches all items for a selected team to fit within the time constraint.
- **BullMQ/Redis**: Due to environment constraints, async processing queues via Redis were dropped in favor of synchronous processing to ensure a functioning deliverable.
