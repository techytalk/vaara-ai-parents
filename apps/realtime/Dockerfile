FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci
RUN npm run build:realtime

ENV NODE_ENV=production

CMD ["node", "apps/realtime/dist/index.js"]
