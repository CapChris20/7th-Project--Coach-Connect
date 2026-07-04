FROM node:20-slim

WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/

RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY src/shared/ ./src/shared/
COPY src/ai-coach/ ./src/ai-coach/
COPY src/nutrition/ ./src/nutrition/
COPY src/metrics/daily-metrics/ ./src/metrics/daily-metrics/
COPY config/pushNotificationCopy.json ./config/pushNotificationCopy.json

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
