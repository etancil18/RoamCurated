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


def postgres_text_array(items):
    clean = []
    for item in items:
        item = str(item).strip()
        if not item:
            continue
        item = item.replace('"', '\\"')
        clean.append(f'"{item}"')
    return "{" + ",".join(clean) + "}"


def extract_instagram_handle(link):
    if not link:
        return ""

    match = re.search(r"instagram\.com/([a-zA-Z0-9_.]+)/?", link)
    return match.group(1) if match else ""


def normalize_time_string(value):
    value = value.strip().lower()
    value = value.replace("\u202f", " ")
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)
    return value


def parse_hours(hours_list):
    """
    Converts:
    ["Monday: 8:00 AM–4:00 PM; 6:00 PM–12:00 AM"]

    Into:
    {
      "Mon": {
        "open1": "8:00 am",
        "close1": "4:00 pm",
        "open2": "6:00 pm",
        "close2": "12:00 am"
      }
    }
    """
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
            parts = re.split(r"\s*[–-]\s*", time_range)

            if len(parts) != 2:
                continue

            open_time = normalize_time_string(parts[0])
            close_time = normalize_time_string(parts[1])

            day_hours[f"open{idx}"] = open_time
            day_hours[f"close{idx}"] = close_time

        parsed[day_key] = day_hours if day_hours else None

    return parsed


with open(input_file, "r") as infile:
    data = json.load(infile)

city = infer_city(input_file)

headers = [
    "name",
    "slug",
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
    "description",
    "contact",
    "hours",
    "address",
    "vibe",
]

with open(output_file, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(headers)

    for venue in data:
        name = venue.get("name", "")
        slug = venue.get("slug") or slugify(name)

        lat = venue.get("lat", "")
        lon = venue.get("lon", "")

        link = venue.get("link", "")
        instagram_handle = extract_instagram_handle(link)

        tags = postgres_text_array(to_list(venue.get("tags", "")))
        venue_type = postgres_text_array(to_list(venue.get("type", "")))
        time_category = postgres_text_array(to_list(venue.get("timeCategory", "")))
        vibe = postgres_text_array(to_list(venue.get("vibe", "")))
        contact = postgres_text_array([link] if link else [])

        energy_ramp = venue.get("energyRamp", "")
        price = venue.get("price", "")
        duration = venue.get("duration", "")
        cover = venue.get("cover", "")
        description = venue.get("description", "")
        address = venue.get("address", "")
        hours = json.dumps(parse_hours(venue.get("hours", [])))

        row = [
            name,
            slug,
            lat,
            lon,
            instagram_handle,
            tags,
            venue_type,
            time_category,
            energy_ramp,
            price,
            duration,
            cover,
            city,
            description,
            contact,
            hours,
            address,
            vibe,
        ]

        writer.writerow(row)

print(f"✅ Flattened {len(data)} venues into {output_file}")
