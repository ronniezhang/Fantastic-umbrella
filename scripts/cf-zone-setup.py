#!/usr/bin/env python3
"""One-off Cloudflare zone + Pages custom domain preparation for the cutover.

Runs in GitHub Actions with CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID.
No secret is ever printed.

  CF_ACTION=probe  -> read-only inventory of token, zone, DNS and domains
  CF_ACTION=setup  -> create (or reuse) the full zone, reconcile the mail /
                      Resend / verification records against the CURRENT
                      authoritative DNS (GoDaddy), then attach the two Pages
                      custom domains. Nothing here changes the registrar NS.

Safety: while the registrar still points at GoDaddy, every change in this
script is invisible to the public internet. The site only moves when the user
changes the two nameservers in GoDaddy afterwards.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

TOKEN = os.environ.get("CF_API_TOKEN", "").strip()
ACCOUNT = os.environ.get("CF_ACCOUNT_ID", "").strip()
PROJECT = os.environ.get("CF_PAGES_PROJECT", "fantastic-umbrella").strip()
ACTION = os.environ.get("CF_ACTION", "probe").strip()
DOMAIN = "fantasticumbrella.com"
BASE = "https://api.cloudflare.com/client/v4"
TYPE_CODE = {"A": 1, "CNAME": 5, "MX": 15, "TXT": 16}

# Records that must survive the nameserver change. Values are read live from
# the current authoritative DNS (not hard-coded), so long DKIM keys stay exact.
REQUIRED = [
    (DOMAIN, "MX"),
    (DOMAIN, "TXT"),
    ("_dmarc." + DOMAIN, "TXT"),
    ("fantastic._domainkey." + DOMAIN, "TXT"),
    ("dc-8e814c8572._spfm." + DOMAIN, "TXT"),
    ("resend._domainkey.notify." + DOMAIN, "TXT"),
    ("send.notify." + DOMAIN, "CNAME"),
    ("rsend.notify." + DOMAIN, "CNAME"),
    ("_acme-challenge.www." + DOMAIN, "TXT"),
    ("_cf-custom-hostname.www." + DOMAIN, "TXT"),
    ("_domainconnect." + DOMAIN, "CNAME"),
]


def api(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + TOKEN,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "workbuddy-cf-zone-setup",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, json.loads(res.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", "replace")
        try:
            return err.code, json.loads(raw)
        except Exception:
            return err.code, {"_raw": raw[:300]}
    except Exception as err:
        return 0, {"_error": str(err)}


def good(code, data):
    return 200 <= code < 300 and data.get("success") is True


def brief(data):
    return json.dumps(data.get("errors") or data.get("_error") or data.get("_raw") or {})[:260]


def doh(name, typ):
    """Read the CURRENT authoritative values (GoDaddy) via Google DoH."""
    url = "https://dns.google/resolve?name=%s&type=%d" % (
        urllib.parse.quote(name), TYPE_CODE[typ])
    try:
        with urllib.request.urlopen(url, timeout=15) as res:
            doc = json.loads(res.read().decode("utf-8", "replace"))
    except Exception as err:
        print("   DoH lookup failed for %s %s: %s" % (name, typ, err))
        return []
    out = []
    for ans in doc.get("Answer", []):
        if ans.get("type") != TYPE_CODE[typ]:
            continue
        value = str(ans.get("data", ""))
        if typ == "TXT":
            parts = re.findall(r'"([^"]*)"', value)
            value = "".join(parts) if parts else value.strip().strip('"')
        elif typ == "MX":
            bits = value.split(None, 1)
            if len(bits) == 2:
                out.append((bits[1].rstrip("."), int(bits[0])))
            continue
        else:
            value = value.rstrip(".")
        if value:
            out.append((value, None))
    return out


def norm(value):
    return re.sub(r"\s+", " ", value.strip().strip('"'))


def main():
    if not TOKEN or not ACCOUNT:
        print("::error::CF_API_TOKEN / CF_ACCOUNT_ID missing")
        return 1

    code, data = api("GET", "/user/tokens/verify")
    print("token verify: HTTP %s status=%s" % (code, (data.get("result") or {}).get("status")))

    code, data = api("GET", "/zones?name=" + DOMAIN)
    zones = data.get("result") or []
    print("zone lookup: HTTP %s count=%d" % (code, len(zones)))
    for z in zones:
        print("   zone %s status=%s type=%s NS=%s" % (
            z.get("id"), z.get("status"), z.get("type"), z.get("name_servers")))

    code, data = api("GET", "/accounts/%s/pages/projects/%s/domains" % (ACCOUNT, PROJECT))
    domains = data.get("result") or []
    print("pages custom domains: HTTP %s count=%d" % (code, len(domains)))
    for d in domains:
        print("   %s status=%s" % (d.get("name"), d.get("status")))

    zone = zones[0] if zones else None
    records = []
    if zone:
        code, data = api("GET", "/zones/%s/dns_records?per_page=100" % zone["id"])
        records = data.get("result") or []
        print("dns records: HTTP %s count=%d" % (code, len(records)))
        for r in records:
            print("   %-6s %-52s %s proxied=%s" % (
                r.get("type"), r.get("name"), str(r.get("content"))[:80], r.get("proxied")))

    if ACTION == "probe":
        import hashlib
        print("--- TXT integrity: Cloudflare zone vs current authoritative DNS ---")
        cf_txt = {}
        for r in records:
            if r.get("type") == "TXT":
                cf_txt.setdefault(norm(r.get("name", "")), []).append(norm(r.get("content", "")))
        for name, typ in REQUIRED:
            if typ != "TXT":
                continue
            live = [norm(v) for v, _ in doh(name, typ)]
            cf = cf_txt.get(norm(name), [])
            for value in live:
                print("   %-52s len=%4d sha=%s %s" % (
                    name, len(value),
                    hashlib.sha256(value.encode("utf-8")).hexdigest()[:10],
                    "MATCH" if value in cf else "MISSING"))
            if not live:
                print("   %-52s (no authoritative value)" % name)
        print("PROBE COMPLETE - no changes made")
        return 0
    if ACTION == "activate":
        """Post-cutover: nudge Pages custom-domain validation into `active`.

        Runs AFTER the registrar NS now points at Cloudflare. Only website
        records (apex / www pointing at the Pages project) are ever added;
        mail and verification records are never touched or removed.
        """
        if not zone:
            print("::error::zone not found - cannot activate")
            return 1
        zone_id = zone["id"]

        code, proj = api("GET", "/accounts/%s/pages/projects/%s" % (ACCOUNT, PROJECT))
        subdomain = (proj.get("result") or {}).get("subdomain") or ""
        # The project API already returns the FULL *.pages.dev hostname.
        target = subdomain if subdomain.endswith(".pages.dev") else (
            (subdomain + ".pages.dev") if subdomain else "fantastic-umbrella-e13.pages.dev")
        print("project HTTP %s subdomain=%s target=%s" % (code, subdomain, target))

        def domain_detail(host):
            c, d = api("GET", "/accounts/%s/pages/projects/%s/domains/%s" % (
                ACCOUNT, PROJECT, urllib.parse.quote(host, safe="")))
            return c, d.get("result") or {}

        def retry(host):
            c, d = api("PATCH", "/accounts/%s/pages/projects/%s/domains/%s" % (
                ACCOUNT, PROJECT, urllib.parse.quote(host, safe="")))
            r = d.get("result") or {}
            print("   RETRY %-32s HTTP %s status=%s %s" % (
                host, c, r.get("status", "-"), brief(d) if not good(c, d) else ""))

        hosts = (DOMAIN, "www." + DOMAIN)
        print("--- details BEFORE ---")
        for host in hosts:
            c, r = domain_detail(host)
            print("   %s HTTP %s %s" % (
                host, c, json.dumps(r or {}, ensure_ascii=False)[:700]))

        # 1) Let Cloudflare re-run its own validation and automatic record creation.
        for host in hosts:
            retry(host)
        time.sleep(12)

        # 2) If Cloudflare did not create the website records, add them.
        c, d = api("GET", "/zones/%s/dns_records?per_page=100" % zone_id)
        current = d.get("result") or []
        web = {}
        for r in current:
            if r.get("type") in ("A", "AAAA", "CNAME"):
                web.setdefault(norm(r.get("name", "")), []).append(r)
        for host in hosts:
            existing = web.get(norm(host), [])
            cnames = [r for r in existing if r.get("type") == "CNAME"]
            if cnames:
                primary = cnames[0]
                if norm(primary.get("content", "")) == norm(target):
                    print("   DNS OK  %-32s CNAME -> %s" % (host, target))
                else:
                    c, d = api("PUT", "/zones/%s/dns_records/%s" % (zone_id, primary["id"]), {
                        "type": "CNAME", "name": host, "content": target,
                        "ttl": 1, "proxied": True,
                    })
                    print("   DNS FIX %-32s -> %-38s HTTP %s %s" % (
                        host, target, c, "OK" if good(c, d) else brief(d)))
                for extra in cnames[1:]:
                    api("DELETE", "/zones/%s/dns_records/%s" % (zone_id, extra["id"]))
                    print("   DNS DEL duplicate %s" % host)
            elif existing:
                for r in existing:
                    print("   DNS OK  %-32s %s -> %s (Cloudflare-managed)" % (
                        host, r.get("type"), r.get("content")))
            else:
                c, d = api("POST", "/zones/%s/dns_records" % zone_id, {
                    "type": "CNAME", "name": host, "content": target,
                    "ttl": 1, "proxied": True,
                })
                print("   DNS ADD %-32s -> %-38s HTTP %s %s" % (
                    host, target, c, "OK" if good(c, d) else brief(d)))

        # 3) TXT-based DCV: add the token Cloudflare asks for, if any.
        for host in hosts:
            c, r = domain_detail(host)
            vd = r.get("validation_data") or {}
            txt_name, txt_value = vd.get("txt_name"), vd.get("txt_value")
            if vd.get("method") == "txt" and txt_name and txt_value:
                existing = [norm(x.get("content", "")) for x in current
                            if x.get("type") == "TXT" and norm(x.get("name", "")) == norm(txt_name)]
                if norm(txt_value) not in existing:
                    c2, d2 = api("POST", "/zones/%s/dns_records" % zone_id, {
                        "type": "TXT", "name": txt_name, "content": txt_value,
                        "ttl": 1, "proxied": False,
                    })
                    print("   DCV TXT %-32s HTTP %s %s" % (
                        txt_name, c2, "OK" if good(c2, d2) else brief(d2)))
                else:
                    print("   DCV TXT %-32s already present" % txt_name)

        # 4) Re-run validation once records exist.
        time.sleep(5)
        for host in hosts:
            retry(host)

        print("--- details AFTER ---")
        for host in hosts:
            c, r = domain_detail(host)
            print("   %s HTTP %s %s" % (
                host, c, json.dumps(r or {}, ensure_ascii=False)[:700]))
        print("ACTIVATE COMPLETE - mail records untouched")
        return 0

    if ACTION != "setup":
        print("::error::unknown CF_ACTION=" + ACTION)
        return 1

    if not zone:
        code, data = api("POST", "/zones", {
            "name": DOMAIN,
            "account": {"id": ACCOUNT},
            "type": "full",
            "jump_start": True,
        })
        if not good(code, data):
            print("::error::create zone failed HTTP %s %s" % (code, brief(data)))
            print("ACTION_REQUIRED: create the zone manually in the Cloudflare dashboard (Add a site).")
            return 1
        zone = data["result"]
        print("ZONE CREATED %s" % zone["id"])
        # Cloudflare's initial scan is asynchronous.
        time.sleep(6)
    else:
        print("ZONE REUSED %s" % zone["id"])

    zone_id = zone["id"]
    nameservers = zone.get("name_servers") or []
    print("NAMESERVERS_FOR_GODADDY: %s" % ", ".join(nameservers))

    code, data = api("GET", "/zones/%s/dns_records?per_page=100" % zone_id)
    records = data.get("result") or []
    print("reconcile: %d existing records" % len(records))

    have = {}
    for r in records:
        key = (r.get("type"), norm(r.get("name", "")))
        have.setdefault(key, []).append(norm(r.get("content", "")))

    added = 0
    for name, typ in REQUIRED:
        current = doh(name, typ)
        if not current:
            print("   SKIP %s %s (no current value found)" % (typ, name))
            continue
        key = (typ, norm(name))
        for value, priority in current:
            if norm(value) in have.get(key, []):
                print("   OK    %-6s %s" % (typ, name))
                continue
            body = {
                "type": typ,
                "name": name,
                "content": value,
                "ttl": 1,           # automatic
                "proxied": False,    # mail / verification records must stay DNS-only
            }
            if priority is not None:
                body["priority"] = priority
            code, data = api("POST", "/zones/%s/dns_records" % zone_id, body)
            status = "OK" if good(code, data) else "FAILED HTTP %s %s" % (code, brief(data))
            print("   ADD   %-6s %-52s %s" % (typ, name, status))
            if good(code, data):
                added += 1
                have.setdefault(key, []).append(norm(value))
    print("records added: %d" % added)

    for host in (DOMAIN, "www." + DOMAIN):
        code, data = api(
            "POST", "/accounts/%s/pages/projects/%s/domains" % (ACCOUNT, PROJECT),
            {"name": host})
        result = data.get("result") or {}
        print("attach custom domain %-32s HTTP %s status=%s %s" % (
            host, code, result.get("status", "-"), brief(data) if not good(code, data) else ""))

    code, data = api("GET", "/zones/%s/dns_records?per_page=100" % zone_id)
    print("FINAL DNS RECORDS (%d):" % len(data.get("result") or []))
    for r in data.get("result") or []:
        print("   %-6s %-52s %s proxied=%s" % (
            r.get("type"), r.get("name"), str(r.get("content"))[:80], r.get("proxied")))
    print("NAMESERVERS_FOR_GODADDY: %s" % ", ".join(nameservers))
    print("SETUP COMPLETE - registrar NS has NOT been changed")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print("::error::" + str(exc))
        sys.exit(1)
