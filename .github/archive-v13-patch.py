from pathlib import Path
import re

root=Path('the-archive')

# Fix staged v13 script typo defensively before validation.
v13=root/'v13.js'
s=v13.read_text()
s=s.replace("await this.save('styleRules',[{...r,enabled:r.enabled===false,true:true,enabled:r.enabled===false?true:false}]);","await this.save('styleRules',[{...r,enabled:r.enabled===false?true:false}]);")
v13.write_text(s)

# Link v13 assets after the stable v12 assets.
idx=root/'index.html'
s=idx.read_text()
if './v13.css' not in s:
    s=s.replace('<link rel="stylesheet" href="./app.css">','<link rel="stylesheet" href="./app.css">\n<link rel="stylesheet" href="./v13.css">')
if './v13.js' not in s:
    s=s.replace('<script src="./app.js"></script>','<script src="./app.js"></script>\n<script src="./v13.js"></script>')
idx.write_text(s)

# Add synced/local collections without changing the legacy archive:v9 storage namespace.
storage=root/'storage.js'
s=storage.read_text()
if "'relationships'" not in s.split('];',1)[0]:
    s=s.replace("'feedback','careTasks','perfumeWears','calendarEvents'","'feedback','careTasks','perfumeWears','calendarEvents',\n  'relationships','atelier','retired','journals','styleRules','outfitFamilies','locations'")
storage.write_text(s)

# PWA cache/version.
sw=root/'sw.js'
s=sw.read_text()
s=re.sub(r"const CACHE = 'archive-v[^']+';","const CACHE = 'archive-v13.0.0';",s)
if "'./v13.js'" not in s:
    s=s.replace("'./icon.svg']","'./icon.svg','./v13.js','./v13.css']")
sw.write_text(s)

# Documentation marker.
readme=root/'README.md'
if readme.exists():
    s=readme.read_text()
    note='''\n## Wardrobe Intelligence v13\n\nAdds contextual outfit memory, garment relationship graph, outfit families, wardrobe locations, Atelier records, wear-photo journals, automatic seasonal rotation, rediscovery, retirement history, redundancy detection, purchase comparison, capsule optimisation, style evolution, recommendation confidence, Why Not analysis, scenario planning, wardrobe health, explicit style rules, and a local wardrobe-aware Stylist. Existing v9-v12 local data remains compatible.\n'''
    if 'Wardrobe Intelligence v13' not in s:
        s += note
    readme.write_text(s)
