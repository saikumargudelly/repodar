# A2A Services Testing & Monitoring Guide

Complete guide for testing and monitoring the A2A Service Catalog system in real-time.

## Overview

The A2A testing framework consists of multiple utilities designed for different purposes:

| Tool | Purpose | Mode | Duration | When to Use |
|------|---------|------|----------|------------|
| `test_a2a.py` | Basic API validation | Quick | ~30s | Initial verification |
| `test_a2a_full.py` | Integration testing | Complete | ~2-5m | Full feature validation |
| `test_a2a_realtime.py` | Live performance testing | Real-time | ~5-10m | Active system monitoring |
| `test_a2a_monitor.py` | Continuous health monitoring | Continuous | Unlimited | Production monitoring |
| `test_a2a_load.py` | Load & stress testing | Stress | ~2-5m | Capacity testing |

## Prerequisites

1. **Backend running**: Start the backend first
   ```bash
   cd backend
   source .venv/bin/activate
   python -m uvicorn app.main:app --reload --port 8000
   ```

2. **Dependencies installed**: All test tools use `httpx` and standard library only
   ```bash
   # If needed:
   pip install httpx
   ```

## Test Utilities

### 1. Basic API Tests (`test_a2a.py`)

**Purpose**: Quick validation of all API endpoints without data setup

**Features**:
- 9 test scenarios
- No data seeding required
- ~30 second runtime
- Basic health checks

**Usage**:
```bash
cd backend
source .venv/bin/activate
python test_a2a.py
```

**What it tests**:
- ✓ Backend health check
- ✓ List services endpoint
- ✓ Single service retrieval
- ✓ Search functionality
- ✓ Filter operations
- ✓ Error handling (404s)
- ✓ SSRF protection

**Example output**:
```
═══════════════════════════════════════════════════════════════════════════
  BASIC API TESTS FOR A2A SERVICES
═══════════════════════════════════════════════════════════════════════════

● Backend Health           ✓ PASS (45.2ms)
● List Services            ✓ PASS (32.1ms)
● Single Service           ✓ PASS (28.9ms)
...
Result: 9/9 passed ✅
```

---

### 2. Integration Tests (`test_a2a_full.py`)

**Purpose**: Complete feature validation with database integration

**Features**:
- 10 comprehensive test scenarios
- Automatic data seeding (3 test services + 6 capabilities)
- ~2-5 minute runtime
- Performance metrics
- SSRF protection validation

**Usage**:
```bash
cd backend
source .venv/bin/activate
python test_a2a_full.py
```

**What it tests**:
- ✓ Data seeding (3 services with 2 capabilities each)
- ✓ SSRF protection (localhost, RFC-1918, reserved IPs)
- ✓ List all services
- ✓ Filter by status (active/unreachable/invalid)
- ✓ Filter by category (rag/retrieval)
- ✓ Search capabilities (full-text)
- ✓ Single service retrieval with capability table
- ✓ Filter by provider
- ✓ 404 error handling
- ✓ Performance metrics

**Example output**:
```
═══════════════════════════════════════════════════════════════════════════
  INTEGRATION TESTS - A2A SERVICE CATALOG
═══════════════════════════════════════════════════════════════════════════

Seed Test Data: ✓ PASS (3 services seeded)
SSRF Protection: ✓ PASS (localhost blocked, loopback blocked, RFC-1918 blocked)
List Services: ✓ PASS (3 services retrieved)
Filter by Status: ✓ PASS (3 active services)
...
Performance: ✓ PASS (14-67ms all queries)

Result: 10/10 passed ✅
```

---

### 3. Real-Time Performance Tests (`test_a2a_realtime.py`)

**Purpose**: Monitor performance and functionality while backend is running

**Features**:
- 10 real-time test scenarios
- Performance metrics aggregation
- Concurrent request handling (10 parallel)
- Data consistency validation
- ~5-10 minute runtime
- Color-coded output with detailed analytics

**Usage**:
```bash
cd backend
source .venv/bin/activate
python test_a2a_realtime.py
```

**What it tests**:
- ✓ List services with data retrieval
- ✓ Filter by status (3 filters)
- ✓ Filter by category
- ✓ Full-text search
- ✓ Single service retrieval
- ✓ Filter by provider
- ✓ Error handling (404s, SSRF)
- ✓ Performance (avg/min/max response times)
- ✓ Concurrent requests (10 parallel)
- ✓ Data consistency (3 sequential fetches)

**Example output**:
```
═══════════════════════════════════════════════════════════════════════════
  REAL-TIME TESTS FOR A2A SERVICES
═══════════════════════════════════════════════════════════════════════════

Test 1: List Services
  Response Time: 45.2ms
  Services Retrieved: 3
  First Service: RAG Engine (active)
  ✓ PASS

Test 2: Filter by Status - active
  Response Time: 38.1ms
  Active Services: 3
  ✓ PASS

...

Performance Analysis:
  Avg Response Time: 42.3ms
  Min Response Time: 28.9ms
  Max Response Time: 67.1ms

Concurrency Test:
  Parallel Requests: 10
  Success Rate: 100%
  Avg Response: 39.2ms

Data Consistency:
  Fetches: 3
  Consistency: 100%
  ✓ PASS

Result: 10/10 passed ✅
```

---

### 4. Continuous Monitor (`test_a2a_monitor.py`)

**Purpose**: Real-time health monitoring and statistics collection

**Features**:
- Continuous endpoint monitoring
- Service statistics tracking
- Performance metrics collection
- Configurable intervals
- Runs indefinitely or for set duration

**Usage - Single Check**:
```bash
cd backend
source .venv/bin/activate
python test_a2a_monitor.py
```

**Usage - Continuous Monitoring**:
```bash
# Monitor every 30 seconds (default)
python test_a2a_monitor.py --continuous

# Monitor every 10 seconds
python test_a2a_monitor.py --continuous --interval=10

# Monitor for 5 minutes (300 seconds)
python test_a2a_monitor.py --continuous --duration=300

# Monitor for 1 hour every 60 seconds
python test_a2a_monitor.py --continuous --interval=60 --duration=3600
```

**Features**:
- ✓ Real-time health checks
- ✓ Response time tracking
- ✓ Service statistics (total, by status, by provider)
- ✓ Performance percentiles (avg, median, p95, p99)
- ✓ Configurable intervals and duration
- ✓ Stops on Ctrl+C with summary stats

**Example Output**:
```
──────────────────────────────────────────────────────────────────────────
  CONTINUOUS MONITORING (Interval: 30s)
──────────────────────────────────────────────────────────────────────────

Iteration 1 - 14:23:45

ENDPOINT HEALTH CHECK
──────────────────────────────────────────────────────────────────────────
● Backend Health               45.2ms
● List Services (10)           38.1ms
● Filter Active                42.3ms
● Search Capability            51.8ms

SERVICE STATISTICS
──────────────────────────────────────────────────────────────────────────
Total Services                 3
Total Capabilities             6

By Status:
  Active                       3

By Provider:
  TestProvider                 3

Waiting 30s until next check...
```

---

### 5. Load & Stress Testing (`test_a2a_load.py`)

**Purpose**: Capacity testing and performance bottleneck identification

**Features**:
- 5 progressive load tests (light → heavy)
- Gradual stress test (increasing concurrency)
- Concurrent request handling
- Performance statistics (avg, min, max, p95, p99)
- ~2-5 minute runtime
- Detailed performance metrics

**Usage**:
```bash
cd backend
source .venv/bin/activate
python test_a2a_load.py
```

**Load Test Scenarios**:

1. **Light Load**: 50 requests × 5 concurrent
2. **Moderate Load**: 200 requests × 20 concurrent
3. **Heavy Load**: 500 requests × 50 concurrent
4. **Search Load**: 200 search requests × 20 concurrent
5. **Filter Load**: 200 filter requests × 20 concurrent
6. **Stress Test**: Gradual increase from 10 to 100 concurrent over 30 seconds

**Metrics Collected**:
- Total requests & success rate
- Average response time
- Min/Max response times
- 95th & 99th percentile response times
- Requests per second (RPS)
- Error rate (%)
- Total duration

**Example output**:
```
═══════════════════════════════════════════════════════════════════════════
  LOAD TEST: Light Load
═══════════════════════════════════════════════════════════════════════════

Configuration:
  URL: http://localhost:8000/services?limit=10
  Total Requests: 50
  Concurrency: 5

→ Request 5/50 (10%)   - 42.3ms
→ Request 10/50 (20%)  - 38.1ms
...

Results:
✓ Completed in 3.45s
✓ Successful: 50/50

Performance:
  Avg Response Time:  40.23ms
  Min Response Time:  28.45ms
  Max Response Time:  67.89ms
  95th Percentile:    62.34ms
  99th Percentile:    67.12ms
  Requests/Second:    14.49

═══════════════════════════════════════════════════════════════════════════
  TEST SUMMARY
═══════════════════════════════════════════════════════════════════════════

Test Name                  Requests     Successful   Avg Time     RPS
────────────────────────────────────────────────────────────────────────
Light Load                 50           50           40.23        14.49
Moderate Load              200          200          41.56        56.82
Heavy Load                 500          500          43.12        145.67
Search Load Test           200          200          38.45        54.23
Filter Load Test           200          200          39.87        50.12
```

---

## Testing Workflow

### 1. Initial Setup (First Time)

```bash
# 1. Start backend
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000

# 2. In new terminal - run basic tests
cd backend
source .venv/bin/activate
python test_a2a.py

# 3. Run integration tests
python test_a2a_full.py

# 4. Stop backend (Ctrl+C) when done
```

### 2. Daily Monitoring

```bash
# Start continuous monitoring
python test_a2a_monitor.py --continuous --interval=60

# Monitor for 24 hours:
# python test_a2a_monitor.py --continuous --duration=86400
```

### 3. Performance Testing

```bash
# Run real-time tests
python test_a2a_realtime.py

# Run load tests (after confirming basic functionality)
python test_a2a_load.py
```

### 4. Development Changes

```bash
# After code changes, verify with:
python test_a2a.py      # Quick check
python test_a2a_full.py # Full validation
```

---

## Performance Benchmarks

Expected performance metrics (on standard dev machine):

| Metric | Target | Typical |
|--------|--------|---------|
| Single Request | <100ms | 40-50ms |
| 50 concurrent | <2s | 3-5s |
| 200 concurrent | <10s | 8-12s |
| 500 concurrent | <20s | 15-25s |
| RPS (light load) | >10 | 14-20 |
| RPS (moderate) | >50 | 50-60 |
| Error rate | 0% | 0% |

---

## Troubleshooting

### Test fails to connect to backend

**Problem**: `Connection refused` or `Could not connect to localhost:8000`

**Solution**:
```bash
# Make sure backend is running
ps aux | grep uvicorn

# If not running, start it:
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### Tests pass but show high response times (>500ms)

**Problem**: System is slow or resource-constrained

**Actions**:
1. Check system CPU/memory: `top` or Activity Monitor
2. Reduce concurrency in load tests
3. Stop other services using port 8000
4. Check database performance

### Intermittent test failures

**Problem**: Some requests fail sporadically

**Common causes**:
- Backend restart/reload during test (normal with `--reload`)
- Network timeout with high concurrency
- Database locking under stress

**Solutions**:
- Run tests one more time
- Increase timeouts in test files
- Reduce concurrency

### SSRF protection tests fail

**Problem**: SSRF blocking not working

**Diagnostic**:
```bash
# Check if SSRF protection code is present:
grep -n "ipaddress" backend/app/services/github_client.py
grep -n "socket.getaddrinfo" backend/app/services/github_client.py
```

**Fix**: Restart backend and re-run tests

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: A2A Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Start backend
        run: |
          cd backend
          python -m uvicorn app.main:app --port 8000 &
          sleep 2
      
      - name: Run tests
        run: |
          cd backend
          python test_a2a.py
          python test_a2a_full.py
```

---

## File Locations

All test files are located in `/backend/`:

```
backend/
  ├── test_a2a.py              # Basic tests (9 scenarios)
  ├── test_a2a_full.py         # Integration tests (10 scenarios)
  ├── test_a2a_realtime.py     # Real-time tests (10 scenarios)
  ├── test_a2a_monitor.py      # Continuous monitoring
  ├── test_a2a_load.py         # Load & stress testing
  └── requirements.txt         # Dependencies
```

---

## Quick Reference

| Need | Command |
|------|---------|
| Basic validation | `python test_a2a.py` |
| Full testing | `python test_a2a_full.py` |
| Real-time check | `python test_a2a_realtime.py` |
| Monitor 1 hour | `python test_a2a_monitor.py --continuous --duration=3600` |
| Load test | `python test_a2a_load.py` |
| Stop monitoring | `Ctrl+C` |

---

## Next Steps

1. ✅ All tests ready to use
2. 📊 Monitor production deployment daily
3. 📈 Analyze performance trends
4. 🔍 Register real A2A services via `/services/register`
5. 🌐 Use frontend `/services` page for browsing services

---

*Last Updated: 2024 | A2A Services Testing Framework v1.0*
