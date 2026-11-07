(() => {
  const api='/api/polls';
  const restaurants=typeof RESTAURANTS!=='undefined'?RESTAURANTS:[];
  const aside=document.querySelector('aside');if(!aside)return;
  const panel=document.createElement('section');panel.className='panel';panel.id='group-voting';
  panel.innerHTML=`<h3>🍻 Group voting</h3><p class="small">Explore the map first. When you're ready, create a private group poll and share its link with friends.</p><button id="openGroupVote">🍺 Create a group vote</button><div id="groupVoteContent" hidden></div>`;
  const stats=document.getElementById('stats');aside.insertBefore(panel,stats||aside.firstChild);
  const content=panel.querySelector('#groupVoteContent');const open=panel.querySelector('#openGroupVote');
  const el=(tag,attrs={},text='')=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;return n};
  const message=(text)=>{let p=content.querySelector('.vote-message');if(!p){p=el('p',{class:'small vote-message'});content.prepend(p)}p.textContent=text};
  const post=async payload=>{const r=await fetch(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not save');return d};
  const get=async id=>{const r=await fetch(`${api}?id=${encodeURIComponent(id)}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load');return d};
  function showCreate(){content.hidden=false;open.hidden=true;content.replaceChildren();
    content.append(el('p',{class:'small'},'Choose which restaurants your group can vote for:'));
    const title=el('input',{placeholder:'Poll name, e.g. Friday beers',maxlength:'100','aria-label':'Poll name'});title.value='Friday beers 🍺';content.append(title);
    const controls=el('div',{style:'display:flex;gap:8px;margin:8px 0;flex-wrap:wrap'});
    const all=el('button',{class:'smallbtn',type:'button'},'Select all');const none=el('button',{class:'smallbtn',type:'button'},'Clear selection');controls.append(all,none);content.append(controls);
    const choices=el('div',{style:'max-height:210px;overflow:auto;border:1px solid #526357;border-radius:8px;padding:8px'});
    const checkboxes=[];for(const r of restaurants){const label=el('label',{style:'display:flex;align-items:center;gap:8px;margin:5px 0;font-size:13px'});const cb=el('input',{type:'checkbox',style:'width:auto;flex-shrink:0'});cb.checked=true;label.append(cb,document.createTextNode(r.name));choices.append(label);checkboxes.push({r,cb})}content.append(choices);
    all.onclick=()=>checkboxes.forEach(x=>x.cb.checked=true);none.onclick=()=>checkboxes.forEach(x=>x.cb.checked=false);
    const create=el('button',{type:'button',style:'margin-top:10px'},'Create & share poll');content.append(create);
    create.onclick=async()=>{const selected=checkboxes.filter(x=>x.cb.checked).map(x=>({id:String(x.r.id),name:x.r.name}));if(selected.length<2){message('Choose at least two restaurants.');return}create.disabled=true;message('Creating your group poll…');try{const d=await post({action:'create',title:title.value,options:selected});const url=new URL(location.href);url.searchParams.set('poll',d.id);history.replaceState({},'',url);showPoll(d.id)}catch(e){message(e.message);create.disabled=false}};
  }
  async function showPoll(id){content.hidden=false;open.hidden=true;content.replaceChildren(el('p',{class:'small'},'Loading group poll…'));
    try{const data=await get(id);content.replaceChildren();const h=el('h3',{},data.poll.title);content.append(h);
      const expiry=el('p',{class:'small'},'Poll expires after 7 days. Results are shared with anyone who has this link.');content.append(expiry);
      const select=el('select',{'aria-label':'Choose restaurant'});for(const o of data.poll.options)select.append(el('option',{value:o.id},o.name));content.append(select);
      const vote=el('button',{type:'button',style:'margin-top:8px'},'🍺 Vote / change my vote');content.append(vote);
      const link=el('button',{type:'button',class:'secondary',style:'margin:8px 0 0 6px'},'🔗 Copy group link');content.append(link);
      const results=el('div',{style:'margin-top:12px'});content.append(results);
      const voterKey=`kudeda-voter-${id}`;let visitorId=localStorage.getItem(voterKey);if(!visitorId){visitorId=crypto.randomUUID();localStorage.setItem(voterKey,visitorId)}
      const selectedKey=`${voterKey}-choice`;if(localStorage.getItem(selectedKey))select.value=localStorage.getItem(selectedKey);
      const refresh=async()=>{const d=await get(id);results.replaceChildren(el('p',{class:'small'},`${d.total} vote${d.total===1?'':'s'} · Results`));
        const sorted=[...d.poll.options].sort((a,b)=>(d.votes[b.id]||0)-(d.votes[a.id]||0));
        for(const o of sorted){const count=d.votes[o.id]||0;const pct=d.total?Math.round(count/d.total*100):0;const row=el('div',{style:'margin:8px 0'});row.append(el('div',{style:'font-size:13px'},`${o.name} — ${count} (${pct}%)`));const bar=el('div',{style:'height:7px;background:#38483c;border-radius:9px;overflow:hidden'});bar.append(el('div',{style:`width:${pct}%;height:100%;background:#e6b65b` }));row.append(bar);results.append(row)};
      };
      vote.onclick=async()=>{vote.disabled=true;try{await post({action:'vote',id,visitorId,optionId:select.value});localStorage.setItem(selectedKey,select.value);await refresh();message('Your vote is saved! You can change it anytime.')}catch(e){message(e.message)}finally{vote.disabled=false}};
      link.onclick=async()=>{try{await navigator.clipboard.writeText(location.href);message('Group link copied — send it to your friends!')}catch{message('Copy the address from your browser to share the poll.')}};
      const back=el('button',{type:'button',class:'secondary',style:'margin-top:10px'},'➕ Start a different group poll');content.append(back);back.onclick=()=>{const url=new URL(location.href);url.searchParams.delete('poll');history.replaceState({},'',url);showCreate()};
      await refresh();
    }catch(e){content.replaceChildren();message('Could not load this group poll: '+e.message);const b=el('button',{type:'button'},'Create a new poll');content.append(b);b.onclick=showCreate}
  }
  open.onclick=showCreate;
  const id=new URLSearchParams(location.search).get('poll');if(id)showPoll(id);
})();
