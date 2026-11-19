const E=require("../src/engine.js");Object.assign(global,E);
const M=require("../src/game.js");
global.STAT_NAMES=M.STAT_NAMES;global.avgOf=M.avgOf;global.MAIN_KEYS=M.MAIN_KEYS;global.SKILLS=M.SKILLS;global.DOCTOR_SKILL="改造人間";global.condUp=(G,n)=>{G.cond=Math.max(0,Math.min(4,G.cond+n));};global.addBad=M.addBad;global.NEGS=M.NEGS;global.capBond=M.capBond;const EV=require("../src/events.js");global.rollRandomEvent=EV.rollRandomEvent;
const VERB=process.argv[2]==='v';
function score(G,e){const p=M.playerForMatch(G);let s=0,c=0;for(let i=0;i<18;i++){const[par,y]=COURSE[i];const h=E.playHole(p,par,y,'normal',{pressure:e.pressure+(i>=15?.3:0),hole:i,carry:c,wx:G.evWx}).strokes;s+=h;c=E.carryAfter(p,par,h);}return s;}
function ready(G){const gb=M.gearBonus(G);let s=0;for(const k of M.MAIN_KEYS)s+=G.stats[k]+(gb[k]||0);return s/5;}
function wants(G,e){if(e.type==='test')return ready(G)>=(e.week>96?50:56);if(e.type==='amateur'&&G.diff==='poor')return G.money>=e.cost+30000;return true;}
function upcomingCost(G,weeks){let c=0;for(let w=G.week;w<=Math.min(144,G.week+weeks);w++){const e=M.eventAt(w,1);if(e&&wants(G,e))c+=e.cost;}return c;}
function bot(diff,traj){
 const G=M.newGame(diff);
 const wantCoach=diff==='rich'?2:1;
 while(!G.over){
  const e=M.curEvent(G);
  if(e){
    if(e.type==='mp'){M.mpAuto(G);}
    else if(M.eligible(G,e)&&G.money>=e.cost&&(e.type==='check'||wants(G,e))){G.money-=e.cost;M.finishEvent(G,e,score(G,e),M.makeField(e,G.evWx,G));if(G.skillOffer)M.pickSkill(G,0);}
    else if(e.type==='test'&&e.stage<3)G.testStage[e.stage]=0;
  }else{
   const ok=id=>M.canDo(G,M.ACTIONS.find(a=>a.id===id));
   const fee=M.COACHES[G.coach||wantCoach].fee;
   const reserve=upcomingCost(G,G.week>48?14:6)+(G.coach?fee:(G.week>=10?fee+10000:0))+5000;
   let id=null;
   // 買い物：コーチ・教本・道具
   const wantBooks=M.BOOKS.filter(b=>!G.books[b.id]);
   const shopNeed=(G.coach<wantCoach&&G.money>=M.COACHES[wantCoach].fee+10000)||(wantBooks.length>=2&&G.money>=reserve+20000)||(G.week>60&&Object.keys(G.owned).length<4&&G.money>=reserve+120000);
   if(G.stamina<(G.injury>0?101:56))id=(G.injury>0&&ok('clinic'))?'clinic':'rest';
   else if(diff==='poor'&&ok('job_caddie')&&G.money<90000)id='job_caddie';
   else if(diff==='poor'&&ok('job_range')&&G.money<25000&&G.week>4)id='job_range';
   else if(shopNeed){
     if(G.coach<wantCoach&&G.money>=M.COACHES[wantCoach].fee+10000)M.signCoach(G,wantCoach);
     for(const b of wantBooks){if(G.money>=b.price+5000){G.money-=b.price;G.books[b.id]=1;}}
     if(G.week>60)for(const s in M.GEAR){const cur=G.owned[s]==null?-1:G.owned[s];for(let i=1;i>cur;i--){if(G.money>=M.GEAR[s].items[i].price+reserve){G.money-=M.GEAR[s].items[i].price;G.owned[s]=i;break;}}}
     id='shop';
   }
   else if(G.money<reserve)id=ok('job_caddie')?'job_caddie':(G.diff==='poor'&&ok('job_range')?'job_range':'job_conv');
   else{
     const avg=M.avgOf(G,M.MAIN_KEYS);let best=-1;
     for(const a of M.ACTIONS){if(a.cat!=='練習'||!M.canDo(G,a))continue;const c=M.costOf(G,a);if(c>G.money-reserve&&c>0)continue;
       let v=0;for(const k in a.gain){const w=k==='mental'?0.5:Math.max(0.3,1+(avg-G.stats[k])/15);v+=a.gain[k]*M.practiceMult(G,a,k)*M.growMult(G.stats[k])*w;}
       if(v>best){best=v;id=a.id;}}
     if(best<0.5)id=ok('job_caddie')?'job_caddie':'job_conv';
   }
   M.doAction(G,id);if(G.skillOffer)M.pickSkill(G,0);
  }
  if(traj&&G.half===1&&G.week%12===0)traj.push([G.week,M.avgOf(G,M.MAIN_KEYS).toFixed(0),Math.round(G.money/1000),G.coach]);
  if(!G.over){M.advanceTurn(G);if(G.pending){const e=EV.RANDOM_EVENTS.find(x=>x.id===G.pending);EV.resolveEvent(G,Math.floor(Math.random()*e.choices.length));}}
 }
 return G;
}
if(VERB){for(const d of ['rich','normal','poor']){const t=[];const G=bot(d,t);console.log(d,G.passed?'合格':G.fired?'クビ':'時間切れ',G.week,JSON.stringify(G.stats,(k,v)=>typeof v==='number'?Math.round(v):v));console.log(t.map(x=>x.join('/')).join(' '));console.log(G.history.map(h=>h.week+':'+h.score+(h.target?'<='+h.target:'#'+h.rank)).join(' '));}}
else for(const d of ['rich','normal','poor']){let ok=0,ok2=0,fired=0,wk=0,fw={},N=150,av=0;for(let i=0;i<N;i++){const G=bot(d);if(G.passed){ok++;wk+=G.week;if(G.week<97)ok2++;}if(G.fired){fired++;fw[G.week]=(fw[G.week]||0)+1;}av+=M.avgOf(G,M.MAIN_KEYS);}
console.log(d,'合格',Math.round(ok/N*100)+'%','うち2年目',Math.round(ok2/N*100)+'%','クビ',Math.round(fired/N*100)+'%',JSON.stringify(fw),'合格週',ok?Math.round(wk/ok):'-','最終平均',(av/N).toFixed(0));}
