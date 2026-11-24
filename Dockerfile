FROM node:20-alpine

WORKDIR /app

# Install OpenSSL & wget for Prisma engine on Alpine Linux
RUN apk add --no-cache openssl wget

# Copy package descriptors
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci || npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src/
COPY public ./public/
COPY docker-entrypoint.sh ./

RUN chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=7578
ENV HOST=0.0.0.0
ENV DATABASE_URL="file:/app/data/spaces.db"

EXPOSE 7578

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
