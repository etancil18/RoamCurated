import json
import csv
import re
import sys
import unicodedata

# --- Helper: Slugify venue names ---
def slugify(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    return re.sub(r"[-\s]+", "-", value)

# --- Input file (default to 'input.json') ---
input_file = sys.argv[1] if len(sys.argv) > 1 else "input.json"

with open(input_file, "r") as infile:
    data = json.load(infile)

# --- Define headers (including slug) ---
headers = [
    "name", "slug", "lat", "lon", "instagram_handle", "tags", "type", "time_category",
    "energy_ramp", "price", "duration", "cover", "city"
]

# --- Infer city from filename ---
def infer_city(filename):
    if "atl" in filename.lower():
        return "atl"
    elif "nyc" in filename.lower():
        return "nyc"
    else:
        return "unknown"

city = infer_city(input_file)

# --- Write flattened CSV ---
with open("flattened_output.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(headers)

    for venue in data:
        name = venue.get("name", "")
        slug = slugify(name)

        lat = venue.get("lat", "")
        lon = venue.get("lon", "")

        link = venue.get("link", "")
        handle_match = re.search(r"instagram.com/([a-zA-Z0-9_.]+)/?", link)
        instagram_handle = handle_match.group(1) if handle_match else ""

        tags_str = venue.get("tags", "")
        tags_list = [tag.strip() for tag in tags_str.split(",") if tag.strip()]
        tags = "{" + ",".join(tags_list) + "}"

        type_field = venue.get("type")
        type_str = type_field[0] if isinstance(type_field, list) else type_field

        time_cat_raw = venue.get("timeCategory", "")
        time_category = time_cat_raw.split(",")[0].strip() if time_cat_raw else ""

        energy_ramp = venue.get("energyRamp", "")
        price = venue.get("price", "")
        duration = venue.get("duration", "")
        cover = venue.get("cover", "")

        row = [
            name, slug, lat, lon, instagram_handle, tags, type_str, time_category,
            energy_ramp, price, duration, cover, city
        ]
        writer.writerow(row)
