// Additional independent filters. Does not modify the voting backend or existing map code.
(() => {
  const styles=document.createElement('style');
  styles.textContent='.feature-filters{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.feature-filters button{padding:7px 10px;background:#31463a;color:#f7f1e5;border:1px solid #526357;font-size:13px}.feature-filters button.active{background:#e6b65b;color:#18211b}.feature-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.feature-tags span{font-size:11px;background:#385343;padding:3px 7px;border-radius:10px}';
  document.head.append(styles);
  const controls=document.querySelector('.controls');
  if(!controls||typeof filtered!=='function'||typeof render!=='function')return;
  const wrap=document.createElement('div');wrap.className='feature-filters';
  const featureNames={basic:'🍺 Basic',football:'⚽ Watch football',upscale:'✨ Upscale dining',music:'🎵 Music'};
  const selected=new Set();
  for(const [key,label] of Object.entries(featureNames)){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed','false');
    b.addEventListener('click',()=>{if(selected.has(key))selected.delete(key);else selected.add(key);b.classList.toggle('active',selected.has(key));b.setAttribute('aria-pressed',String(selected.has(key)));render()});
    wrap.append(b);
  }
  const note=document.createElement('p');note.className='small';note.textContent='Select one or more categories. Restaurants matching any selected category are shown.';
  controls.append(wrap,note);
  const originalFiltered=filtered;
  filtered=function(){const base=originalFiltered();return selected.size?base.filter(r=>[...selected].some(k=>(r.features||[]).includes(k))):base};
  const originalRender=render;
  render=function(){originalRender();const articles=document.querySelectorAll('#list .item');const items=filtered();articles.forEach((article,i)=>{const r=items[i];if(!r)return;const tags=document.createElement('div');tags.className='feature-tags';for(const k of r.features||[]){const t=document.createElement('span');t.textContent=featureNames[k];tags.append(t)}const muted=article.querySelector('.muted');if(muted)muted.after(tags)});};
  render();
})();
