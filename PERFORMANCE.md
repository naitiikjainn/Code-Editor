# Performance Optimizations Guide

This document outlines all performance optimizations implemented in the AI Code Editor project.

## Table of Contents
- [Backend Optimizations](#backend-optimizations)
- [Frontend Optimizations](#frontend-optimizations)
- [Database Optimizations](#database-optimizations)
- [Socket/Real-time Optimizations](#socketreal-time-optimizations)
- [Infrastructure/Docker Optimizations](#infrastructuredocker-optimizations)
- [Monitoring & Debugging](#monitoring--debugging)

---

## Backend Optimizations

### 1. Redis Caching with Stale-While-Revalidate (SWR)
**File:** `backend/middleware/cache.js`

```javascript
// Usage in routes:
import { cacheMiddleware } from '../middleware/cache.js';

router.get('/problems', cacheMiddleware({ 
    ttl: 300, // 5 minutes
    staleWhileRevalidate: true 
}), async (req, res) => { ... });
```

Features:
- Automatic Redis caching with memory fallback
- Stale-While-Revalidate pattern for better UX
- ETag support for conditional requests
- Cache invalidation helpers

### 2. Advanced Rate Limiting
**File:** `backend/middleware/rateLimiter.js`

Pre-configured limiters:
- `rateLimiters.api` - 100 requests/minute for general API
- `rateLimiters.auth` - 5 requests/minute for auth endpoints
- `rateLimiters.ai` - 20 requests/minute for AI endpoints

Features:
- Sliding window algorithm (more accurate than fixed window)
- Redis-backed with memory fallback
- Per-IP and per-user tracking
- Configurable skip conditions

### 3. Request Timing & Performance Metrics
**File:** `backend/middleware/performance.js`

```javascript
// Adds X-Response-Time and X-Request-ID headers
// Logs slow requests (>500ms warning, >2s error)
// Tracks per-endpoint statistics
```

Monitor at: `GET /api/metrics`

### 4. Circuit Breaker for External APIs
**File:** `backend/middleware/circuitBreaker.js`

Pre-configured circuits:
- `codeforces` - For CF API calls
- `leetcode` - For LC API calls
- `codechef` - For CodeChef API calls
- `gemini` - For AI API calls
- `github` - For GitHub API calls

States: CLOSED → OPEN → HALF_OPEN

### 5. Job Queue with BullMQ
**File:** `backend/utils/jobQueue.js`

Queue types:
- `scraping` - Background scraping tasks
- `ai` - AI processing tasks
- `cache-warming` - Pre-cache frequently accessed data
- `cleanup` - Database cleanup tasks

### 6. Connection Pooling
**File:** `backend/db.js`

MongoDB options:
- `maxPoolSize: 50` - Maximum connections
- `minPoolSize: 10` - Maintain minimum connections
- `maxIdleTimeMS: 30000` - Close idle connections
- Compression enabled for network traffic
- Automatic retry on failures

---

## Frontend Optimizations

### 1. React Query for Data Fetching
**Files:** `frontend/src/lib/queryClient.js`, `frontend/src/hooks/useApi.js`

```javascript
// Usage:
import { useCodeforcesProblem, useLeetcodeProblem } from '@/hooks/useApi';

function ProblemView({ contestId, problemId }) {
    const { data, isLoading, error } = useCodeforcesProblem(contestId, problemId);
    // ...
}
```

Features:
- Automatic caching (staleTime: 5 min, gcTime: 30 min)
- Background refetching
- Optimistic updates for mutations
- Query invalidation helpers
- Prefetch utilities

### 2. List Virtualization
**File:** `frontend/src/components/VirtualizedList.jsx`

```javascript
import { VirtualizedList, VirtualizedGrid, InfiniteList } from '@/components';

// Render 1000s of items efficiently
<VirtualizedList
    items={problems}
    renderItem={(problem, index) => <ProblemCard problem={problem} />}
    itemHeight={80}
    overscan={5}
/>
```

### 3. Performance Hooks
**File:** `frontend/src/hooks/usePerformance.js`

Available hooks:
- `useDebounce(value, delay)` - Debounce value changes
- `useDebouncedCallback(fn, delay)` - Debounce function calls
- `useThrottle(fn, delay)` - Throttle function calls
- `useIntersectionObserver()` - Lazy load on visibility
- `useFilteredItems(items, filters, sortFn)` - Memoized filtering

### 4. Lazy Loading Components
**File:** `frontend/src/lib/lazyLoad.jsx`

```javascript
import { lazyWithRetry, LazyComponent } from '@/lib/lazyLoad';

const HeavyComponent = lazyWithRetry(() => import('./HeavyComponent'));

// With error boundary and loading state
<LazyComponent 
    component={HeavyComponent}
    fallback={<SkeletonLoader />}
/>
```

### 5. Code Splitting (Vite)
**File:** `frontend/vite.config.js`

Automatic chunk splitting:
- `vendor-react` - React core
- `vendor-editor` - Monaco editor
- `vendor-collab` - Yjs/Socket.IO
- `vendor-ui` - UI libraries
- `vendor-query` - React Query

### 6. Optimized State Management
**File:** `frontend/src/context/AppContext.jsx`

Features:
- Selective subscriptions with `useAppSelector`
- Memoized action creators
- Persisted preferences
- Notification management

---

## Database Optimizations

### MongoDB Indexes

All models have been optimized with compound indexes:

**User Model:**
- `{ email: 1 }` - Unique, for login
- `{ username: 1 }` - Unique, for profile lookup
- `{ createdAt: -1 }` - Recent users

**File Model:**
- `{ userId: 1, folder: 1 }` - User's files by folder
- `{ userId: 1, updatedAt: -1 }` - Recent files
- `{ isPublic: 1, createdAt: -1 }` - Public files listing

**Submission Model:**
- `{ userId: 1, createdAt: -1 }` - User submissions
- `{ platform: 1, problemId: 1, createdAt: -1 }` - Problem submissions
- `{ verdict: 1, createdAt: -1 }` - Filter by verdict

**Problem Model:**
- `{ platform: 1, contestId: 1, index: 1 }` - Unique problem
- `{ platform: 1, tags: 1 }` - Filter by tags
- `{ platform: 1, difficulty: 1 }` - Filter by difficulty
- TTL index: Auto-delete cached problems after 7 days

**Room Model:**
- `{ roomId: 1 }` - Unique room
- `{ host: 1, isActive: 1 }` - Host's active rooms
- `{ lastActiveAt: 1 }` - For cleanup
- TTL index: Auto-delete inactive rooms after 24 hours

---

## Socket/Real-time Optimizations

**File:** `backend/socket/socketHandler.js`

### Throttling
```javascript
// Typing events: max 10/second
throttle(`typing:${roomId}:${socket.id}`, () => {
    socket.to(roomId).emit('user_typing', data);
}, 100);

// Draw events: 60 FPS cap
throttle(`draw:${roomId}:${socket.id}`, () => {
    socket.to(roomId).emit('draw_line', data);
}, 16);
```

### Batching
```javascript
// Batch whiteboard updates
batchEmit(roomId, 'wb_update', data, io, 100);
```

### Debouncing Database Writes
```javascript
// Debounce DB updates to prevent hammering
debounceDbUpdate(`room:${roomId}:problem`, async () => {
    await Room.findOneAndUpdate(...);
}, 1000);
```

---

## Infrastructure/Docker Optimizations

### Nginx Gateway
**File:** `docker/nginx-gateway.conf`

Features:
- Gzip compression (level 6)
- Proxy caching for problems API
- Rate limiting zones
- Connection keepalive
- WebSocket support

### Nginx Frontend
**File:** `frontend/nginx.conf`

Features:
- Gzip compression
- 1-year cache for static assets
- No-cache for HTML files
- Proper MIME types

### Docker Compose
**File:** `docker-compose.yml`

Resource limits:
- Backend: 1024MB RAM, 1 CPU
- Frontend: 512MB RAM, 0.5 CPU
- Gateway: 256MB RAM, 0.25 CPU
- MongoDB: 1024MB RAM, 1 CPU
- Redis: 512MB RAM, 0.5 CPU (LRU eviction at 256MB)

Health checks with proper timeouts and retries.

---

## Monitoring & Debugging

### Endpoints

- `GET /api/health` - Health check
- `GET /api/metrics` - Performance metrics + circuit breaker states
- `POST /api/circuits/:name/reset` - Reset a circuit breaker

### React Query Devtools

In development mode, React Query Devtools are available at the bottom-right corner of the screen.

### Request Tracing

Every request includes:
- `X-Request-ID` header for tracing
- `X-Response-Time` header for timing

### Slow Request Logging

Requests are automatically logged:
- Warning (⚠️): > 500ms
- Error (🐢): > 2000ms

---

## Usage Examples

### Fetching Problems with Caching

```javascript
// Frontend - using React Query
import { useCodeforcesProblem } from '@/hooks/useApi';

function Problem({ contestId, problemId }) {
    const { data, isLoading, error, refetch } = useCodeforcesProblem(contestId, problemId);
    
    if (isLoading) return <SkeletonLoader />;
    if (error) return <ErrorDisplay error={error} onRetry={refetch} />;
    
    return <ProblemDisplay problem={data} />;
}
```

### Debounced Search

```javascript
import { useDebounce } from '@/hooks/usePerformance';
import { useLeetcodeList } from '@/hooks/useApi';

function ProblemSearch() {
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    
    const { data } = useLeetcodeList({ search: debouncedSearch });
    
    return (
        <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search problems..."
        />
    );
}
```

### Virtualized Problem List

```javascript
import { VirtualizedList } from '@/components';

function ProblemList({ problems }) {
    return (
        <VirtualizedList
            items={problems}
            renderItem={(problem) => (
                <ProblemCard key={problem.id} problem={problem} />
            )}
            itemHeight={100}
            style={{ height: '600px' }}
        />
    );
}
```

---

## Performance Checklist

- [x] Redis caching with SWR
- [x] Rate limiting (sliding window)
- [x] Request timing/metrics
- [x] Circuit breakers for external APIs
- [x] Job queues for heavy tasks
- [x] MongoDB compound indexes
- [x] Socket throttling/batching/debouncing
- [x] Nginx compression & caching
- [x] React Query for frontend caching
- [x] List virtualization
- [x] Debounce/throttle hooks
- [x] Lazy loading components
- [x] Code splitting (Vite chunks)
- [x] Docker resource limits
- [x] Connection pooling
