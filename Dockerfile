FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build && echo "✅ Build OK" && ls -la dist/
RUN ls dist/main.js && echo "✅ main.js mavjud"

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]