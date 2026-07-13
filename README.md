# POS System

A point-of-sale system built with Next.js, GraphQL (Apollo), and MongoDB — register checkout, product/outlet management, and customer account limit / store credit tracking.

## Tech stack

- **Next.js** (App Router, Turbopack) + **React** + TypeScript
- **GraphQL** via Apollo Server, mounted at `/graphql` (`@as-integrations/next`, schema/resolvers split per domain under `schemas/` and `resolvers/`)
- **MongoDB** via Mongoose (`models/`)
- **NextAuth** (credentials provider, JWT sessions) for auth
- **shadcn/ui** + Radix + Tailwind for UI, **TanStack Form/Table**, **Zod** for validation, **Zustand** for client state

## Getting started

1. Copy `.env.example` to `.env.development` and fill in real values (a MongoDB connection string, and unique secrets — see the comments in the file for how to generate them).
2. Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

The app runs over HTTPS locally (self-signed cert) at `https://localhost:3000`.

## Scripts

- `npm run dev` — start the dev server (Turbopack, HTTPS)
- `npm run build` / `npm run start` — production build and start
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript, no emit
- `npm run format` — Prettier, writes in place

## Documentation

- [docs/resolvers.md](docs/resolvers.md) — what every GraphQL Query and Mutation actually does, organized by domain, including known gaps and pre-existing bugs found while writing it.
- [docs/architecture.md](docs/architecture.md) — system architecture and the checkout process flow, as diagrams.

## Adding shadcn/ui components

```bash
npx shadcn@latest add button
```

Components land in `components/ui/`; import them as `@/components/ui/button`.
