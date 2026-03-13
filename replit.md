# Lumina POS

## Overview

POS + Inventory + Delivery Management System — a full-stack web application with React frontend and Express + PostgreSQL backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, React Query, Tailwind CSS, shadcn/ui, Recharts, wouter

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── pos-app/            # React + Vite POS frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## System Modules

- **Dashboard** — Daily sales summary (total sales, invoice count, products sold, top products, low stock warnings)
- **Products** — CRUD with category filter, search, date filter, low stock alerts (≤5)
- **Categories** — Simple CRUD
- **Sales / Invoices** — Create/edit invoices, auto last-sale price, quick product search, duplicate invoice
- **Customer History** — Purchase history searchable by customer, product, date range
- **Deliveries** — Create deliveries (DL-001 format), group invoices by customer, show/hide price, TXT export
- **Damaged Items** — Track damaged products with status (Damaged/Repaired/Sold Again)
- **Invoice Transfers** — Transfer items between invoices (stock does NOT change), transfer history
- **Reports** — Sales analytics with charts, date range filter
- **History Logs** — Audit trail of all actions
- **Backup & Restore** — Export/import JSON backup

## Database Schema

Tables:
- `categories` — product categories
- `products` — products with stock tracking
- `deliveries` — delivery trips
- `invoices` — sales invoices
- `invoice_items` — line items for each invoice
- `damaged_items` — damaged product records
- `transfers` — invoice item transfer history
- `history_logs` — audit logs

## API Routes

All routes prefixed with `/api`:
- `GET/POST /categories`
- `GET/POST/PUT/DELETE /products`
- `GET/POST/PUT/DELETE /invoices`, `/invoices/:id/duplicate`, `/invoices/last-price`
- `GET /customers/history`, `/customers/names`
- `GET/POST/PUT/DELETE /deliveries`, `/deliveries/:id/detail`
- `GET/POST/PUT/DELETE /damaged`, `/damaged/check/:productId`
- `GET/POST /transfers`
- `GET /reports/dashboard`, `/reports/sales`
- `GET /history`
- `GET /backup/export`, `POST /backup/import`

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes
