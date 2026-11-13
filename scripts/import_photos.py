"""Convierte las fotos descargadas de Wikimedia Commons a WebP y genera src/data/photos.json con los créditos."""
import json, os, sys
from PIL import Image
SRC = sys.argv[1] if len(sys.argv) > 1 else '/var/tmp/wm'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'photos')
import shutil; shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT, exist_ok=True)
# Fotos descartadas tras revisión manual (no muestran el lugar o no son adecuadas para una miniatura).
BLOCK = {'places3': {'museo-de-historia-de-madrid'}, 'places2': {'cafe-gijon'}, 'places': {'cafe-central', 'museo-arqueologico-nacional', 'museo-del-prado', 'museo-thyssen-bornemisza', 'la-venencia', 'casa-revuelta'}}
data = {}
for group, width, q in (('hero', 1920, 70), ('places', 720, 68), ('places2', 720, 68), ('places3', 720, 68)):
    d = os.path.join(SRC, group)
    if not os.path.isdir(d): continue
    man = json.load(open(os.path.join(d, 'manifest.json')))
    out_group = 'places' if group in ('places2', 'places3') else group
    data.setdefault(out_group, {})
    for key, meta in man.items():
        if key in BLOCK.get(group, set()): continue
        im = Image.open(os.path.join(d, key + '.jpg')).convert('RGB')
        if im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        name = f'{out_group}-{key}.webp'
        im.save(os.path.join(OUT, name), 'WEBP', quality=q, method=6)
        data[out_group][key] = {'src': 'photos/' + name, 'w': im.width, 'h': im.height, **{k: v for k, v in meta.items() if not k.startswith('_')}}
json.dump(data, open(os.path.join(ROOT, 'src', 'data', 'photos.json'), 'w'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in data.items()}, sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) // 1024, 'KB')
