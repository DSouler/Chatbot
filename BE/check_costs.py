import json

with open('data/tft_traits_dtcl_s17.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

champ_costs = {}
for trait in data['traits']:
    for c in trait['champions']:
        name = c['name']
        cost = c['cost']
        champ_costs.setdefault(name, []).append((cost, trait['name']))

known_correct = {'Nami': 4, 'Nunu & Willump': 4, 'Xayah': 4, 'Lulu': 3, 'Gwen': 2, 'Shen': 5}
print('Wrong costs in regular traits:')
for name, correct in known_correct.items():
    if name in champ_costs:
        for cost, trait_name in champ_costs[name]:
            if cost != correct:
                print(f'  {name} in [{trait_name}]: cost={cost} (should be {correct})')

print()
print('Unique traits costs:')
for st in data['unique_traits']:
    champ = st['champion']
    cost = st['cost']
    print(f'  {champ} ({st["name"]}): cost={cost}')
