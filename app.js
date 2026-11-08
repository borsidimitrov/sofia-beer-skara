const $=id=>document.getElementById(id);
const map=L.map('map').setView([42.691,23.328],14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);
const markers=L.layerGroup().addTo(map);
let routeLine=null;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mapsLink=r=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(ADDRESSES[r.name]||`${r.name}, ${r.area}, Sofia, Bulgaria`);
// Published coordinates always win over any older browser cache.
if(typeof VERIFIED_LOCATIONS!=='undefined')for(const r of RESTAURANTS){const v=VERIFIED_LOCATIONS[r.id];if(v&&Number.isFinite(v.lat)&&Number.isFinite(v.lng))Object.assign(r,v)}
for(const area of [...new Set(RESTAURANTS.map(r=>r.area))].sort())$('area').add(new Option(area,area));
const activeFeatures=new Set();
function filtered(){const q=$('search').value.trim().toLocaleLowerCase();return RESTAURANTS.filter(r=>($('type').value==='all'||r.type===$('type').value)&&($('area').value==='all'||r.area===$('area').value)&&(!q||(r.name+' '+r.area+' '+(ADDRESSES[r.name]||'')).toLocaleLowerCase().includes(q))&&(!$('mappedOnly').checked||Number.isFinite(r.lat)&&Number.isFinite(r.lng))&&[...activeFeatures].every(tag=>r.tags?.includes(tag)))}
function render(){
  const items=filtered(),located=RESTAURANTS.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng));
  $('stats').textContent=`${items.length} shown · ${located.length} mapped of ${RESTAURANTS.length} restaurants`;
  $('list').replaceChildren();markers.clearLayers();
  for(const r of items){
    const el=document.createElement('article');el.className='item';
    const title=document.createElement('strong');title.textContent=r.name;el.append(title);
    const info=document.createElement('div');info.className='muted';info.textContent=`${r.area} · ${r.type}`;el.append(info);
    for(const [key,label] of [['football','⚽ Football'],['upscale','✨ Upscale'],['music','🎵 Live music']])if(r.tags?.includes(key)){const tag=document.createElement('span');tag.className='tag';tag.textContent=label;el.append(tag)}
    if(!Number.isFinite(r.lat)){const tag=document.createElement('span');tag.className='tag';tag.textContent='📍 Map location pending';el.append(tag)}
    const links=document.createElement('div');links.className='links';
    const a=document.createElement('a');a.href=mapsLink(r);a.target='_blank';a.rel='noopener noreferrer';a.textContent='Google Maps ↗';links.append(a);
    if(Number.isFinite(r.lat)&&Number.isFinite(r.lng)){
      const b=document.createElement('button');b.className='smallbtn';b.textContent='Find on map';links.append(b);
      const m=L.marker([r.lat,r.lng],{opacity:r.precision==='area-estimate'?.65:1}).addTo(markers);
      m.bindTooltip(escapeHTML(r.name),{permanent:true,direction:'top',offset:[0,-10],className:'restaurant-label'});
      const popup=document.createElement('div');popup.innerHTML=`<strong>${escapeHTML(r.name)}</strong><br>${escapeHTML(r.area)} · ${escapeHTML(r.type)}<br>`;
      const link=document.createElement('a');link.href=mapsLink(r);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Google Maps ↗';popup.append(link);m.bindPopup(popup);
      const focus=()=>{map.setView([r.lat,r.lng],16);m.openPopup()};b.addEventListener('click',focus);title.style.cursor='pointer';title.addEventListener('click',focus);
    }
    el.append(links);$('list').append(el);
  }
  populateRoutes();
}
function populateRoutes(){const located=RESTAURANTS.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng)&&r.precision!=='area-estimate');for(const id of ['from','to']){const prev=$(id).value;$(id).replaceChildren(new Option(located.length?'Select restaurant':'No mapped restaurants',''));for(const r of located)$(id).add(new Option(r.name,String(r.id)));if(located.some(r=>String(r.id)===prev))$(id).value=prev}}
async function route(){
  const a=RESTAURANTS.find(r=>String(r.id)===$('from').value),b=RESTAURANTS.find(r=>String(r.id)===$('to').value);
  if(!a||!b||a.id===b.id||a.precision==='area-estimate'||b.precision==='area-estimate'){$('routeResult').textContent='Select two different mapped restaurants.';return}
  const foot=$('mode').value==='foot',profile=foot?'foot':'driving';
  const url=`https://routing.openstreetmap.de/routed-${profile}/route/v1/${profile}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  try{$('routeResult').textContent='Calculating route…';const res=await fetch(url);if(!res.ok)throw Error('unavailable');const data=await res.json(),r=data.routes?.[0];if(!r)throw Error('no route');if(routeLine)map.removeLayer(routeLine);routeLine=L.geoJSON(r.geometry,{style:{color:'#eab65b',weight:5}}).addTo(map);map.fitBounds(routeLine.getBounds(),{padding:[30,30]});$('routeResult').textContent=`${(r.distance/1000).toFixed(2)} km · about ${Math.round(r.duration/60)} min ${foot?'walking':'driving'} (approximate)`}catch{$('routeResult').textContent='Routing service unavailable. Use the Google Maps links instead.'}
}
for(const id of ['search','type','area'])$(id).addEventListener(id==='search'?'input':'change',render);
$('mappedOnly').addEventListener('change',render);
for(const button of document.querySelectorAll('[data-feature]'))button.addEventListener('click',()=>{const key=button.dataset.feature;if(activeFeatures.has(key))activeFeatures.delete(key);else activeFeatures.add(key);button.setAttribute('aria-pressed',String(activeFeatures.has(key)));render()});
$('routeBtn').addEventListener('click',route);
$('clearBtn').addEventListener('click',()=>{if(routeLine){map.removeLayer(routeLine);routeLine=null}$('routeResult').textContent='Route cleared.'});
render();
