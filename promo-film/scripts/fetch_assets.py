"""Fetch the owner's real closet into public/ for the promo film.

Reads SUPABASE_URL and SUPABASE_SECRET_KEY from ~/Projects/digital-wardrobe/.env (never printed).
Only the owner's own account is read (KIPS_FILM_OWNER_EMAIL); deleted items are skipped. Images are
copied byte for byte: no resizing, tinting or retouching.
Run: KIPS_FILM_OWNER_EMAIL=<owner's account email> python3 -I scripts/fetch_assets.py
"""
import json, os, sys, urllib.error, urllib.parse, urllib.request

ENV = os.path.expanduser("~/Projects/digital-wardrobe/.env")
OWNER_EMAIL = os.environ.get("KIPS_FILM_OWNER_EMAIL", "").strip()
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")

env = {}
for line in open(ENV):
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.rstrip("\n").split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
URL, KEY = env["SUPABASE_URL"].rstrip("/"), env["SUPABASE_SECRET_KEY"]
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}


def get(path):
    req = urllib.request.Request(URL + path, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def download(obj, dest):
    if os.path.exists(dest):
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(f"{URL}/storage/v1/object/wardrobe/{urllib.parse.quote(obj)}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        f.write(r.read())


def main():
    if not OWNER_EMAIL:
        sys.exit("set KIPS_FILM_OWNER_EMAIL to the owner's account email")
    rows = get("/rest/v1/profiles?select=id&email=eq." + urllib.parse.quote(OWNER_EMAIL))
    if len(rows) != 1:
        sys.exit(f"expected one owner profile, got {len(rows)}")
    uid = rows[0]["id"]
    items = get(f"/rest/v1/wardrobe_items?select=id,job_id,piece_index,facts,source_path,source_kind,display_path,"
                f"cutout_path,crop_path,back,turn,created_at&user_id=eq.{uid}&deleted_at=is.null&order=created_at.desc")
    jobs = get(f"/rest/v1/generation_jobs?select=id,kind,status,input_path,result,created_at&user_id=eq.{uid}"
               f"&order=created_at.asc")
    manifest = []
    for it in items:
        short = it["id"][:8]
        files = {}
        for key, name in (("display_path", "generated"), ("cutout_path", "cutout"), ("crop_path", "crop")):
            obj = it.get(key)
            if obj:
                ext = os.path.splitext(obj)[1]
                rel = f"garments/{short}/{name}{ext}"
                download(obj, os.path.join(ROOT, rel))
                files[name] = rel
        turn = it.get("turn") or {}
        if turn.get("state") == "done":
            for view in turn.get("views") or []:
                obj = view.get("cutout_path") or view.get("path")
                rel = f"garments/{short}/turn_{view['angle']}{os.path.splitext(obj)[1]}"
                download(obj, os.path.join(ROOT, rel))
                files[f"turn_{view['angle']}"] = rel
        f = it["facts"]
        manifest.append({
            "id": it["id"], "short": short, "job": it["job_id"], "piece": it["piece_index"],
            "category": (f.get("category") or {}).get("value"), "colors": (f.get("colors") or {}).get("value"),
            "source_kind": it["source_kind"], "created_at": it["created_at"], "has_turn": (it.get("turn") or {}).get("state") == "done",
            "files": files,
        })
    for j in jobs:
        if j["input_path"] and j["status"] == "succeeded":
            ext = os.path.splitext(j["input_path"])[1]
            try:
                download(j["input_path"], os.path.join(ROOT, f"photos/{j['id'][:8]}{ext}"))
            except urllib.error.HTTPError:
                pass  # uploads can be cleaned up after processing
    json.dump({"items": manifest}, open(os.path.join(ROOT, "..", "src", "data", "closet.json"), "w"), indent=1)
    print(f"{len(manifest)} items, {sum(1 for j in jobs if j['input_path'])} photos")


if __name__ == "__main__":
    main()
