# Quran App

A high-performance, PWA-ready Quran Mushaf reader built with Next.js 16, TypeScript, and Protobuf. Optimized for "practical perfection" in rendering speed, layout stability, and offline capability.

## 🚀 Performance Architecture

### 1. URL Normalization & Redirection
To ensure a zero-flash experience and optimal SEO/Caching, the app enforces canonical URLs based on user preferences.

```mermaid
graph TD
    A[User Requests /15] --> B{Middleware}
    B -- "Cookie Exists?" --> C{Path is Bare?}
    C -- Yes --> D[307 Redirect to /15/r/m:v2/t:tr20]
    C -- No --> E[Render Page]
    B -- "No Cookie" --> E
    
    E --> F[Client Hydration]
    F --> G{localStorage Preference?}
    G -- "Different from URL?" --> H[Router.replace to Canonical]
    G -- "Matches URL" --> I[Stay & Render]
```

### 2. Server-Side Data Inlining (SSG/ISR)
Critical Mushaf data and font styles are inlined during the build process to eliminate the "Loading..." state on first paint.

```mermaid
graph TD
    A[Next.js Build / Request] --> B[Calculate Start Page]
    B --> C[FS: Read .pb Protobuf]
    C --> D[Decode & Inline Payload]
    B --> E[FS: Get Font Path]
    E --> F[Generate @font-face style]
    
    D --> G[HTML Response]
    F --> G
    
    G --> H[Browser Receives HTML]
    H --> I[Font Starts Downloading immediately]
    H --> J[React Hydrates]
    J --> K[MushafRuntime seeded with Inlined Data]
    K --> L[Instant Render - No Network Waterfall]
```

### 3. Preemptive Caching & Network Awareness
The app intelligently prefetches neighboring pages based on scroll direction and network quality.

```mermaid
graph TD
    A[User Scrolls/Swipes] --> B[Update Visible Range]
    B --> C{Low Data Mode?}
    C -- Yes --> D[Skip Prefetch]
    C -- No --> E{Slow Connection?}
    E -- Yes --> D
    E -- No --> F[Delay 400ms]
    F --> G[Prefetch Next/Prev 2 Pages]
    G --> H[Populate MushafRuntime Cache]
```

## 🛠 Features

- **SSG & ISR**: Static Site Generation for all 114 Surahs and 30 Juz.
- **Protobuf Pipeline**: Compact binary payloads for mushaf layouts.
- **PWA**: Installable on mobile/desktop with offline support via Service Workers.
- **Adaptive Modes**:
  - **Low Data Mode**: Disables all background prefetching.
  - **Low Storage Mode**: Reduces memory and font cache budgets (auto-eviction).
- **Redirection Middleware**: Server-side normalization to avoid the "default preference flash".

## 📦 Getting Started

### Prerequisites
- [Bun](https://bun.sh) (Recommended) or Node.js

### Installation
```bash
bun install
```

### Asset Generation
Before running the app, you must sync the Mushaf assets (Fonts, JSON, Protobuf):
```bash
# Sync all variants for all pages
bun run generate:mushaf-assets --codes all --all

# Or sync specific variant/pages
bun run generate:mushaf-assets --codes v2 --pages 1-10
```

### Development
```bash
bun run dev
```

### Build & Production
```bash
bun run build
bun run start
```

## 📜 Documentation

- [Performance Decisions](./docs/perf-decisions.md)
- [Revision Guidelines](./docs/revision-dos.md)
