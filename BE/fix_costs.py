"""Fix wrong champion costs in tft_traits_dtcl_s17.json based on blitz.gg data."""
import json

DATA_PATH = "data/tft_traits_dtcl_s17.json"

# Correct costs verified from blitz.gg Season 17
CORRECT_COSTS = {
    "Nami": 4,
    "Nunu & Willump": 4,
    "Xayah": 4,
    "Lulu": 3,
    "Gwen": 2,
    "Shen": 5,
}

# Correct costs for unique_traits verified from blitz.gg
UNIQUE_TRAIT_CORRECT_COSTS = {
    "Shen": 5,      # Chiến Lũy
    "Rhaast": 3,    # Chuộc Tội
    "Graves": 5,    # Tối Tân
}

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

fixes = 0

# Fix costs in regular traits
for trait in data["traits"]:
    for champ in trait["champions"]:
        name = champ["name"]
        if name in CORRECT_COSTS and champ["cost"] != CORRECT_COSTS[name]:
            print(f"Fixing [{trait['name']}] {name}: {champ['cost']} -> {CORRECT_COSTS[name]}")
            champ["cost"] = CORRECT_COSTS[name]
            fixes += 1

# Fix costs in unique_traits
for st in data["unique_traits"]:
    name = st["champion"]
    if name in UNIQUE_TRAIT_CORRECT_COSTS and st["cost"] != UNIQUE_TRAIT_CORRECT_COSTS[name]:
        print(f"Fixing unique [{st['name']}] {name}: {st['cost']} -> {UNIQUE_TRAIT_CORRECT_COSTS[name]}")
        st["cost"] = UNIQUE_TRAIT_CORRECT_COSTS[name]
        fixes += 1

with open(DATA_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\nTotal fixes applied: {fixes}")
print("Saved to", DATA_PATH)
