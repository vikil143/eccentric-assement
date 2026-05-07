# Asset Manager

Internal asset management platform for the marketing team.

## Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose (for local MongoDB)

## Local development

### 1. Start MongoDB

```bash
docker compose up -d mongo
```

This starts a MongoDB 7 instance on `localhost:27017` with a named volume (`mongo_data`) so data persists across restarts. To stop it:

```bash
docker compose down
```

To wipe the data volume entirely:

```bash
docker compose down -v
```

### 2. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — at minimum set MONGODB_URI if you changed any Docker defaults.
# The default MONGODB_URI=mongodb://localhost:27017/asset-manager matches the compose service above.
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start all workspaces in dev mode

```bash
npm run dev
```

The API starts on `http://localhost:3000` and the web app on `http://localhost:5173`.
