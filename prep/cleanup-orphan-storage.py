#!/usr/bin/env python3
"""One-shot orphan storage cleanup — pure stdlib, no install needed.

Deletes objects in `project-documents` and `continuity-photos` whose
top-level folder UUID no longer matches a row in the `projects` table.

Usage (Terminal):
    SUPABASE_URL=https://xxx.supabase.co \\
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... \\
    python3 cleanup-orphan-storage.py

Or as a one-liner that fetches and runs the latest copy:
    SUPABASE_URL=https://xxx.supabase.co \\
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... \\
    python3 <(curl -fsSL https://raw.githubusercontent.com/amelia-mara/hairandmakeuppro/main/prep/cleanup-orphan-storage.py)

Service role key is from Supabase dashboard → Project Settings → API →
the `service_role` key (the secret one, NOT the anon key).
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKETS = ["project-documents", "continuity-photos"]
UUID_RE = re.compile(r"^[0-9a-f-]{36}$", re.IGNORECASE)

if not URL or not KEY:
    sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.")

HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}


def http(method, path, body=None):
    req = urllib.request.Request(
        f"{URL}{path}",
        method=method,
        headers=HEADERS,
        data=json.dumps(body).encode() if body is not None else None,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} on {method} {path}: {e.read().decode()}")


def list_all_project_ids():
    ids = set()
    page = 0
    PAGE = 1000
    while True:
        rows = http("GET", f"/rest/v1/projects?select=id&limit={PAGE}&offset={page * PAGE}")
        if not rows:
            break
        ids.update(r["id"] for r in rows)
        if len(rows) < PAGE:
            break
        page += 1
    return ids


def list_paths(bucket, prefix=""):
    out = []
    body = {"prefix": prefix, "limit": 1000, "offset": 0}
    rows = http("POST", f"/storage/v1/object/list/{bucket}", body) or []
    for entry in rows:
        full = f"{prefix}/{entry['name']}" if prefix else entry["name"]
        # Folders come back with id == None.
        if entry.get("id") is None:
            out.extend(list_paths(bucket, full))
        else:
            out.append(full)
    return out


def remove_paths(bucket, paths):
    CHUNK = 500
    removed = 0
    for i in range(0, len(paths), CHUNK):
        batch = paths[i : i + CHUNK]
        # Storage v1 remove is DELETE with a JSON body.
        req = urllib.request.Request(
            f"{URL}/storage/v1/object/{bucket}",
            method="DELETE",
            headers=HEADERS,
            data=json.dumps({"prefixes": batch}).encode(),
        )
        try:
            with urllib.request.urlopen(req) as resp:
                resp.read()
            removed += len(batch)
            sys.stdout.write(f"\r  removed {removed} / {len(paths)}…")
            sys.stdout.flush()
        except urllib.error.HTTPError as e:
            print(f"\n  ! batch {i}-{i + len(batch)} failed: HTTP {e.code} {e.read().decode()}")
    print()
    return removed


def main():
    print("Fetching project IDs…")
    project_ids = list_all_project_ids()
    print(f"  {len(project_ids)} projects in DB.")

    for bucket in BUCKETS:
        print(f"\n[{bucket}]")
        all_paths = list_paths(bucket)
        print(f"  {len(all_paths)} total objects.")

        orphans = [
            p for p in all_paths
            if not UUID_RE.match(p.split("/")[0]) or p.split("/")[0] not in project_ids
        ]
        print(f"  {len(orphans)} orphan objects to delete.")
        if not orphans:
            continue

        removed = remove_paths(bucket, orphans)
        print(f"  done — removed {removed} objects.")


if __name__ == "__main__":
    main()
