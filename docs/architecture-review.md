# Architecture and Deployment Review

## SQLite and Prisma

SQLite is the V1 database. The application uses `DATABASE_URL` and Prisma as the only database client. Application services use Prisma's provider-neutral query API and contain no SQLite SQL or file-path assumptions. The SQLite file path is configured by the environment, not hard-coded in services.

The current persistence boundary is `src/lib/prisma.ts` plus Prisma-backed services. Queries remain isolated from HTTP handlers, and no service depends on SQLite-specific behavior. A future repository layer can be introduced behind the existing service constructors if the application needs multiple database implementations.

## Database Workflows

Development database:

```text
DATABASE_URL="file:./dev.db"
```

The path resolves to `prisma/dev.db` for Prisma commands.

Common commands:

```bash
npm run prisma:generate
npm run prisma:validate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:studio
```

Use `npm run db:migrate` for local schema changes and `npm run db:deploy` for applying committed migrations in deployment environments. `npm run db:seed` inserts the reviewed question catalog into a fresh database.

Test database:

```text
DATABASE_URL="file:./test.db"
```

`npm test` creates the ignored `prisma/test.db`, applies all migrations, seeds it, and then runs Vitest with that database. `npm run db:test:setup` performs only that clean test database setup. `.env.test.example` records the test configuration without containing secrets.

Backup:

```bash
npm run db:backup
```

This copies `prisma/dev.db` to a timestamped file in `backups/`. Set `DATABASE_FILE` when backing up another SQLite file. Backups should run while the application is stopped, or after using an SQLite-consistent backup mechanism in production. Backup files are ignored by Git.

No PostgreSQL container or SQLite-specific application SQL is used. PostgreSQL remains a future deployment option through Prisma and the persistence boundary.

## Future Architecture

The existing `Game.gameType` field supports `SOLO`, `EVENT`, and `MULTIPLAYER` values. V1 validates `SOLO` at the API boundary and keeps one `userId` ownership field for the current product. Future multiplayer work should introduce participant persistence and a game-participant ownership policy rather than changing scoring rules or duplicating game logic.

Potential future concepts remain intentionally unimplemented:

- `Event` and `EventParticipant`
- `MultiplayerRoom` and `GameParticipant`
- `Achievement` and `UserAchievement`

`GameService`, `ScoringService`, and `LeaderboardService` do not depend on Fastify request or response objects. REST routes currently adapt HTTP input to these services; future WebSocket handlers, event workers, or scheduled jobs can call the same application services. WebSockets, multiplayer rooms, events, and speculative models are not part of V1.
