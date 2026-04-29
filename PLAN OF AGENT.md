**Recommended Libraries (What + Why)**

Backend (Bun + Express):
- `express`: REST API routing and middleware pipeline (matches your `entityX.routes.ts` + global error handler pattern).
- `socket.io` + `@socket.io/bun-engine`: real-time game events with Bun-native engine integration.
- `drizzle-orm` + `pg` + `drizzle-kit`: PostgreSQL access + schema/migration generation (`drizzle-kit generate`, as you required).
- `ioredis`: queue/state caching, matchmaking helpers, and pub/sub style coordination.
- `chess.js`: main legal move validation, FEN/SAN/UCI flow.
- `chessops` (optional support library): useful for richer board/position operations if needed later.
- `jsonwebtoken` + `bcryptjs`: auth/session token + password hashing.
- `cookie-parser`, `cors`, `helmet`, `express-rate-limit`: baseline API hardening.
- `pino` (or `pino-http`): structured logging.

Frontend (Next.js + shadcn):
- `socket.io-client`: live game, clocks, reconnect flow.
- `@tanstack/react-query`: API caching/loading/error state around your common `Api` util.
- `react-chessboard`: board UI.
- `chess.js`: client-side move preview + notation display.
- `recharts` (or `nivo`): rating history chart.
- `date-fns`: formatting dates for history/replay pages.
- Keep shadcn/ui for UI primitives and consistent design system.

**Architecture Mapping to Your Entity Pattern**

Start with these entities:
- `auth`
- `users`
- `ratings`
- `matchmaking`
- `challenges`
- `games`
- `moves`
- `annotations`
- `presence` (optional in phase 1, useful for online state)

Each follows:
- `entityX.repo.ts` DB-only
- `entityX.service.ts` business logic singleton
- `entityX.controller.ts` request/response
- `entityX.routes.ts` router only
- optional `utils/config/middleware` per entity
- cross-entity calls only via `OtherEntity.service.ts`

Global:
- `shared/errors/AppError.ts`
- `shared/middleware/error-handler.ts`
- `shared/middleware/not-found.ts`
- `shared/types/*.ts` including interfaces as `{name}_I`

**Implementation Plan**

1. Foundation setup
- Finalize backend folder skeleton under `/src/entities`.
- Add `AppError` + global Express error middleware.
- Add `ENV` config and logger bootstrap.
- Wire `/api` base router and health route.

2. Database + migrations
- Translate `SCHEMAS.md` into Drizzle schema files.
- Configure `drizzle.config.ts`.
- Run migration generation (no manual SQL authoring first).
- Add DB client + transaction helper.

3. Auth + users
- Implement `auth` and `users` entities end-to-end.
- JWT issue/verify middleware.
- Basic profile fetch/update routes (no input validation yet, per your rule).

4. Ratings + ledger
- Implement ratings read/update services.
- Add post-game rating ledger transaction flow.

5. Matchmaking + challenges
- Queue join/leave and direct challenge create/respond.
- Redis-assisted queue matching loop.
- Game creation trigger when match found.

6. Games + moves (core chess)
- Game create/load/state sync service.
- Move submission pipeline: fetch game -> validate via `chess.js` -> persist move -> update clocks/fen/turn.
- Result finalization: resign/draw/timeout/checkmate and ledger updates.

7. Realtime socket layer
- Socket server with `@socket.io/bun-engine`.
- Namespaces/rooms: `game:{id}`, `user:{id}`.
- Event contracts for move, clock tick, draw offer, resign, reconnect state sync.

8. Replay + annotations
- Game history list endpoints.
- Move replay endpoint.
- Annotation CRUD linked to game/move/FEN.

9. Frontend API + route architecture
- Implement shared `Api` util: `Api.{method}("/x") -> {API_URL}/api/x`.
- Add route-local `components/providers/utils` structure for each major route:
  - `/play`
  - `/game/[id]`
  - `/history`
  - `/profile/[username]`

10. Frontend real-time game UX
- Board, clocks, move list, player cards.
- Socket integration with optimistic updates + server reconciliation.
- Replay screen with step controls and annotations.

11. Hardening + tests
- Unit tests for service-layer chess and rating logic.
- Integration tests for game lifecycle endpoints.
- Reconnect/desync and clock edge-case tests.
- Add validation phase later when you approve library.

**Key Decision**
- Since you explicitly want Socket.IO + Bun, use `@socket.io/bun-engine` instead of generic Node HTTP adapters to stay aligned with current Bun-native support.

**Sources**
- Bun + Drizzle guide: [bun.com/docs/guides/ecosystem/drizzle](https://bun.com/docs/guides/ecosystem/drizzle)
- Drizzle PostgreSQL docs: [orm.drizzle.team/docs/get-started-postgresql](https://orm.drizzle.team/docs/get-started-postgresql)
- Bun WebSocket/server docs: [bun.com/docs/api/websockets](https://bun.com/docs/api/websockets)
- Socket.IO Bun engine package: [npmjs.com/package/@socket.io/bun-engine](https://www.npmjs.com/package/%40socket.io%2Fbun-engine)
- Socket.IO site/news: [socket.io](https://socket.io/)
- chessops package: [npmjs.com/package/chessops](https://www.npmjs.com/package/chessops)

If you want, next I can convert this into a concrete task checklist file with per-entity endpoint contracts and implementation order per day.