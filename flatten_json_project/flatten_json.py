import json
import csv
import re
import sys
import unicodedata

input_file = sys.argv[1] if len(sys.argv) > 1 else "input.json"
output_file = sys.argv[2] if len(sys.argv) > 2 else "flattened_output.csv"


def slugify(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    return re.sub(r"[-\s]+", "-", value)


def infer_city(filename):
    lower = filename.lower()
    if "atl" in lower:
        return "atl"
    if "nyc" in lower:
        return "nyc"
    return "unknown"


def to_list(value):
    if value is None:
        return []

    if isinstance(value, list):
        items = value
    else:
        items = str(value).split(",")

    return [
        str(item).strip().lower()
        for item in items
        if str(item).strip()
    ]


def json_array(value):
    return json.dumps(to_list(value), ensure_ascii=False)


def extract_instagram_handle(link):
    if not link:
        return ""

    match = re.search(r"instagram\.com/([a-zA-Z0-9_.]+)/?", link)
    return match.group(1) if match else ""


def normalize_time_string(value):
    value = str(value).strip()
    value = value.replace("\u202f", " ")
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)
    return value.upper().replace("AM", "am").replace("PM", "pm")


def parse_hours(hours_list):
    if not isinstance(hours_list, list):
        return {}

    day_map = {
        "sunday": "Sun",
        "monday": "Mon",
        "tuesday": "Tue",
        "wednesday": "Wed",
        "thursday": "Thu",
        "friday": "Fri",
        "saturday": "Sat",
    }

    parsed = {}

    for line in hours_list:
        if not isinstance(line, str) or ":" not in line:
            continue

        day_raw, times_raw = line.split(":", 1)
        day_key = day_map.get(day_raw.strip().lower())

        if not day_key:
            continue

        times_raw = times_raw.strip()

        if times_raw.lower() == "closed":
            parsed[day_key] = None
            continue

        ranges = [r.strip() for r in times_raw.split(";") if r.strip()]
        day_hours = {}

        for idx, time_range in enumerate(ranges, start=1):
            parts = re.split(r"\s*[–—-]\s*", time_range)

            if len(parts) != 2:
                continue

            day_hours[f"open{idx}"] = normalize_time_string(parts[0])
            day_hours[f"close{idx}"] = normalize_time_string(parts[1])

        parsed[day_key] = day_hours if day_hours else None

    return parsed


def get_first(*values):
    for value in values:
        if value not in [None, ""]:
            return value
    return ""


with open(input_file, "r", encoding="utf-8") as infile:
    data = json.load(infile)

city = infer_city(input_file)

headers = [
    "name",
    "lat",
    "lon",
    "instagram_handle",
    "tags",
    "type",
    "time_category",
    "energy_ramp",
    "price",
    "duration",
    "cover",
    "city",
    "slug",
    "description",
    "contact",
    "hours",
    "address",
    "vibe",
]

with open(output_file, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(headers)

    for venue in data:
        name = get_first(venue.get("name"), venue.get("title"))
        slug = get_first(venue.get("slug"), slugify(name))

        lat = get_first(venue.get("lat"), venue.get("latitude"))
        lon = get_first(venue.get("lon"), venue.get("lng"), venue.get("longitude"))

        link = get_first(
            venue.get("link"),
            venue.get("instagram"),
            venue.get("instagram_url"),
            venue.get("url"),
            venue.get("website"),
        )

        instagram_handle = get_first(
            venue.get("instagram_handle"),
            venue.get("instagramHandle"),
            extract_instagram_handle(link),
        )

        tags = json_array(venue.get("tags"))
        venue_type = json_array(get_first(venue.get("type"), venue.get("types")))
        time_category = json_array(get_first(venue.get("time_category"), venue.get("timeCategory")))
        vibe = json_array(venue.get("vibe"))

        contact = json.dumps([link] if link else [], ensure_ascii=False)
        hours = json.dumps(parse_hours(venue.get("hours", [])), ensure_ascii=False)

        row = [
            name,
            lat,
            lon,
            instagram_handle,
            tags,
            venue_type,
            time_category,
            get_first(venue.get("energy_ramp"), venue.get("energyRamp")),
            venue.get("price", ""),
            venue.get("duration", ""),
            venue.get("cover", ""),
            get_first(venue.get("city"), city),
            slug,
            venue.get("description", ""),
            contact,
            hours,
            venue.get("address", ""),
            vibe,
        ]

        writer.writerow(row)

print(f"✅ Flattened {len(data)} venues into {output_file}")
