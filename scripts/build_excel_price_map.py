"""Build product_prices.json from Excel product detail files.

Matches Excel product names to backend seed product names using keyword
matching within each category, then writes a JSON map used by seed.py
to replace synthetic prices with real Excel selling prices.
"""
import json
import re
from pathlib import Path

import pandas as pd

# seed.py CATEGORIES product names, grouped by category
SEED_NAMES = {
    "electronics": [
        "Bluetooth Headphones", "USB-C Hub", "Mechanical Keyboard",
        "Portable SSD 1TB", "Webcam 4K", "Wireless Mouse", "Laptop Stand",
        "Monitor Light Bar", "Bluetooth Speaker", "Power Bank 20000mAh",
        "Wireless Earbuds", "Laptop Backpack", "USB-C Charger",
    ],
    "home": [
        "Air Purifier", "Robot Vacuum", "Smart Bulb 4-pack", "Coffee Scale",
        "Electric Kettle", "Standing Desk", "Ergonomic Chair", "Whiteboard",
        "Desk Organizer", "Floor Lamp", "Smart Plug", "Bedside Table",
        "Air Quality Monitor",
    ],
    "fitness": [
        "Adjustable Dumbbells", "Resistance Bands Set", "Yoga Mat",
        "Foam Roller", "Jump Rope", "Kettlebell 16kg", "Pull-up Bar",
        "Massage Gun", "Fitness Tracker", "Exercise Mat", "Water Bottle",
        "Ab Roller",
    ],
    "kitchen": [
        "Air Fryer", "Blender", "Food Processor", "Stand Mixer",
        "Toaster Oven", "Immersion Blender", "Coffee Grinder", "Digital Scale",
        "Rice Cooker", "Knife Set", "Storage Containers", "Pressure Cooker",
    ],
}

# Keywords used to match Excel product names to seed names within a category.
KEYWORDS = {
    "Bluetooth Headphones": ["headphone", "headset"],
    "USB-C Hub": ["hub"],
    "Mechanical Keyboard": ["keyboard"],
    "Portable SSD 1TB": ["ssd"],
    "Webcam 4K": ["webcam"],
    "Wireless Mouse": ["mouse"],
    "Laptop Stand": ["laptop stand"],
    "Monitor Light Bar": ["monitor light"],
    "Bluetooth Speaker": ["speaker"],
    "Power Bank 20000mAh": ["power bank"],
    "Wireless Earbuds": ["earbud", "earphone"],
    "Laptop Backpack": ["backpack", "bag"],
    "USB-C Charger": ["charger"],
    "Air Purifier": ["air purifier"],
    "Robot Vacuum": ["robot vacuum", "vacuum"],
    "Smart Bulb 4-pack": ["smart bulb", "bulb"],
    "Coffee Scale": ["coffee scale"],
    "Electric Kettle": ["kettle"],
    "Standing Desk": ["standing desk"],
    "Ergonomic Chair": ["chair"],
    "Whiteboard": ["whiteboard"],
    "Desk Organizer": ["desk organizer", "organizer"],
    "Floor Lamp": ["floor lamp", "lamp"],
    "Smart Plug": ["smart plug", "plug"],
    "Bedside Table": ["bedside table"],
    "Air Quality Monitor": ["air quality monitor"],
    "Adjustable Dumbbells": ["dumbbell"],
    "Resistance Bands Set": ["resistance band"],
    "Yoga Mat": ["yoga mat"],
    "Foam Roller": ["foam roller"],
    "Jump Rope": ["jump rope", "rope"],
    "Kettlebell 16kg": ["kettlebell"],
    "Pull-up Bar": ["pull-up bar", "pullup bar"],
    "Massage Gun": ["massage gun"],
    "Fitness Tracker": ["fitness tracker"],
    "Exercise Mat": ["exercise mat"],
    "Water Bottle": ["water bottle", "bottle"],
    "Ab Roller": ["ab roller"],
    "Air Fryer": ["air fryer"],
    "Blender": ["blender"],
    "Food Processor": ["food processor"],
    "Stand Mixer": ["stand mixer", "mixer"],
    "Toaster Oven": ["toaster oven", "otg", "oven"],
    "Immersion Blender": ["hand blender", "immersion blender"],
    "Coffee Grinder": ["coffee grinder", "grinder"],
    "Digital Scale": ["digital scale", "scale"],
    "Rice Cooker": ["rice cooker"],
    "Knife Set": ["knife set", "knife"],
    "Storage Containers": ["storage container", "container"],
    "Pressure Cooker": ["pressure cooker"],
}


def _normalize(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _match_excel_to_seed(excel_name: str, seed_names: list[str]) -> str | None:
    """Return the seed name that best matches the Excel name via keywords."""
    en = _normalize(excel_name)
    for seed in seed_names:
        for kw in KEYWORDS.get(seed, []):
            if _normalize(kw) in en:
                return seed
    return None


def _read_excel_rows(path: Path) -> list[dict]:
    df = pd.read_excel(path)
    df = df[df["Product Name"].notna()]
    df = df[df["Product Name"].astype(str).str.strip() != ""]
    df = df[~df["Product Name"].astype(str).str.contains("TOTAL", case=False, na=False)]
    return df.to_dict("records")


def main() -> None:
    data_dir = Path("product data")
    xlsx_files = sorted(data_dir.glob("Product_Details*.xlsx"))

    price_map: dict[str, dict] = {}
    matched = 0

    # Each Excel batch file maps to one seed category by file order:
    # Batch 1 -> electronics, Batch 2 -> home, Batch 3 -> fitness, Batch 4 -> kitchen
    batch_to_category = {
        "Product_Details.xlsx": "electronics",
        "Product_Details_Batch2.xlsx": "home",
        "Product_Details_Batch3.xlsx": "fitness",
        "Product_Details_Batch4.xlsx": "kitchen",
    }

    for xlsx in xlsx_files:
        seed_category = batch_to_category.get(xlsx.name)
        if seed_category is None:
            continue
        seed_names = SEED_NAMES[seed_category]
        for row in _read_excel_rows(xlsx):
            excel_name = str(row["Product Name"]).strip()

            seed_name = _match_excel_to_seed(excel_name, seed_names)
            if seed_name is None or seed_name in price_map:
                continue

            selling = row.get("Selling Price (₹)")
            mrp = row.get("MRP (₹)")
            discount = row.get("Discount (%)")
            rating = row.get("Rating (out of 5)")
            price_map[seed_name] = {
                "selling_price": float(selling) if pd.notna(selling) else None,
                "mrp": float(mrp) if pd.notna(mrp) else None,
                "discount_pct": float(discount) if pd.notna(discount) else None,
                "rating": float(rating) if pd.notna(rating) else None,
                "key_features": str(row.get("Key Features", "")) if pd.notna(row.get("Key Features")) else "",
                "warranty": str(row.get("Warranty", "")) if pd.notna(row.get("Warranty")) else "",
                "color": str(row.get("Color", "")) if pd.notna(row.get("Color")) else "",
                "specs": str(
                    row.get("Connectivity / Ports")
                    or row.get("Connectivity / Power")
                    or row.get("Size / Specs")
                    or row.get("Capacity / Specs", "")
                ),
            }
            matched += 1

    out_path = Path("backend/app/product_prices.json")
    out_path.write_text(json.dumps(price_map, indent=2))
    total_seed = sum(len(v) for v in SEED_NAMES.values())
    print(f"Matched {matched}/{total_seed} seed products -> {out_path}")


if __name__ == "__main__":
    main()
