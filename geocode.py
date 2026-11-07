"""One-time public geocoding on GitHub Actions. Never writes invented neighbourhood pins."""
import json, re, time, urllib.parse, urllib.request, pathlib, unicodedata
ROOT=pathlib.Path(__file__).parent
s=(ROOT/'data.js').read_text()
# Names are the first field of each candidate tuple.
names=re.findall(r"\['([^']+)','[^']+','[^']+'\]",s)
# One restaurant name uses double quotes; recover via separate pattern.
names=re.findall(r"\[(?:'((?:\\'|[^'])+)'|\"([^\"]+)\"),'([^']+)','([^']+)'\]",s)
restaurants=[(a or b,c) for a,b,c,d in names]
assert len(restaurants)==40, f'Expected 40, found {len(restaurants)}'
addresses={
'Бирария Атила':'ул. Крум Попов 64, София','Balkan Grill Arkadia':'ул. Крум Попов 64, София',
'Бирария При Водната Кула':'ул. Свети Теодосий Търновски 60, София',
'Club 1857':'ул. Сан Стефано 22, София','Luciano / Бирария Лучано':'пл. Петко Р. Славейков 9, София',
'Talpa Beerhouse':'ул. Христо Чернопеев 5А, София','Dondukov Brewery':'бул. Княз Александър Дондуков 14, София',
'SkaraBar 1':'ул. Димитър Греков 2, София','SkaraBar 2':'ул. Георги Бенковски 12, София',
'Ale House Lozenets':'ул. Крум Попов 4, София','Aubergine – Craft Beer. Craft Food.':'ул. Карнеги 11, София',
'Бирария Стамболовъ':'бул. Свети Наум 1, София','Halbite – Tri Ushi':'ул. Три уши 13, София',
'Prague 18 Family Pub':'бул. Прага 18, София','Ale House Centre':'ул. Христо Белчев 42, София',
'Избата / Izbata Tavern':'ул. Славянска 18, София','Kafana Stefanovich':'ул. Златовръх 4, София'}
existing={}
locfile=ROOT/'locations.js'
if locfile.exists():
 m=re.search(r'const VERIFIED_LOCATIONS\s*=\s*(\{.*?\})\s*;',locfile.read_text(),re.S)
 if m:
  try: existing=json.loads(m.group(1))
  except Exception: pass
existing={k:v for k,v in existing.items() if v.get('precision') not in ('area-estimate',None)}
HEADERS={'User-Agent':'SofiaBeerSkaraGitHub/1.0 (personal noncommercial restaurant map; contact via GitHub repository borsidimitrov/sofia-beer-skara)'}
last=[0.0]
def geocode(q):
 elapsed=time.monotonic()-last[0]
 if elapsed<1.2:time.sleep(1.2-elapsed)
 url='https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode({'q':q,'format':'jsonv2','limit':5,'addressdetails':1,'countrycodes':'bg'})
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=20) as r: data=json.load(r)
 except Exception as e:
  print('Lookup error',q,str(e));data=[]
 last[0]=time.monotonic()
 return [x for x in data if 42.57<float(x['lat'])<42.82 and 23.14<float(x['lon'])<23.54]
def norm(x):
 return ''.join(c for c in unicodedata.normalize('NFKD',x.lower()) if c.isalnum())
for i,(name,area) in enumerate(restaurants,1):
 if str(i) in existing:continue
 address=addresses.get(name)
 found=None;precision=None
 if address:
  # Search the address without the venue name. Nominatim is an address geocoder,
  # and often does not know the commercial name even when the street exists.
  results=geocode(address+', България')
  if not results:
   results=geocode(address.replace('ул. ','').replace('бул. ','').replace('пл. ','')+', България')
  # Accept an actual street address, never the city or neighbourhood centroid.
  number=re.search(r'\d+',address)
  for r in results:
   ad=r.get('address',{});hn=str(ad.get('house_number',''))
   if number and hn and re.search(r'\d+',hn) and re.search(r'\d+',hn).group()==number.group():
    found=r;precision='address';break
  if not found:
   # Some valid numbered addresses have no OSM house-number record.
   # Try a street-only lookup but NEVER silently claim it is the entrance.
   # Street centroids are not accurate enough for this restaurant map.
   print('Address unresolved:',name,address)
 else:
  for q in (name+', София, България',):
   results=geocode(q)
   for r in results:
    typ=r.get('type','');category=r.get('category','');label=r.get('name') or r.get('display_name','').split(',')[0]
    if category in ('amenity','tourism','shop') and (norm(name) in norm(label) or norm(label) in norm(name)) and len(norm(label))>4:
     found=r;precision='osm';break
   if found:break
 if found:
  existing[str(i)]={'lat':round(float(found['lat']),7),'lng':round(float(found['lon']),7),'precision':precision}
  print('MATCH',i,name,precision,found['display_name'])
 else:print('UNRESOLVED',i,name)
locfile.write_text('// Geocoded once using OpenStreetMap Nominatim. Unmatched restaurants remain unpinned.\nconst VERIFIED_LOCATIONS = '+json.dumps(existing,ensure_ascii=False,indent=2)+';\n')
print(f'Saved {len(existing)} of 40 locations')
