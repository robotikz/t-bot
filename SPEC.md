# Trading Platform MVP Specification

**Date:** September 4, 2026
**Status:** Architecture Complete
**Goal:** Minimal production-ready foundation for an algorithmic trading platform

---

## Technology Stack

### Development Environment
- **OS:** Windows 11 with WSL2 (Ubuntu 24.04)
- **Node.js:** 22 LTS
- **Package Manager:** pnpm 11.25.0

### Backend
- **Framework:** NestJS 12
- **Language:** TypeScript 6.0
- **ORM:** Prisma 8
- **Database:** PostgreSQL 17
- **HTTP Server:** Express

### Frontend
- **Framework:** Angular 22
- **UI Library:** Angular Material
- **Reactive:** RxJS 7.8
- **HTTP Client:** @angular/common/http
- **Routing:** @angular/router

### Infrastructure
- **Containers:** Docker & Docker Compose
- **Database Persistence:** Docker volumes
- **Network:** Docker bridge (CORS enabled)

### Code Quality
- **Linter:** ESLint + TypeScript plugin
- **Formatter:** Prettier
- **Config:** EditorConfig
- **TypeScript:** Strict mode

### Future Deployment
- Google Cloud Run
- Cloud SQL (PostgreSQL)
- GitHub Actions (CI/CD)

---

## Project Structure

```
trading-platform/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── modules/
│   │   │   │   ├── health/
│   │   │   │   │   ├── health.controller.ts
│   │   │   │   │   └── health.module.ts
│   │   │   │   └── config/
│   │   │   │       └── config.module.ts
│   │   │   └── prisma/
│   │   │       ├── prisma.module.ts
│   │   │       └── prisma.service.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app/
│       │   │   ├── app.ts
│       │   │   ├── app.config.ts
│       │   │   ├── app.routes.ts
│       │   │   ├── app.html
│       │   │   ├── app.css
│       │   │   ├── dashboard/
│       │   │   │   └── dashboard.component.ts
│       │   │   └── settings/
│       │   │       └── settings.component.ts
│       │   ├── styles.css
│       │   └── index.html
│       ├── package.json
│       └── angular.json
├── packages/
│   └── shared/
│       ├── src/
│       └── package.json
├── docker/
├── docs/
├── .editorconfig
├── .eslintrc.json
├── .prettierrc
├── .npmrc
├── .env.example
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## Backend Architecture

### Core Modules

#### 1. ConfigModule
- Loads environment variables from `.env`
- Centralizes configuration management
- Global scope for DI container

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - API server port (default: 3000)
- `API_PREFIX` - Global API prefix (default: api)

#### 2. PrismaModule
- Singleton PrismaService wrapping PrismaClient
- Lifecycle hooks: onModuleInit, onModuleDestroy
- Exported for use in other modules
- Automatic database connection/disconnection

#### 3. HealthModule
- Single endpoint: `GET /api/health`
- Response: `{ "status": "ok" }`
- No database dependency (health-check pattern)

### Database Schema

**Model: User** (foundation for future auth)
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
}
```

### CORS Configuration
- Origin: `http://localhost:4200` (Angular dev server)
- Credentials: enabled
- Allows frontend to make API calls in development

### Global API Prefix
- All routes prefixed with `/api`
- Example: `/health` → `/api/health`

---

## Frontend Architecture

### Core Components

#### 1. Root Component (App)
- Standalone component
- Material toolbar with navigation
- RouterOutlet for page switching
- Navigation buttons to Dashboard and Settings

#### 2. Dashboard Component
- Displays: "Trading Platform MVP"
- Calls backend `/api/health` endpoint on init
- Shows backend status (OK/ERROR/Checking...)
- Material card-based layout
- Responsive design

#### 3. Settings Component
- Placeholder for future configuration
- Material card layout
- Consistent styling with Dashboard

### Routing

```
/ → /dashboard (default)
/dashboard → DashboardComponent
/settings → SettingsComponent
```

### Module Imports
- `@angular/common/http` - HTTP client for backend calls
- `@angular/material` - UI components
- `@angular/router` - Client-side routing
- `@angular/platform-browser` - Browser platform

### Styling
- Material theme: Azure Blue
- Global CSS resets and typography
- Component-scoped styles
- Responsive layout (max-width: 960px)

---

## Docker Configuration

### Services

#### PostgreSQL
- **Image:** postgres:17
- **Container:** trading-postgres
- **Environment:**
  - POSTGRES_DB: trading_platform
  - POSTGRES_USER: postgres
  - POSTGRES_PASSWORD: postgres
- **Port:** 5432 (default PostgreSQL)
- **Volume:** postgres_data (persistent)
- **Restart Policy:** unless-stopped

### Network
- Default bridge network
- Services communicate via container names
- Frontend/Backend CORS enabled for localhost

---

## Development Workflow

### Installation

```bash
# Install all workspace dependencies
pnpm install
```

### Start PostgreSQL

```bash
# Launch database container in background
docker compose up -d

# Verify connection
docker compose logs postgres
```

### Run Backend

```bash
# Development mode (watch/hot-reload)
pnpm api:start:dev

# Runs on http://localhost:3000
# Health check: http://localhost:3000/api/health
```

### Run Frontend

```bash
# Development mode (Angular dev server)
pnpm web:start

# Runs on http://localhost:4200
# Fetches health from backend
```

### Database Setup (Optional)

```bash
# Generate Prisma client
pnpm --dir apps/api exec prisma generate

# Apply schema to database
pnpm --dir apps/api exec prisma db push
```

### Code Quality

```bash
# Run linters across workspace
pnpm lint

# Format all code
pnpm format
```

---

## Expected Runtime Behavior

### Backend Health Check

**Request:**
```
GET http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "ok"
}
```

**Status Code:** 200 OK

### Frontend Dashboard Display

**URL:** http://localhost:4200

**Rendered Output:**
```
┌─────────────────────────────────┐
│ Trading Platform                │ ← Material Toolbar
├─────────────────────────────────┤
│                                 │
│  Trading Platform MVP           │ ← Dashboard Card
│  Backend status: OK             │
│                                 │
└─────────────────────────────────┘
```

**On Error:** Displays "Backend status: ERROR"

---

## Architecture Principles

### Clean Code
- Minimal external dependencies
- Clear module boundaries
- Separation of concerns
- Production-quality code

### Scalability Foundation
- Event-driven patterns prepared for future workers
- Modular NestJS structure for service growth
- Standalone Angular components (latest pattern)
- Prisma migration system ready

### Testability
- Modular dependency injection
- Service-based architecture
- No monolithic God components
- Clear interfaces for testing

### Development Experience
- Watch mode for both backend and frontend
- Hot module reloading
- TypeScript strict mode throughout
- Consistent formatting and linting

---

## Intentional Omissions

The following are **explicitly excluded** from MVP and scheduled for future iterations:

### Authentication
- JWT tokens
- User login/registration
- Password hashing
- Role-based access control

### Exchange Integration
- Binance API
- Other exchange connectors
- Market data feeds
- Order execution

### Trading Logic
- Strategy engine
- Strategy backtesting
- Paper trading simulation
- Live trading execution

### Infrastructure
- Background workers
- Redis cache
- BullMQ job queue
- WebSocket connections
- Telegram bot integration

### DevOps
- Kubernetes orchestration
- Google Cloud deployment scripts
- CI/CD pipelines
- Container registry

---

## Success Criteria

The MVP is complete when:

✅ **Backend**
- NestJS server starts without errors
- `/api/health` endpoint returns `{ "status": "ok" }`
- Prisma client connects to PostgreSQL
- ConfigModule loads environment variables

✅ **Frontend**
- Angular dev server starts on port 4200
- Dashboard page loads successfully
- HTTP client calls backend and displays status
- Settings page is accessible
- Navigation between pages works

✅ **Infrastructure**
- PostgreSQL container runs persistently
- Environment variables are properly configured
- CORS allows frontend-to-backend communication
- Code passes ESLint and Prettier formatting

✅ **Development**
- All dependencies install via pnpm
- No TypeScript compilation errors
- Project structure matches specification
- README contains accurate instructions

---

## Next Iterations (Out of Scope)

1. **User Management** - Implement authentication and authorization
2. **Exchange Connectors** - Integrate Binance/Kraken/Coinbase APIs
3. **Strategy Engine** - Event-driven strategy execution framework
4. **Backtesting** - Historical data testing and analysis
5. **Real-time Monitoring** - WebSocket price feeds and alerts
6. **Trading Execution** - Paper and live trading modes
7. **Reporting** - Trade history, P&L, analytics
8. **Mobile App** - React Native companion app
9. **CI/CD** - GitHub Actions automation
10. **Cloud Deployment** - Google Cloud Run production setup

---

## Document Metadata

- **Created:** 2026-09-04
- **Version:** 1.0.0
- **Status:** Specification Complete
- **Last Updated:** 2026-09-04
- **Maintainer:** Trading Platform Team
