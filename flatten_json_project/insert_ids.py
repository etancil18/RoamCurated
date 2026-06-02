import csv
import json
import sys
import re
import unicodedata

csv_file = sys.argv[1] if len(sys.argv) > 1 else "flattened_output.csv"
json_file = sys.argv[2] if len(sys.argv) > 2 else "input.json"
output_file = sys.argv[3] if len(sys.argv) > 3 else "input_with_ids.json"


def slugify(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    return re.sub(r"[-\s]+", "-", value)


# Load CSV ids by slug and fallback name
id_by_slug = {}
id_by_name = {}

with open(csv_file, "r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)

    for row in reader:
        venue_id = (row.get("id") or "").strip()
        slug = (row.get("slug") or "").strip().lower()
        name = (row.get("name") or "").strip().lower()

        if not venue_id:
            continue

        if slug:
            id_by_slug[slug] = venue_id

        if name:
            id_by_name[name] = venue_id


with open(json_file, "r", encoding="utf-8") as f:
    venues = json.load(f)


matched = 0
unmatched = []

for venue in venues:
    current_id = str(venue.get("id", "")).strip()

    # Don't overwrite existing ids
    if current_id:
        continue

    slug = str(venue.get("slug", "")).strip().lower()
    name = str(venue.get("name", "")).strip().lower()

    matched_id = None

    if slug and slug in id_by_slug:
        matched_id = id_by_slug[slug]
    elif name and name in id_by_name:
        matched_id = id_by_name[name]
    elif name and slugify(name) in id_by_slug:
        matched_id = id_by_slug[slugify(name)]

    if matched_id:
        venue["id"] = matched_id
        matched += 1
    else:
        unmatched.append({
            "name": venue.get("name", ""),
            "slug": venue.get("slug", "")
        })


with open(output_file, "w", encoding="utf-8") as f:
    json.dump(venues, f, indent=2, ensure_ascii=False)

print(f"✅ Inserted ids for {matched} venues")
print(f"⚠️ Unmatched venues: {len(unmatched)}")

if unmatched:
    print("\nFirst 25 unmatched:")
    for item in unmatched[:25]:
        print(f"- {item['name']} | {item['slug']}")
