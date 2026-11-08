// Run with Node.js 20+ in GitHub Actions. Adds address pins only when Nominatim
// returns a plausible matching house number and street in Sofia.
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(fs.readFileSync('data.js','utf8')+'\n;globalThis.__places=RESTAURANTS;globalThis.__addresses=ADDRESSES;',context);
vm.runInContext(fs.readFileSync('locations.js','utf8')+'\n;globalThis.__pins=VERIFIED_LOCATIONS;',context);
const places=context.__places, addresses=context.__addresses, pins=JSON.parse(JSON.stringify(context.__pins));
const norm=s=>String(s||'').toLowerCase().replace(/[„“"'.(),]/g,' ').replace(/\s+/g,' ').trim();
const house=s=>(String(s).match(/\b\d+[а-яa-z]?\b/i)||[])[0]?.toLowerCase()||'';
let count=0;
for(const r of places){
 if(pins[r.id]||!addresses[r.name])continue;
 const address=addresses[r.name];
 try{
  const url='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=bg&q='+encodeURIComponent(address);
  const res=await fetch(url,{headers:{'User-Agent':'SofiaBeerSkara/1.0 (GitHub community restaurant map)','Accept-Language':'bg,en'}});
  if(!res.ok){console.log('HTTP',res.status,r.name);continue}
  const candidates=await res.json();const targetHouse=house(address);
  const match=candidates.find(c=>{
   const lat=Number(c.lat),lng=Number(c.lon),a=c.address||{};
   if(!(lat>42.55&&lat<42.85&&lng>23.1&&lng<23.6))return false;
   if(!targetHouse||house(a.house_number)!==targetHouse)return false;
   const road=norm(a.road||a.pedestrian||a.residential||'');
   // Require the returned street to occur in the submitted address, not just the city.
   return road.length>=5&&norm(address).includes(road);
  });
  if(match){pins[r.id]={lat:Number(match.lat),lng:Number(match.lon),precision:'address'};count++;console.log('MATCH',r.id,r.name,match.display_name)}
  else console.log('UNRESOLVED',r.id,r.name,address);
 }catch(e){console.log('ERROR',r.name,e.message)}
 await new Promise(resolve=>setTimeout(resolve,1200));
}
fs.writeFileSync('locations.js','// Published restaurant locations; address matches are approximate.\nconst VERIFIED_LOCATIONS = '+JSON.stringify(pins,null,2)+';\n');
console.log('New locations:',count,'Total located:',Object.keys(pins).length,'of',places.length);
