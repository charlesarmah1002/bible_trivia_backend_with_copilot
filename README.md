# Bible Trivia Backend

Node.js and TypeScript backend for an authenticated Bible trivia API using Fastify, Prisma, and SQLite.

## Backend Architecture (PLANNED)

The backend is an authenticated multiple-choice trivia platform. The architecture keeps transport, application logic, and persistence separate:

```text
HTTP/API layer (Fastify routes and controllers)
	|
Application/service layer (game, scoring, auth, leaderboard services)
	|
Repository/data access layer (interfaces and Prisma implementations)
	|
Prisma ORM
	|
SQLite
```

The planned modules are:

- `src/app/` for application creation and dependency wiring
- `src/config/` for validated environment configuration
- `src/controllers/` and `src/routes/` for HTTP concerns
- `src/services/` for business rules, including server-authoritative scoring
- `src/repositories/` for database-facing interfaces and implementations
- `src/schemas/` for Zod request and response validation
- `src/plugins/` for Fastify, JWT, Swagger, and shared infrastructure plugins
- `src/modules/` for feature-oriented boundaries as the application grows
- `tests/` for unit, integration, and API tests

Game answer handling is planned to follow this flow:

```text
POST /games/:id/answers
	|
Game controller
	|
Game service -> Scoring service
	|
Game repository
	|
Prisma -> SQLite
```

This keeps the game rules reusable for future multiplayer and WebSocket features without implementing those features in V1.

## Database Strategy (PLANNED)

- SQLite will be used through Prisma for V1.
- The development database will be `prisma/dev.db`.
- The connection will come from `DATABASE_URL="file:./dev.db"`; the path will not be hard-coded in application logic.
- A single database service will own the Prisma client lifecycle.
- Prisma migrations and a seed script will manage schema and initial question data.
- Repository interfaces will isolate application services from Prisma and SQLite details.
- Prisma queries will be preferred over raw SQLite-specific SQL to keep a future PostgreSQL migration practical.

## Technology Stack (PLANNED)

- Node.js and TypeScript
- Fastify
- Prisma ORM with SQLite
- JWT authentication
- Argon2 password hashing
- Zod validation
- Vitest automated tests
- OpenAPI and Swagger documentation
- ESLint and Prettier
- Docker support where it improves local development or deployment

## Planned API Structure (PLANNED)

The exact contracts will be defined during implementation. The planned resource groups are:

- `POST /auth/register`, `POST /auth/login`, and `POST /auth/logout`
- `GET /users/me` and profile endpoints
- `GET /questions` for authorized question administration and filtering
- `POST /games`, `GET /games/:id`, and `POST /games/:id/answers`
- `GET /leaderboards` with all-time and weekly views
- `POST /suggestions` for user-submitted question suggestions
- Admin endpoints for user, question, suggestion, and dashboard metric management
- OpenAPI documentation exposed by the Fastify application

Authentication, authorization, input validation, rate limiting, safe error responses, and password protection are planned security requirements.

## V1 Features (PLANNED)

- User registration, login, logout, usernames, profiles, and JWT authentication
- Multiple-choice questions with categories, difficulty levels, Scripture references, and explanations
- Twenty-question solo games with random, non-duplicated question selection
- Question numbering such as `Question 2 of 20`
- Server-authoritative scoring with speed bonuses, streak bonuses, and difficulty multipliers
- Game results and all-time or weekly leaderboards
- User suggestions and admin roles
- Admin dashboard metrics, user management, question management, and suggestion management
- OpenAPI documentation, automated tests, and security protections

## Future Features (PLANNED)

The architecture will leave room for events, multiplayer games, multiplayer rooms, real-time/WebSocket delivery, achievements, notifications, and additional game modes. These features are intentionally not implemented in V1.

## Backend Foundation (IMPLEMENTED)

The Node.js and TypeScript foundation is now available in `src/`. Fastify provides:

- `GET /health`, returning `{ "status": "ok" }`
- Centralized error responses
- Request logging through Fastify
- Request IDs using `x-request-id`
- CORS configuration from the environment
- Security headers through `@fastify/helmet`
- Zod-based environment validation

The Prisma SQLite schema and initial migration are also implemented. The V1 data foundation includes users, profiles, refresh tokens, questions, options, categories, Scripture references, games, game questions, game answers, game results, and suggestions. Enum-like values are stored as SQLite-compatible strings and are validated by application code as feature services are added.

## Requirements

- Node.js 20 or newer
- npm

## Installation

```bash
npm install
```

The repository includes a local `.env` for development when working in this workspace. For a new checkout, copy `.env.example` to `.env` and replace the development secret placeholders. `.env` is ignored by Git and real secrets must never be committed.

```powershell
Copy-Item .env.example .env
```

Required environment variables are `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `NODE_ENV`, and `CORS_ORIGINS`. SQLite uses:

```text
DATABASE_URL="file:./dev.db"
```

## SQLite and Prisma Setup

Generate the Prisma client and validate the schema:

```bash
npm run prisma:generate
npm run prisma:validate
```

Create or apply a development migration and seed the database with 25 Bible trivia questions:

```bash
npm run db:migrate
npm run db:seed
```

The migration creates `prisma/dev.db`. The schema uses foreign keys, indexes, normalized unique fields, and restrictive historical question links so modifying question content cannot silently remove game history.

Inspect the development database with:

```bash
npm run db:studio
```

Use `npm run db:deploy` to apply committed migrations in deployment environments. The isolated test workflow uses `prisma/test.db`; `npm test` creates it, applies migrations, seeds it, and runs the suite automatically. See [docs/architecture-review.md](docs/architecture-review.md) for the database, backup, and future architecture review.

## Development Server

```bash
npm run dev
```

The API listens on `http://localhost:3000` by default. A production-style run uses:

```bash
npm run build
npm start
```

## Testing

Run the automated tests with:

```bash
npm test
```

The current tests cover application startup, `/health`, request IDs, centralized errors, invalid environment variables, Prisma connectivity, normalized user uniqueness, question relationships, four-option and one-correct-answer invariants, game ordering, game answers, and suggestions.

Linting and formatting commands are also available:

```bash
npm run lint
npm run format
```

## Checkpoint Status

Checkpoints 1 through 15 are implemented or documented and verified. Checkpoint 16 final backend audit is complete.

## Authentication (IMPLEMENTED)

The authentication API is available under `/api/v1/auth`:

- `POST /register` validates credentials, normalizes username and email, hashes passwords with Argon2id, and creates a profile.
- `POST /login` accepts `identifier`, `username`, or `email` with a password and returns an access token, refresh token, and safe user object.
- `POST /refresh` validates and rotates a refresh token. Refresh tokens are stored only as SHA-256 hashes and old tokens are revoked.
- `POST /logout` revokes the supplied refresh token.
- `GET /me` is a protected route that demonstrates current-user authentication.
- `GET /admin-check` demonstrates server-side `ADMIN` and `SUPER_ADMIN` authorization.

Access tokens use the short-lived `JWT_SECRET` and refresh tokens use the separate `JWT_REFRESH_SECRET`. Suspended and disabled users cannot log in or use protected routes. Password hashes and token hashes are never returned by the API.

## User Profiles (IMPLEMENTED)

Profile endpoints are available under `/api/v1/users`:

- `GET /me` returns the authenticated account and safe profile fields.
- `PATCH /me` updates only `displayName`, `avatarUrl`, and `bio`. Account role, status, email, normalized identifiers, password hashes, and tokens cannot be changed through this endpoint.
- `GET /:username` returns a public profile with the username, safe profile fields, completed games played, total score, and average accuracy from `GameResult` records.

Public profile responses never expose email addresses, password hashes, refresh tokens, roles, statuses, or other private account data. Username lookup is normalized for case-insensitive access.

## Public Questions (IMPLEMENTED)

Question endpoints are available under `/api/v1/questions`:

- `GET /` returns published questions with `page`, `limit`, `category`, `difficulty`, and `type` filters.
- `GET /:id` returns one published question by ID.

Pagination responses include `data` and `pagination` metadata. Category filtering uses seeded category slugs such as `OLD_TESTAMENT` and `NEW_TESTAMENT`; difficulty values are `EASY`, `MEDIUM`, and `HARD`. Publication is enforced internally, and clients cannot request unpublished questions.

Public question options include only `id`, `text`, and `order`. The answer key, `isCorrect`, explanations, and other administrative data are never returned by these endpoints.

## Solo Games (IMPLEMENTED)

The solo game API is available under `/api/v1/games` and requires authentication:

- `POST /` accepts `{ "gameType": "SOLO", "questionCount": 20 }`. The server selects 20 random, published, multiple-choice questions, rejects client-provided question lists, and permanently stores their order in `GameQuestion`.
- `GET /:gameId` returns the game status, score, streaks, current question, question number, total questions, and progress for the owning user.
- `POST /:gameId/answers` validates ownership, game state, current-question order, option ownership, and duplicate submissions before calculating score, speed bonus, streak bonus, and difficulty multiplier on the server.
- `POST /:gameId/complete` explicitly completes an in-progress game.
- `GET /:gameId/results` returns persisted results for the owning user after completion.

The final answer automatically completes the game and creates its `GameResult`. Completed games cannot accept further answers or be completed again. Cross-user game access, arbitrary questions, arbitrary options, and client-supplied scoring values are rejected.

## Scoring Rules (IMPLEMENTED)

Scoring is calculated by the reusable `ScoringService`, never from client-provided values:

```text
subtotal = basePoints + speedBonus + streakBonus
totalPoints = round(subtotal * difficultyMultiplier)
```

- A correct answer receives `100` base points; an incorrect answer receives `0`.
- Correct answers receive speed bonuses of `+50` at 0-5 seconds, `+30` at 6-10 seconds, `+15` at 11-20 seconds, and `+0` after 20 seconds.
- Reaching a streak of 3, 5, or 10 correct answers awards `+50`, `+100`, or `+250` respectively. Other streak lengths receive no milestone bonus.
- Difficulty multipliers are `1.0` for EASY, `1.5` for MEDIUM, and `2.0` for HARD.
- Incorrect answers reset the current streak, while the longest streak remains unchanged.

Answer responses include the authoritative `basePoints`, `speedBonus`, `streakBonus`, `difficultyMultiplier`, and `totalPoints` breakdown.

## Leaderboards (IMPLEMENTED)

Leaderboard endpoints are available under `/api/v1/leaderboard`:

- `GET /` returns paginated global or weekly rankings.
- `GET /me` returns the authenticated user's rank and entry for the selected scope.
- `GET /api/v1/users/:username` continues to expose the user's safe public profile and completed-game statistics.

Leaderboard values are calculated from completed `GameResult` records at read time; no separate leaderboard table is maintained. Global scope includes all completed games. Weekly scope includes results completed since Monday 00:00 UTC of the current week. Incomplete games and results attached to non-completed games are excluded.

Ranks are deterministic: higher total score ranks first, then higher aggregate accuracy, then more completed games, then normalized username in ascending order. Pagination keeps the absolute rank, and public responses contain only `rank`, `username`, `score`, `gamesPlayed`, and `accuracy`.

## User Suggestions (IMPLEMENTED)

Suggestion endpoints are available under `/api/v1/suggestions` and require authentication:

- `POST /` accepts `QUESTION`, `QUESTION_CORRECTION`, `FEATURE`, `BUG_REPORT`, or `GENERAL` suggestions with a title and description.
- `GET /me` returns only the authenticated user's submissions.

Question suggestions may include exactly four options, a matching correct option, and a Scripture reference. New suggestions always start with `PENDING`. Users cannot submit or modify `status`, `reviewedBy`, `reviewedAt`, or `adminNotes`; those fields remain reserved for future admin workflows. Stored option and Scripture values are serialized internally but returned as structured JSON.

## Admin API (IMPLEMENTED)

All admin endpoints require `ADMIN` or `SUPER_ADMIN` authorization:

- `GET /api/v1/admin/dashboard` returns backend-calculated user, game, question, suggestion, and answer metrics.
- `GET /api/v1/admin/users`, `GET /api/v1/admin/users/:id`, and `PATCH /api/v1/admin/users/:id/status` support paginated search, status filtering, safe user details, and account status changes.
- `POST /api/v1/admin/questions`, `PATCH /api/v1/admin/questions/:id`, `DELETE /api/v1/admin/questions/:id`, and `PATCH /api/v1/admin/questions/:id/publish` manage validated multiple-choice questions.
- `GET /api/v1/admin/suggestions`, `GET /api/v1/admin/suggestions/:id`, and `PATCH /api/v1/admin/suggestions/:id` support review, approval, rejection, resolution, and admin notes.

Question administration requires exactly four ordered options with exactly one correct answer, a valid difficulty, category, and Scripture reference. Question deletion is a soft archive that unpublishes the question, preserving historical game references. Admin suggestion updates record `reviewedBy` and `reviewedAt`. Sensitive password hashes and refresh tokens are excluded from admin user and suggestion responses.

## OpenAPI and Swagger (IMPLEMENTED)

The implemented API is documented with OpenAPI 3.0.3 and served through Swagger UI:

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs/json`

The document covers authentication, users, published questions, solo games and answers, results, global and weekly leaderboards, user suggestions, and all admin endpoints. It includes request and response schemas, path/query parameters, examples, error responses, bearer JWT authentication, and the `ADMIN`/`SUPER_ADMIN` authorization requirement for admin operations. Future features are not included.

The OpenAPI document is validated in the test suite with `@apidevtools/swagger-parser`.

## Security (IMPLEMENTED)

- Passwords are hashed with Argon2id and are never returned. Authentication responses use safe user projections.
- Access JWTs expire after 15 minutes and refresh JWTs expire after 30 days. Refresh tokens are stored only as SHA-256 hashes, rotated on use, and atomically revoked to prevent concurrent replay. Logout revokes the supplied token.
- Suspended and disabled users are blocked at login and on every protected access-token request. Production requires JWT secrets of at least 32 characters.
- Fastify Helmet supplies security headers, CORS is restricted to configured origins, and every response carries an `x-request-id`.
- API requests are globally limited to 100 per minute per client IP. Authentication endpoints use a stricter 20-per-minute route limit and return a safe `429 RATE_LIMITED` response.
- Zod schemas reject unknown fields and invalid values. Error responses hide internal exception details while retaining a request ID for correlation; structured Fastify logging records server-side failures.
- Games verify ownership, fixed question membership, current-question order, option ownership, duplicate submissions, and completion state. Scores, streaks, correctness, bonuses, question selection, and leaderboard values come only from trusted server-side data.
- Admin endpoints require `ADMIN` or `SUPER_ADMIN`; public and user-facing projections exclude passwords, refresh tokens, answer keys, and unrelated account data.

## Quality Gate (VERIFIED)

The current backend quality pass is green:

- `npm test`: 72 tests passing across 14 test files
- `npm run build`: passing
- `npm run lint`: passing
- `npx prisma validate`: passing
- Clean SQLite lifecycle: all three migrations applied, 25 seed questions inserted, and application startup verified with `GET /health` returning `200 {"status":"ok"}`

Vitest database-backed files run serially to avoid SQLite lock contention during integration tests. The test suite covers authentication, authorization, statuses, question secrecy and filters, game integrity and completion, scoring, leaderboards, suggestions, admin APIs, security controls, and OpenAPI validation.

## Final Backend Audit (VERIFIED)

An independent audit was completed against a clean temporary SQLite database. The audit applied all migrations, seeded 25 questions, started the compiled API, verified Swagger at `/docs`, then exercised registration, login, solo game creation, all 20 ordered answers, automatic completion, results, and leaderboard access over HTTP. The persisted audit game finished with `COMPLETED`, `currentQuestionIndex: 20`, `questionCount: 20`, and score `4100`.

The audit also corrected the production start command to use the actual TypeScript output path: `node dist/src/server.js`.
