FROM node:22.22.0-bookworm-slim AS web
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY public ./public
COPY index.html tsconfig.json vite.config.ts ./
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM python:3.12.12-slim-bookworm
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock && useradd --uid 10001 --create-home polaris
COPY backend ./backend
COPY migrations ./migrations
COPY alembic.ini ./
COPY scripts/container-start.sh /app/start.sh
COPY --from=web /build/dist ./dist
RUN mkdir -p /app/storage && chown -R polaris:polaris /app && chmod +x /app/start.sh
USER polaris
EXPOSE 8000
CMD ["/app/start.sh"]
