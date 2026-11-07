import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}});
const validId = x => typeof x==='string' && /^[a-f0-9-]{36}$/.test(x);
const store = () => getStore({
  name: 'kudedasenasera-polls',
  consistency: 'strong'
});
const DAYS = 7*24*60*60*1000;
const clean = s => String(s||'').trim().slice(0,100);
const fail = (msg,code=400)=>json({error:msg},code);

export default async function handler(request) {
  try {
    const url=new URL(request.url);
    const s=store();
    if(request.method==='GET') {
      const id=url.searchParams.get('id');
      if(!validId(id))return fail('Invalid poll link');
      const poll=await s.get(`poll/${id}`,{type:'json'});
      if(!poll)return fail('Poll not found',404);
      const result={poll:{id,title:poll.title,options:poll.options,expires:poll.expires},votes:{},total:0};
      for(const o of poll.options)result.votes[o.id]=0;
      // Each visitor has their own blob, avoiding simultaneous-write collisions.
     
const { blobs } = await s.list({
  prefix: `vote/${id}/`
});

const values = await Promise.all(
  blobs.map(item => s.get(item.key, { type: 'json' }))
);

for (const v of values) {
  if (v && Object.hasOwn(result.votes, v.optionId)) {
    result.votes[v.optionId]++;
    result.total++;
  }
}

      return json(result);
    }
    if(request.method!=='POST')return fail('Method not allowed',405);
    const raw=await request.text();if(raw.length>20000)return fail('Request too large',413);
    const body=JSON.parse(raw||'{}');
    if(body.action==='create') {
      const options=(Array.isArray(body.options)?body.options:[]).map(o=>({id:String(o.id||''),name:clean(o.name)}));
      if(options.length<2||options.length>40||options.some(o=>!/^\d{1,4}$/.test(o.id)||!o.name)||new Set(options.map(o=>o.id)).size!==options.length)return fail('Choose 2 to 40 restaurants');
      const id=randomUUID();const poll={title:clean(body.title)||'Group vote',options,expires:Date.now()+DAYS};
      await s.setJSON(`poll/${id}`,poll);
      return json({id,expires:poll.expires});
    }
    if(body.action==='vote') {
      const {id,visitorId,optionId}=body;
      if(!validId(id)||!validId(visitorId))return fail('Invalid poll or voter');
      const poll=await s.get(`poll/${id}`,{type:'json'});
      if(!poll)return fail('Poll not found',404);
      if(Date.now()>poll.expires)return fail('This poll has expired',410);
      if(!poll.options.some(o=>o.id===String(optionId)))return fail('Invalid restaurant');
      await s.setJSON(`vote/${id}/${visitorId}`,{optionId:String(optionId)});
      return json({ok:true});
    }
    return fail('Unknown action');
  }catch(e){console.error(e);return fail('Voting service unavailable. Please try again.',500)}
}
export const config={path:'/api/polls'};
