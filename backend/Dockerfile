# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Runtime stage
FROM node:20-alpine

WORKDIR /app

ENV PORT=5000
ENV NODE_ENV=production

# Install g++ for C++ compilation (CSES judge)
RUN apk add --no-cache g++

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app .

EXPOSE 5000

CMD ["npm", "start"]
