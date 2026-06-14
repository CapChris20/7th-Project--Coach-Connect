FROM node:18-slim

WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/

RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY src/shared/ ./src/shared/
COPY src/nutrition/services/ ./src/nutrition/services/
COPY src/nutrition/utils/ ./src/nutrition/utils/
COPY config/pushNotificationCopy.json ./config/pushNotificationCopy.json

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
