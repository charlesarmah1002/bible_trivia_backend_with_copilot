FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

RUN npm run prisma:generate
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

# Apply pending migrations against the live DATABASE_URL, then start the server.
# No seed step here — run seeding manually/once via a Render Shell or Job, not on every boot.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]