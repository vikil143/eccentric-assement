# Asset Manager

Internal asset management platform for the marketing team.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Clone the Repository](#clone-the-repository)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Start MongoDB (Docker)](#start-mongodb-docker)
- [Install Dependencies](#install-dependencies)
- [Run the Application](#run-the-application)
- [Running Frontend and Backend Separately](#running-frontend-and-backend-separately)
- [Available Scripts](#available-scripts)
- [Cloudinary Setup](#cloudinary-setup)
- [Seed the Database](#seed-the-database)
- [Things to Consider](#things-to-consider)

---

## Prerequisites

Make sure the following are installed on your machine before getting started:

| Tool | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org/) | ≥ 20 | JavaScript runtime |
| npm | ≥ 10 (comes with Node 20) | Package manager |
| [Docker](https://www.docker.com/) | any recent | Run MongoDB locally |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ | Orchestrate containers |
| [Git](https://git-scm.com/) | any | Clone the repository |

> **Tip:** Use [nvm](https://github.com/nvm-sh/nvm) to manage Node versions. A `.nvmrc` file is included — run `nvm use` in the project root to switch to the correct version automatically.

---

## Clone the Repository

```bash
git clone <repository-url>
cd asset-manager
```

---

## Project Structure

```
asset-manager/
├── apps/
│   ├── api/          # Express + TypeScript backend (port 3000)
│   └── web/          # React + Vite frontend (port 5173)
├── packages/
│   └── shared/       # Shared TypeScript types used by both apps
├── docker-compose.yml
└── package.json      # npm workspaces root
```

This is an **npm workspaces monorepo**. All `npm` commands should be run from the **project root** unless stated otherwise.

---

## Environment Variables

### Backend — `apps/api/.env`

The backend is the only app that requires environment variables. Copy the example file and fill in the values:

```bash
cp apps/api/.env.example apps/api/.env
```

Then open `apps/api/.env` and set the following:

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port the API server listens on |
| `NODE_ENV` | No | `development` | Runtime environment (`development` / `production`) |
| `MONGODB_URI` | **Yes** | `mongodb://localhost:27017/asset-manager` | MongoDB connection string — the default matches the Docker Compose setup below |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | — | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | **Yes** | — | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | **Yes** | — | Your Cloudinary API secret |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin for CORS; comma-separate multiple origins |
| `MAX_UPLOAD_MB` | No | `10` | Maximum allowed upload file size in megabytes |

> **Never commit your `.env` file.** It is already listed in `.gitignore`. Only commit `.env.example` with placeholder values.

### Frontend — `apps/web`

The frontend has **no `.env` file required** for local development. All API calls are proxied through Vite's dev server (`/api` → `http://localhost:3000`), so no API URL needs to be hardcoded.

---

## Start MongoDB (Docker)

The project ships with a `docker-compose.yml` that runs MongoDB 7 locally.

```bash
# Start MongoDB in the background
docker compose up -d mongo
```

MongoDB will be available at `mongodb://localhost:27017/asset-manager`. Data is persisted in a named Docker volume (`mongo_data`) so it survives container restarts.

```bash
# Stop the container (data is kept)
docker compose down

# Stop the container AND delete all data
docker compose down -v
```

> If you already have MongoDB running locally on port 27017, you can skip Docker and just point `MONGODB_URI` in your `.env` to your existing instance.

---

## Install Dependencies

From the project root, install all workspace dependencies in one command:

```bash
npm install
```

This installs packages for `apps/api`, `apps/web`, and `packages/shared` simultaneously via npm workspaces.

---

## Run the Application

Start **all workspaces** (frontend + backend) concurrently:

```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend (React + Vite) | http://localhost:5173 |
| Backend (Express API) | http://localhost:3000 |
| API docs (Swagger UI) | http://localhost:3000/api-docs |

The Vite dev server automatically proxies requests from `/api/*` on port 5173 to the backend on port 3000, so you never need to deal with CORS during development.

---

## Running Frontend and Backend Separately

If you want to start each app independently (useful for debugging or running only one at a time):

**Backend only:**

```bash
npm run dev -w apps/api
```

**Frontend only:**

```bash
npm run dev -w apps/web
```

> The frontend will still proxy `/api` requests to `localhost:3000`, so the backend must be running for API calls to work.

---

## Available Scripts

Run these from the project root:

| Command | Description |
|---|---|
| `npm run dev` | Start all workspaces in development/watch mode |
| `npm run build` | Compile TypeScript and build all workspaces |
| `npm run typecheck` | TypeScript type-check all workspaces (no output files) |
| `npm run lint` | Run ESLint across all workspaces |
| `npm run format` | Run Prettier across all workspaces |
| `npm run test` | Run Vitest unit tests across all workspaces |
| `npm run test:watch` | Run Vitest in watch mode |

---

## Cloudinary Setup

Media files (images, videos) are stored in [Cloudinary](https://cloudinary.com/). You need a free Cloudinary account to use upload features.

1. Sign up at https://cloudinary.com/
2. Go to your **Dashboard** → copy **Cloud Name**, **API Key**, and **API Secret**
3. Paste them into `apps/api/.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

> The frontend never communicates with Cloudinary directly. All uploads go through the API, which forwards them to Cloudinary.

---

## Seed the Database

A seed script is available to populate the database with sample data for local development:

```bash
npm run seed -w apps/api
```

> Make sure MongoDB is running and `MONGODB_URI` is set in `apps/api/.env` before seeding.

---

## Things to Consider

- **Node version:** Use Node ≥ 20. Run `node -v` to confirm. If using nvm, run `nvm use` in the root.
- **Port conflicts:** Ensure ports `3000` (API), `5173` (web), and `27017` (MongoDB) are free before starting.
- **All code is ESM:** Every package uses `"type": "module"`. Import paths in TypeScript source files must use `.js` extensions (e.g., `import { foo } from './foo.js'`).
- **Shared types:** Domain types live in `packages/shared/src/`. Never duplicate type definitions between `apps/api` and `apps/web` — import from `@asset-manager/shared` instead.
- **Upload size limit:** The default `MAX_UPLOAD_MB=10` applies to individual file uploads. Increase it in `.env` if needed.
- **CORS:** In development the Vite proxy handles cross-origin requests, so `CORS_ORIGIN` only matters when the frontend is served from a different origin (e.g., staging or production).
- **Pre-commit hooks:** ESLint and Prettier run automatically on commit via pre-commit hooks. Run `npm run lint` and `npm run format` before opening a PR to avoid surprises.
