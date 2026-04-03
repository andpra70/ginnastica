# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist ./

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
