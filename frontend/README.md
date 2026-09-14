# ARIA Frontend Application

> **Next.js 16 + React 19 Enterprise Client for 3D LiDAR Annotation RAG Intelligence.**

ARIA's frontend is a responsive web application tailored for autonomous driving perception engineers, LiDAR annotators, and QA leads. It features real-time Server-Sent Events (SSE) streaming, interactive multi-source citation chips, SOP document management, and an administrative knowledge gap resolver.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16.3.2 (App Router, Turbopack, Standalone Output)
- **UI & Runtime**: React 19.2.8, TypeScript 5
- **Styling**: Tailwind CSS v4, PostCSS, `@tailwindcss/postcss`
- **Component Primitives**: shadcn/ui, Radix / Base UI, Lucide React icons
- **Authentication**: Clerk (`@clerk/nextjs` v7) with RS256 JWT validation
- **Animation & Transitions**: Tailwind animate, CSS hardware-accelerated motion

---

## 📂 Project Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/           # Clerk custom sign-in page
│   │   ├── sign-up/           # Clerk custom sign-up page
│   │   └── login/             # ARIA login portal
│   ├── (dashboard)/
│   │   ├── layout.tsx         # Responsive dashboard shell (Sidebar + Header)
│   │   ├── dashboard/         # Live metrics, stats & workflow launchpad
│   │   ├── chat/              # Real-time SSE streaming RAG assistant
│   │   ├── documents/         # SOP catalog, upload modal, version viewer
│   │   ├── admin/             # Database KPIs & Knowledge Gap resolver
│   │   ├── search/            # Standalone hybrid retrieval explorer
│   │   └── profile/           # User profile & organization details
│   ├── globals.css            # ARIA design tokens, theme variables, glassmorphism
│   └── layout.tsx             # Root HTML layout & ClerkProvider wrapper
│
├── components/
│   ├── chat/                  # CitationModal, MarkdownRenderer, ReasoningAccordion
│   ├── layout/                # Sidebar, Header, UserMenu
│   └── ui/                    # Button, Dialog, Card, StatCard, EmptyState, Skeleton
│
├── lib/
│   ├── api.ts                 # Unified fetch client with dynamic proxy fallback
│   ├── utils.ts               # Classname merge (clsx + twMerge)
│   └── services/
│       ├── chat.ts            # SSE streaming parser & feedback dispatcher
│       ├── documents.ts       # Document upload, versioning, download & stats
│       ├── search.ts          # Hybrid search test query service
│       └── admin.ts           # Admin KPI fetcher & gap resolution
│
├── middleware.ts              # Clerk authentication edge middleware
└── next.config.ts             # Standalone output & /api/v1 backend proxy rewrites
```

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Create `.env.local` in the `frontend/` directory:

```ini
# Backend API URL (for local development)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend proxy URL (used by Next.js rewrites)
BACKEND_URL=http://localhost:8000

# Clerk Authentication Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk Route Redirects
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Production Build & Containerization

### Standalone Production Build

```bash
npm run build
npm run start
```

### Docker Build

The frontend is optimized with a multi-stage Docker build producing a minimal Alpine Linux image:

```bash
docker build -t aria-frontend .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000 \
  -e NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_... \
  aria-frontend
```

---

## 🛡️ Authentication & Backend Communication

1. **Edge Route Protection**:
   [middleware.ts](file:///frontend/middleware.ts) protects all `/(dashboard)/*` routes, redirecting unauthenticated visitors to `/sign-in`.

2. **Smart Base URL & Proxying**:
   [lib/api.ts](file:///frontend/lib/api.ts) detects when running in production over HTTPS. If `NEXT_PUBLIC_API_URL` contains `localhost`, it automatically switches to relative `/api/v1/*` URLs. These requests are proxied directly to the backend service via [next.config.ts](file:///frontend/next.config.ts) rewrites, preventing mixed-content and CORS errors.

3. **Bearer Token Transmission**:
   Client requests automatically attach the Clerk session JWT in the `Authorization: Bearer <token>` header for verification by the FastAPI backend.

