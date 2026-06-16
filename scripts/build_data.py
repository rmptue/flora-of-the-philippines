#!/usr/bin/env python3
"""
Transform the scraper output into static data files the website consumes.

Reads:
  ../philippineplants_scraper/output/species.json   (required)
  ../philippineplants_scraper/output/images.json    (optional; merged if present)

Writes into public/data/:
  index.json            compact search index (one small record per species)
  meta.json             totals + filter option lists (families, statuses, conservation)
  families/<slug>.json  full detail for every species in that family (incl. photo URLs)

Run again any time the scrape or image data updates.
"""

import json
import re
from pathlib import Path

SITE_DIR = Path(__file__).resolve().parent.parent
SCRAPER_OUT = SITE_DIR.parent / "philippineplants_scraper" / "output"
SPECIES_JSON = SCRAPER_OUT / "species.json"
IMAGES_JSON = SCRAPER_OUT / "images.json"

DATA_DIR = SITE_DIR / "public" / "data"
FAM_DIR = DATA_DIR / "families"


def slug(s: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", s.strip().lower())
    return s.strip("-")


def conservation_short(text: str) -> str:
    if not text:
        return ""
    # "Critically Endangered (IUCN 3.1)." -> "Critically Endangered"
    return re.split(r"[(.]", text, 1)[0].strip()


def status_short(text: str) -> str:
    return text.rstrip(".").strip()


def main():
    data = json.loads(SPECIES_JSON.read_text(encoding="utf-8"))
    images = {}
    if IMAGES_JSON.exists():
        try:
            images = json.loads(IMAGES_JSON.read_text(encoding="utf-8"))
        except Exception:
            images = {}
    print(f"Loaded {len(data)} families; {len(images)} taxa with photos")

    FAM_DIR.mkdir(parents=True, exist_ok=True)

    index = []
    families = []
    statuses = set()
    conservations = set()
    uid = 0
    n_species = 0
    n_with_photos = 0

    for fam in data:
        fam_name = fam["family"]
        fam_slug = slug(fam_name)
        families.append(fam_name)

        fam_detail = {"family": fam_name, "url": fam["url"],
                      "references": fam.get("references", []), "genera": []}

        for g in fam["genera"]:
            gen_out = {"genus": g["genus"], "authors": g.get("authors", ""),
                       "last_edited": g.get("last_edited", ""), "species": []}
            for sp in g["species"]:
                uid += 1
                n_species += 1
                sci = sp.get("scientific_name", "")
                taxon = sp.get("taxon_name") or sci
                photos = images.get(taxon, {})
                thumbs = photos.get("thumbs", [])
                full = photos.get("full", [])
                if thumbs:
                    n_with_photos += 1
                st = status_short(sp.get("status", ""))
                cons = conservation_short(sp.get("conservation_status", ""))
                endemic = "endemic to the philippines" in sp.get("distribution", "").lower()
                if st:
                    statuses.add(st)
                if cons:
                    conservations.add(cons)

                # Short distribution snippet for the list view.
                dist = sp.get("distribution", "")
                dist_snip = dist[:95].rsplit(" ", 1)[0] + ("…" if len(dist) > 95 else "")

                # Compact index record (short keys to keep the file small).
                index.append({
                    "u": uid,
                    "s": sci,
                    "f": fam_name,
                    "g": g["genus"],
                    "st": st,
                    "c": cons,
                    "e": 1 if endemic else 0,
                    "p": 1 if thumbs else 0,
                    "d": dist_snip,
                    "th": thumbs[0] if thumbs else "",
                })

                # Full detail record (lives in the family file).
                gen_out["species"].append({
                    "u": uid,
                    "scientific_name": sci,
                    "taxon_name": taxon,
                    "category": sp.get("category", ""),
                    "status": sp.get("status", ""),
                    "citation": sp.get("citation", ""),
                    "distribution": sp.get("distribution", ""),
                    "notes": sp.get("notes", ""),
                    "conservation_status": sp.get("conservation_status", ""),
                    "dao_category": sp.get("dao_category", ""),
                    "other_fields": sp.get("other_fields", {}),
                    "gallery_url": sp.get("photo_url", ""),
                    "thumbs": thumbs,
                    "full": full,
                })
            fam_detail["genera"].append(gen_out)

        (FAM_DIR / f"{fam_slug}.json").write_text(
            json.dumps(fam_detail, ensure_ascii=False), encoding="utf-8")

    # index.json also needs the family slug for lookups; derive on the client from family name,
    # but store a name->slug map in meta to stay consistent with our slug() rules.
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    meta = {
        "totals": {
            "families": len(data),
            "genera": sum(len(f["genera"]) for f in data),
            "species": n_species,
            "species_with_photos": n_with_photos,
        },
        "families": sorted(families),
        "family_slugs": {f: slug(f) for f in families},
        "statuses": sorted(statuses),
        "conservations": sorted(conservations),
        "source": "Co's Digital Flora of the Philippines (philippineplants.org)",
    }
    (DATA_DIR / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    # --- Full downloadable exports (flat, one row per species) ---
    import csv
    EXPORT_DIR = DATA_DIR / "exports"
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    flat = []
    for fam in data:
        for g in fam["genera"]:
            for sp in g["species"]:
                taxon = sp.get("taxon_name") or sp.get("scientific_name")
                photos = images.get(taxon, {})
                flat.append({
                    "family": fam["family"],
                    "genus": g["genus"],
                    "scientific_name": sp.get("scientific_name", ""),
                    "status": sp.get("status", "").rstrip("."),
                    "category": sp.get("category", ""),
                    "citation": sp.get("citation", ""),
                    "distribution": sp.get("distribution", ""),
                    "notes": sp.get("notes", ""),
                    "conservation_status": sp.get("conservation_status", ""),
                    "dao_category": sp.get("dao_category", ""),
                    "photo_count": len(photos.get("thumbs", [])),
                    "photo_urls": " | ".join(photos.get("full", [])),
                    "gallery_url": sp.get("photo_url", ""),
                })
    (EXPORT_DIR / "philippine-plants.json").write_text(
        json.dumps(flat, ensure_ascii=False), encoding="utf-8")
    cols = list(flat[0].keys())
    with (EXPORT_DIR / "philippine-plants.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(flat)

    idx_kb = (DATA_DIR / "index.json").stat().st_size / 1024
    print(f"Species: {n_species}  with photos: {n_with_photos}")
    print(f"index.json: {idx_kb:.0f} KB")
    print(f"Family files: {len(data)} in {FAM_DIR}")
    print(f"Exports: {EXPORT_DIR}/philippine-plants.{{json,csv}}")


if __name__ == "__main__":
    main()
