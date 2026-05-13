import urllib.request
import json

METATFT_BASE = 'https://metatft.gg/wp-content/uploads/tft/16.9/champion'

champions = {
    'Aatrox': 'aatrox', 'Briar': 'briar', 'Caitlyn': 'caitlyn',
    'ChoGath': 'chogath', 'Ezreal': 'ezreal', 'Leona': 'leona',
    'Lissandra': 'lissandra', 'Nasus': 'nasus', 'Poppy': 'poppy',
    'RekSai': 'reksai', 'Talon': 'talon', 'Teemo': 'teemo',
    'TwistedFate': 'twistedfate', 'Veigar': 'veigar',
    'Akali': 'akali', 'BelVeth': 'belveth', 'Gnar': 'gnar',
    'Gragas': 'gragas', 'Gwen': 'gwen', 'Jax': 'jax', 'Jinx': 'jinx',
    'Meepsie': 'meepsie', 'Milio': 'milio', 'Mordekaiser': 'mordekaiser',
    'Pantheon': 'pantheon', 'Pyke': 'pyke', 'Zoe': 'zoe',
    'Aurora': 'aurora', 'Diana': 'diana', 'Fizz': 'fizz',
    'Illaoi': 'illaoi', 'KaiSa': 'kaisa', 'Lulu': 'lulu',
    'Maokai': 'maokai', 'MissFortune': 'missfortune', 'Ornn': 'ornn',
    'Rhaast': 'rhaast', 'Samira': 'samira', 'Urgot': 'urgot',
    'Viktor': 'viktor',
    'AurelionSol': 'aurelionsol', 'Corki': 'corki', 'Karma': 'karma',
    'Kindred': 'kindred', 'LeBlanc': 'leblanc', 'MasterYi': 'masteryi',
    'Nami': 'nami', 'Nunu': 'nunu', 'Rammus': 'rammus', 'Riven': 'riven',
    'Robot': 'robot', 'TahmKench': 'tahmkench', 'Xayah': 'xayah',
    'Bard': 'bard', 'Blitzcrank': 'blitzcrank', 'Fiora': 'fiora',
    'Graves': 'graves', 'Jhin': 'jhin', 'Morgana': 'morgana',
    'Shen': 'shen', 'Sona': 'sona', 'Vex': 'vex', 'Zed': 'zed',
}

ok = []
fail = []

for name, key in champions.items():
    url = f'{METATFT_BASE}/tft17_{key}_square.tft_set17.webp'
    try:
        req = urllib.request.Request(url, method='HEAD')
        req.add_header('User-Agent', 'Mozilla/5.0')
        resp = urllib.request.urlopen(req, timeout=5)
        status = resp.getcode()
        if status == 200:
            ok.append(name)
        else:
            fail.append((name, key, status))
    except Exception as e:
        fail.append((name, key, str(e)))

print(f"=== OK: {len(ok)} champions ===")
print(', '.join(ok))
print(f"\n=== FAILED: {len(fail)} champions ===")
for name, key, err in fail:
    print(f"  {name} ({key}): {err}")
