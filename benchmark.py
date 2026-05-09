"""
Learnly API Benchmark — runs on dev machine, prints real response times.
Usage: python benchmark.py
Requires: pip install requests
"""
import requests
import time
import statistics

BASE = "http://127.0.0.1:8000/api"

# ── Config — change these if needed ─────────────────────────
EMAIL    = "admin@pilearn.local"
PASSWORD = "admin123"
# ────────────────────────────────────────────────────────────

def ms(seconds):
    return round(seconds * 1000)

def measure(label, fn, runs=5):
    times = []
    status = None
    for _ in range(runs):
        t0 = time.perf_counter()
        r = fn()
        t1 = time.perf_counter()
        times.append(t1 - t0)
        status = r.status_code
    avg = ms(statistics.mean(times))
    mn  = ms(min(times))
    mx  = ms(max(times))
    ok  = "✓" if status in (200, 201) else f"✗ {status}"
    print(f"  {label:<42} {avg:>5} ms  (min {mn}, max {mx})  [{ok}]")
    return avg, status

print("\n" + "="*72)
print("  LEARNLY API BENCHMARK — Development Machine")
print("="*72)

# ── 1. Login ─────────────────────────────────────────────────
print("\n[1] Authentication")
login_resp = requests.post(f"{BASE}/auth/login/", json={"email": EMAIL, "password": PASSWORD})
if login_resp.status_code != 200:
    # try username field
    login_resp = requests.post(f"{BASE}/auth/login/", json={"username": EMAIL, "password": PASSWORD})
if login_resp.status_code != 200:
    print(f"  ✗ Login failed ({login_resp.status_code}): {login_resp.text[:200]}")
    print("  → Edit EMAIL/PASSWORD at the top of this script and retry.")
    exit(1)

tokens = login_resp.json()
access  = tokens.get("access") or tokens.get("access_token")
refresh = tokens.get("refresh") or tokens.get("refresh_token")
headers = {"Authorization": f"Bearer {access}"}
print(f"  ✓ Logged in — got access token")

login_time, _ = measure("POST /auth/login/", lambda: requests.post(
    f"{BASE}/auth/login/", json={"email": EMAIL, "password": PASSWORD}))

# ── 2. Resources ─────────────────────────────────────────────
print("\n[2] Resources")
measure("GET /resources/ (list, page 1)",
        lambda: requests.get(f"{BASE}/resources/", headers=headers))

measure("GET /resources/popular/",
        lambda: requests.get(f"{BASE}/resources/popular/", headers=headers))

measure("GET /resources/recent/",
        lambda: requests.get(f"{BASE}/resources/recent/", headers=headers))

# get a real resource id
r = requests.get(f"{BASE}/resources/", headers=headers)
items = r.json()
if isinstance(items, dict):
    items = items.get("results", [])
resource_id = items[0]["id"] if items else 1

measure(f"GET /resources/{resource_id}/ (detail)",
        lambda: requests.get(f"{BASE}/resources/{resource_id}/", headers=headers))

# ── 3. Search ────────────────────────────────────────────────
print("\n[3] Search")
measure("GET /resources/search/?q=python",
        lambda: requests.get(f"{BASE}/resources/search/", params={"q": "python"}, headers=headers))

measure("GET /resources/search/?q=machine+learning",
        lambda: requests.get(f"{BASE}/resources/search/", params={"q": "machine learning"}, headers=headers))

measure("GET /resources/suggest/?q=py",
        lambda: requests.get(f"{BASE}/resources/suggest/", params={"q": "py"}, headers=headers))

# ── 4. Recommendations (cold then warm) ──────────────────────
print("\n[4] Recommendations")
# cold: first hit
t0 = time.perf_counter()
r_cold = requests.get(f"{BASE}/recommendations/sections/", headers=headers)
cold_ms = ms(time.perf_counter() - t0)
print(f"  {'GET /recommendations/sections/ (cold)':<42} {cold_ms:>5} ms  [{r_cold.status_code}]")

# warm: subsequent hits
measure("GET /recommendations/sections/ (warm)",
        lambda: requests.get(f"{BASE}/recommendations/sections/", headers=headers))

measure("GET /recommendations/ (flat list)",
        lambda: requests.get(f"{BASE}/recommendations/", headers=headers))

# ── 5. Context ───────────────────────────────────────────────
print("\n[5] Context")
measure("POST /context/network/ (log bandwidth)",
        lambda: requests.post(f"{BASE}/context/network/",
                              json={"download_kbps": 1200, "latency_ms": 45, "location_hint": "library"},
                              headers=headers))

measure("POST /context/zone/ (update zone)",
        lambda: requests.post(f"{BASE}/context/zone/", json={"zone": "library"}, headers=headers))

# ── 6. Auth (profile, progress, bookmarks) ───────────────────
print("\n[6] Auth / Profile")
measure("GET /auth/me/",
        lambda: requests.get(f"{BASE}/auth/me/", headers=headers))

measure("GET /auth/bookmarks/",
        lambda: requests.get(f"{BASE}/auth/bookmarks/", headers=headers))

measure("GET /auth/progress/",
        lambda: requests.get(f"{BASE}/auth/progress/", headers=headers))

measure("GET /auth/activity/",
        lambda: requests.get(f"{BASE}/auth/activity/", headers=headers))

measure(f"POST /auth/bookmark/{resource_id}/ (toggle)",
        lambda: requests.post(f"{BASE}/auth/bookmark/{resource_id}/", headers=headers))

measure(f"POST /auth/complete/{resource_id}/ (toggle)",
        lambda: requests.post(f"{BASE}/auth/complete/{resource_id}/", headers=headers))

# ── 7. Feedback ──────────────────────────────────────────────
print("\n[7] Feedback")
measure(f"GET /feedback/comments/{resource_id}/",
        lambda: requests.get(f"{BASE}/feedback/comments/{resource_id}/", headers=headers))

measure(f"POST /feedback/rate/{resource_id}/ (score=4)",
        lambda: requests.post(f"{BASE}/feedback/rate/{resource_id}/", json={"score": 4}, headers=headers))

# ── 8. Dashboard ─────────────────────────────────────────────
print("\n[8] Dashboard")
measure("GET /dashboard/overview/",
        lambda: requests.get(f"{BASE}/dashboard/overview/", headers=headers))

measure("GET /dashboard/students/",
        lambda: requests.get(f"{BASE}/dashboard/students/", headers=headers))

measure("GET /dashboard/resources/",
        lambda: requests.get(f"{BASE}/dashboard/resources/", headers=headers))

measure("GET /dashboard/network/",
        lambda: requests.get(f"{BASE}/dashboard/network/", headers=headers))

# ── 9. Token refresh ─────────────────────────────────────────
print("\n[9] Token Refresh")
measure("POST /auth/token/refresh/",
        lambda: requests.post(f"{BASE}/auth/token/refresh/", json={"refresh": refresh}))

print("\n" + "="*72)
print("  Done. Copy these numbers into your report.")
print("="*72 + "\n")
