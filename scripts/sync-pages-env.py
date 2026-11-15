#!/usr/bin/env python3
"""Sync enquiry delivery settings into the Cloudflare Pages project.

Designed to run in CI immediately BEFORE `wrangler pages deploy`, because
Pages binds environment variables to a deployment at deploy time.

All values come from environment variables (GitHub Actions Secrets). Nothing
is written to disk, and no secret value is ever printed - only key names.

Local syntax check (no Cloudflare calls):
    DRY_RUN=1 python3 scripts/sync-pages-env.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

ACCOUNT_ID = os.environ.get("CF_ACCOUNT_ID", "").strip()
API_TOKEN = os.environ.get("CF_API_TOKEN", "").strip()
PROJECT = os.environ.get("CF_PAGES_PROJECT", "fantastic-umbrella").strip()
BASE = (
    f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}"
    f"/pages/projects/{PROJECT}"
)

# These are the only variables this script manages. Everything else already
# configured on the project is preserved.
KEYS = ("RESEND_API_KEY", "ENQUIRY_TO", "ENQUIRY_FROM")


def api(method, body=None):
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        BASE,
        data=payload,
        method=method,
        headers={
            "Authorization": f"Bearer {API_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:600]
        raise RuntimeError(f"Cloudflare {method} returned HTTP {err.code}: {detail}")
    except Exception as err:  # network / decode
        raise RuntimeError(f"Cloudflare {method} failed: {err}")


def merged_env_vars(cfg, updates):
    """Keep existing plain-text vars, skip secrets whose values cannot be read back."""
    merged = {}
    for key, val in (cfg.get("env_vars") or {}).items():
        if isinstance(val, dict):
            # Cloudflare hides secret_text values on GET. Sending a null value
            # back would wipe (or reject) that secret, so leave it untouched.
            if val.get("type") == "secret_text" and not val.get("value"):
                continue
            merged[key] = val
        else:
            merged[key] = {"type": "plain_text", "value": str(val)}
    for key, val in updates.items():
        merged[key] = {"type": "secret_text", "value": val}
    return merged


def main():
    updates = {
        key: os.environ.get(key, "").strip()
        for key in KEYS
        if os.environ.get(key, "").strip()
    }
    print("Delivery keys to sync: " + (", ".join(updates) if updates else "(none)"))

    if not updates:
        print("No delivery values supplied - existing Pages configuration left untouched.")
        return 0
    if not ACCOUNT_ID or not API_TOKEN:
        print("::error::CF_ACCOUNT_ID / CF_API_TOKEN are missing.", file=sys.stderr)
        return 1
    if os.environ.get("DRY_RUN") == "1":
        print("DRY_RUN=1 - Cloudflare API calls skipped.")
        return 0

    current = api("GET")
    if not current.get("success"):
        raise RuntimeError("Could not read the Pages project: " + json.dumps(current.get("errors"))[:400])

    result = current.get("result") or {}
    existing = result.get("deployment_configs") or {}
    full = {}
    minimal = {}
    for target in ("production", "preview"):
        cfg = dict(existing.get(target) or {})
        env_vars = merged_env_vars(cfg, updates)
        cfg_full = dict(cfg)
        cfg_full["env_vars"] = env_vars
        full[target] = cfg_full
        minimal[target] = {"env_vars": env_vars}

    try:
        out = api("PATCH", {"deployment_configs": full})
    except RuntimeError as err:
        # Some project configurations carry read-only fields that PATCH will
        # reject. Retry with env_vars only rather than failing the deployment.
        if "HTTP 400" not in str(err) and "HTTP 422" not in str(err):
            raise
        print("Retrying with env_vars-only payload (read-only config fields omitted).")
        out = api("PATCH", {"deployment_configs": minimal})

    if not out.get("success"):
        raise RuntimeError("Cloudflare rejected the update: " + json.dumps(out.get("errors"))[:400])

    print("OK: delivery variables synced for production + preview. The next deployment binds them.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print("::error::" + str(exc), file=sys.stderr)
        sys.exit(1)
