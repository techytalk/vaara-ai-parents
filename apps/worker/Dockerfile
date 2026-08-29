FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci
RUN npm run build:worker

ENV NODE_ENV=production

CMD ["node", "apps/worker/dist/index.js"]
