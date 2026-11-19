// ===== 画面 =====
const SAVE_KEY='golfIkusei_v3';
let G=null, lastLog=[], match=null, view='splash', resultMsgs=[], anim=null, animTimer=null, flash=false;
const $=id=>document.getElementById(id);
const yen=n=>(n<0?'−':'')+Math.abs(Math.round(n)).toLocaleString()+'円';
// 端末の保存領域は消えることがあるので、同じ内容をクラウドにも保存する
const MEM={};
function lsGet(k){try{const v=localStorage.getItem(k);if(v!=null){MEM[k]=v;return v;}}catch(e){}return MEM[k]!=null?MEM[k]:null;}
function lsSet(k,v){MEM[k]=v;try{localStorage.setItem(k,v);}catch(e){}cloudPush();}
function lsDel(k){delete MEM[k];try{localStorage.removeItem(k);}catch(e){}cloudPush();}
const META_KEY='golfIkusei_meta',HOF_KEY='golfIkusei_hof',LAST_KEY='golfIkusei_last';
function save(){G.t=Date.now();lsSet(SAVE_KEY,JSON.stringify(G));}
function load(){try{const s=lsGet(SAVE_KEY);return s?JSON.parse(s):null;}catch(e){return null;}}
function clearSave(){if(lsGet(SAVE_KEY)!=null)lsDel(SAVE_KEY);}
function loadHof(){try{return JSON.parse(lsGet(HOF_KEY)||'[]');}catch(e){return [];}}
function saveHof(l){lsSet(HOF_KEY,JSON.stringify(l));}
function loadMeta(){let m={};try{m=JSON.parse(lsGet(META_KEY)||'{}')||{};}catch(e){}m.pts=m.pts||0;m.lv=m.lv||{};if(!m.g1){m.g1=1;m.pts+=200;MEM[META_KEY]=JSON.stringify(m);try{localStorage.setItem(META_KEY,MEM[META_KEY]);}catch(e){}}return m;}
function saveMeta(m){m.t=Date.now();lsSet(META_KEY,JSON.stringify(m));}
let cloudDoc=null,cloudBusy=false,cloudDirty=false,cloudTimer=null,cloudState='wait',cloudLast='';
function cloudBody(){return {save:MEM[SAVE_KEY]||'',meta:MEM[META_KEY]||'',hof:MEM[HOF_KEY]||'',last:MEM[LAST_KEY]||''};}
function cloudPush(){if(!cloudDoc)return;cloudDirty=true;clearTimeout(cloudTimer);cloudTimer=setTimeout(cloudFlush,2500);}
async function cloudFlush(){
  if(!cloudDoc||cloudBusy||!cloudDirty)return;clearTimeout(cloudTimer);
  const b=cloudBody(),sig=JSON.stringify(b);cloudDirty=false;if(sig===cloudLast)return;
  cloudBusy=true;try{await cloudDoc.set(Object.assign({at:Date.now()},b));cloudLast=sig;cloudState='on';}catch(e){cloudState='err';}
  cloudBusy=false;if(cloudDirty)cloudPush();
}
function cloudMerge(d){
  const P=x=>{try{return x?JSON.parse(x):null;}catch(e){return null;}};
  const put=(k,v)=>{MEM[k]=v;try{localStorage.setItem(k,v);}catch(e){}};
  // 引き継ぎポイント：新しいほうを使う
  const cm=P(d.meta),lm=P(lsGet(META_KEY));if(cm&&(!lm||(cm.t||0)>(lm.t||0)))put(META_KEY,d.meta);
  // 殿堂入り：両方を合わせる
  const ch=P(d.hof)||[],lh=P(lsGet(HOF_KEY))||[],key=x=>[x.name,x.date,x.week,x.best].join('|'),seen={};
  const all=[];for(const x of lh.concat(ch)){const k=key(x);if(seen[k]){seen[k].wins=Math.max(seen[k].wins||0,x.wins||0)||undefined;seen[k].tourBest=Math.max(seen[k].tourBest||0,x.tourBest||0)||undefined;continue;}seen[k]=x;all.push(x);}
  if(all.length!==lh.length)put(HOF_KEY,JSON.stringify(all));
  // 途中のデータ：新しいほうを使う
  const cs=P(d.save),ls=P(lsGet(SAVE_KEY));if(cs&&!cs.over&&(!ls||(cs.t||0)>(ls.t||0)))put(SAVE_KEY,d.save);
  if(d.last&&lsGet(LAST_KEY)==null)put(LAST_KEY,d.last);
}
async function cloudInit(){
  try{
    for(let i=0;i<50&&!(window.claude&&window.claude.use);i++)await new Promise(r=>setTimeout(r,100));
    if(!(window.claude&&window.claude.use)){cloudState='off';return;}
    const [db,user]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);
    if(!db||!user){cloudState='off';return;}
    const id=await user.id();if(!id){cloudState='off';return;}
    const ref=db.doc('data/users/'+id+'/golf');
    const snap=await ref.get();
    for(const k of [SAVE_KEY,META_KEY,HOF_KEY,LAST_KEY])lsGet(k);
    if(snap&&snap.exists){const before=JSON.stringify(cloudBody());cloudMerge(snap.data()||{});cloudLast='';if(before!==JSON.stringify(cloudBody())&&(view==='title'||view==='hof'||view==='meta'))render();}
    cloudDoc=ref;cloudState='on';cloudDirty=true;cloudFlush();
  }catch(e){cloudState='err';}
  if(view==='title')render();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)cloudFlush();});
const MONTHS=[4,5,6,7,8,9,10,11,12,1,2,3]; // 4月始まり。1か月＝4週
function weekLabel(w,h){const y=Math.floor((w-1)/48)+1,ww=w-(y-1)*48;return `${y}年目 ${MONTHS[Math.floor((ww-1)/4)]}月 第${(ww-1)%4+1}週`+(h!=null?`・${HALF_NAMES[h]}`:'');}
let resData=null;
let lastActId=null,calYear=1,menuCat='練習',pickMode='simple',roundPick=false;
const SCENE_OF={komaza:'approach',job_lesson:'lesson'};
function nextEvent(G,type){for(let w=G.week;w<=TOTAL_WEEKS;w++)for(const h of [0,1]){if(w===G.week&&h<=G.half)continue;const e=evAt(G,w,h);if(e&&(type?e.type===type:e.type!=='check'))return e;}return null;}
const SCENE_LABEL={play:'気晴らしに遊んでいる…',shrine:'神社でお参り中…',clinic:'病院でリハビリ中…',swing:'素振り中…',mat:'パターマットで練習中…',green:'練習グリーンで練習中…',range:'打ちっぱなしで練習中…',approach:'アプローチ練習中…',bunker:'バンカー練習中…',short:'ショートコースを回っている…',round:'実戦ラウンド中…',komaza:'小技を練習中…',lesson:'ラウンドレッスン中…',job_conv:'コンビニでバイト中…',job_range:'練習場でバイト中…',job_caddie:'キャディのバイト中…',job_lesson:'レッスン補助のバイト中…',rest:'ゆっくり休んでいる…',onsen:'温泉でのんびり…',shop:'買い物から帰るところ…'};

function render(){
  const app=$('app');
  const html={course:csHTML,tour:tourHTML,splash:splashHTML,newgame:newgameHTML,bird:birdHTML,tee:teeHTML,skillpick:skillPickHTML,cup:cupHTML,hof:hofHTML,meta:metaHTML,title:titleHTML,match:matchHTML,result:resultHTML,shop:shopHTML,ending:endingHTML,anim:animHTML,res:resHTML,revent:reventHTML,cal:calHTML,main:mainHTML}[view]();
  app.innerHTML=html;flash=false;viewAt=Date.now();
  if(view==='revent'||view==='skillpick')setTimeout(()=>{const r=document.querySelector('.revent');if(r)r.classList.remove('lock');},800);
}
let viewAt=0;
document.addEventListener('click',()=>{if(Date.now()-viewAt<250)return;if(view==='anim')endAnim();else if(view==='res')resNext();});
// ---- タイトル画面：後ろ姿の主人公がフルスイング → ボールが星になる → 雲が流れて題字が出る ----
const GAME_VER='ver1.1';
let spT0=0,spRaf=0,spDone=false;
const SP_END=6.8; // 題字が出そろうまでの秒数
function splashHTML(){
  spT0=performance.now();spDone=false;setTimeout(()=>{cancelAnimationFrame(spRaf);spRaf=requestAnimationFrame(spDraw);},0);
  return `<div class="splash" onclick="splashTap()"><canvas id="spcv" width="90" height="160"></canvas>
  <div class="sptitle" id="sptitle">プロテスト<br>への道</div><div class="sptap" id="sptap">タップしてスタート</div><div class="spver">${GAME_VER}</div></div>`;
}
function splashTap(){if(!spDone){spT0=performance.now()-SP_END*1000;return;}cancelAnimationFrame(spRaf);view='title';render();window.scrollTo(0,0);}
function spDraw(now){
  const c=document.getElementById('spcv');if(!c||(view!=='splash'&&view!=='title'))return;
  let t=(now-spT0)/1000;if(view==='title')t=Math.max(t,SP_END+2); // メニュー画面の背景は、タイトル画面の最後の絵
  const x=c.getContext('2d'),W=90,H=160,R=(col,a,b,w,h)=>{x.fillStyle=col;x.fillRect(Math.round(a),Math.round(b),Math.round(w),Math.round(h));};
  const line=(col,x0,y0,x1,y1,w)=>{const n=Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0)));for(let i=0;i<=n;i++)R(col,x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,w||1,w||1);};
  // 夜明けの空
  const sky=['#141a3a','#1b2350','#27306a','#3a3a7c','#57468a','#7a5490','#a0648c','#c87a80','#e89a72','#f6bc78','#fad898'],HZ=104;
  sky.forEach((s,i)=>R(s,0,Math.floor(i*HZ/sky.length),W,Math.ceil(HZ/sky.length)+1));
  for(const [sx,sy,ph] of [[8,10,0],[70,6,1],[52,18,2],[82,30,3],[14,44,4],[40,8,5],[62,40,2.5]])if(Math.sin(t*2+ph)>-0.3)R('#e8ecff',sx,sy,1,1);
  // 山・森・フェアウェイ
  for(let i=0;i<W;i++){const m=8+Math.sin(i*0.09)*5+Math.sin(i*0.23+1)*3;R('#3a3560',i,HZ-m,1,m);}
  for(let i=0;i<W;i+=3)R('#243a34',i,HZ-3-((i*7)%3),3,4);
  R('#2c5a36',0,HZ,W,H-HZ);
  for(let y=HZ;y<H;y++){const k=(y-HZ)/(H-HZ),half=6+k*40,cx=40+k*23;R((Math.floor(Math.pow(k,0.6)*9)%2)?'#4a9a52':'#429048',cx-half,y,half*2,1);}
  R('#e9eef0',38,HZ-7,1,7);R('#e85a5a',39,HZ-7,3,2);
  R('#5aa860',40,139,50,21);R('#66b46c',40,139,50,1);
  // 主人公の位置（右端から30%）と大きさ（0.8倍）
  const OX=63,OY=151,S=0.8;
  const P=(col,a,b,w,h)=>{const x0=Math.round(OX+a*S),y0=Math.round(OY+b*S),x1=Math.round(OX+(a+w)*S),y1=Math.round(OY+(b+h)*S);x.fillStyle=col;x.fillRect(x0,y0,Math.max(1,x1-x0),Math.max(1,y1-y0));};
  const LP=(col,x0,y0,x1,y1,w)=>line(col,OX+x0*S,OY+y0*S,OX+x1*S,OY+y1*S,w);
  const BX0=OX+22*S,BY0=OY-3*S;
  // ボールと星
  const SW=1/0.9,HIT=1.55*SW,STAR=HIT+1.75,sx0=22,sy0=30; // スイングは0.9倍の速さ
  if(t>=HIT&&t<STAR){const k=(t-HIT)/(STAR-HIT),e=1-Math.pow(1-k,2.2),bx=BX0+(sx0-BX0)*e,by=BY0+(sy0-BY0)*e-Math.sin(k*Math.PI)*6;
    for(let i=1;i<6;i++){const k2=Math.max(0,k-i*0.02),e2=1-Math.pow(1-k2,2.2);R('rgba(255,255,255,'+(0.35-i*0.05)+')',BX0+(sx0-BX0)*e2,BY0+(sy0-BY0)*e2-Math.sin(k2*Math.PI)*6,1,1);}
    R('#fff',bx,by,k<0.35?2:1,k<0.35?2:1);}
  if(t>=STAR){const k=t-STAR,r=k<0.25?k/0.25*9:Math.max(3,9-(k-0.25)*14)+Math.sin(t*5)*0.8,col=k<0.4?'#fff':'#fff6c8';
    R(col,sx0-r,sy0,r*2+1,1);R(col,sx0,sy0-r,1,r*2+1);const d=Math.max(1,Math.round(r/3));R(col,sx0-d,sy0-d,d*2+1,d*2+1);R('#fff',sx0-1,sy0-1,3,3);
    if(k<0.3)R('rgba(255,255,255,'+(0.5-k*1.6)+')',0,0,W,H);}
  // 雲（星になったあと、2秒かけてゆっくり左右から流れてくる）
  const cl=(cx,cy,s)=>{R('#f4d6d0',cx,cy,18*s,4);R('#f4d6d0',cx+3*s,cy-3,11*s,3);R('#fff0ea',cx+5*s,cy-5,6*s,2);R('#d8b0b8',cx+1,cy+4,16*s,1);};
  if(t>STAR+0.4){const k=Math.min(1,(t-STAR-0.4)/2.0),e=k*k*(3-2*k),dr=Math.sin(t*0.3)*2;
    cl(-40+e*38+dr,58,1.4);cl(W+10-e*40-dr,50,1.2);cl(-30+e*52+dr*0.5,84,1);cl(W+20-e*30,78,0.9);}
  // 主人公。構えと振り上げは「ボールに向かって立つ横向き」、振り抜いたあとは腰が回って「目標を向いた後ろ姿」になる
  const pose=t<0.7*SW?0:t<1.35*SW?1:t<HIT?2:3,SK='#d9a37a',NV='#2c3e5c',GR='#8a8676';
  P('rgba(0,0,0,.3)',-12,0,26,3);
  if(pose<3){
    P('#c9ced0',-8,-3,6,3);P('#e9eef0',-3,-3,9,3);                                  // 靴（つま先は右＝ボールのほう）
    P('#77735f',-7,-17,5,14);                                                       // 奥の脚
    P(GR,-2,-12,5,9);P(GR,-4,-19,6,8);P(GR,-7,-22,8,5);                             // 手前の脚（ひざを軽く曲げる）とお尻
    P('#3a3226',-6,-24,9,2);                                                        // ベルト
    for(let i=0;i<14;i++){P(NV,-6+i*0.55,-25-i,10,1);P('#243450',-6+i*0.55,-25-i,2,1);} // 前に傾けた上半身
    P(SK,5,-41,3,2);P(SK,4,-47,7,6);P('#5a4030',3,-50,9,4);P('#4a3323',11,-47,3,1);P('#3a2a1c',3,-46,2,3); // 首・頭・帽子（つばは右）
    if(pose===0){LP(NV,7,-36,10,-25,2);P(SK,9,-25,3,3);LP('#cfd6da',10,-23,19,-3);P('#e9eef0',18,-3,5,2);P('#fff',22,-3,2,2);}
    else if(pose===1){LP(NV,7,-36,2,-48,2);P(SK,0,-51,3,3);LP('#cfd6da',1,-51,12,-59);P('#e9eef0',11,-61,3,3);P('#fff',22,-3,2,2);}
    else{LP(NV,7,-36,10,-25,2);P(SK,9,-25,3,3);LP('#cfd6da',10,-23,19,-3);P('#e9eef0',18,-3,5,2);
      // 残像：振り上げた位置（頭の上）からボールへ、肩を中心にした弧に沿って薄いクラブを重ねる
      for(let i=0;i<15;i++){const k=i/14,a=(-80+k*147)*Math.PI/180,r=26+k*9,ex=0.55+0.45*k*k*k,hx=6+Math.cos(a)*r*ex,hy=-36+Math.sin(a)*r,al=(0.1+k*0.45).toFixed(2);P('rgba(255,255,255,'+al+')',hx-1,hy-1,k>0.6?3:2,2);if(i>=11)LP('rgba(255,255,255,'+(0.15+(k-0.78)*0.6).toFixed(2)+')',6+Math.cos(a)*r*ex*0.45,-36+Math.sin(a)*r*0.45,hx,hy);}
      P('#fff',22,-3,2,2);}
  }else{
    const F=(col,a,b,w,h)=>P(col,a,b-31,w,h),FL=(col,x0,y0,x1,y1,w)=>LP(col,x0,y0-31,x1,y1-31,w),lean=-2;
    F('#e9eef0',-8,28,6,3);F('#e9eef0',3,28,6,3);
    F(GR,-7,14,5,15);F(GR,3,14,5,15);F('#77735f',-2,14,5,4);
    F('#3a3226',-7+lean*0.3,12,15,2);
    F(NV,-8+lean,-2,17,14);F('#243450',-8+lean,9,17,3);F('#35496c',-6+lean,-2,13,2);
    F(SK,-2+lean,-5,5,3);
    F(SK,-4+lean,-11,9,7);F('#5a4030',-5+lean,-13,11,5);F('#4a3323',-5+lean,-9,11,1);F('#3a2a1c',-3+lean,-8,7,2);
    FL(NV,-8,0,-13,-10,2);FL(NV,7,1,-9,-9,2);F(SK,-15,-13,3,3);FL('#cfd6da',-14,-13,12,-2);F('#e9eef0',12,-3,4,3);
  }
  // 題字と「タップしてスタート」
  if(!spDone&&t>=SP_END){spDone=true;}
  const ti=document.getElementById('sptitle'),tp=document.getElementById('sptap');
  if(ti)ti.style.opacity=Math.max(0,Math.min(1,(t-(SP_END-1.2))/1.0));
  if(tp)tp.style.visibility=spDone?'visible':'hidden';
  spRaf=requestAnimationFrame(spDraw);
}
// ---- メニュー画面 ----
function titleHTML(){
  const s=load();
  setTimeout(()=>{cancelAnimationFrame(spRaf);spRaf=requestAnimationFrame(spDraw);},0);
  return `<div class="splash menuwrap"><canvas id="spcv" width="90" height="160"></canvas>
  <div class="menuin menu">
  ${s&&!s.over&&s.bore?`<button class="big" onclick="cont()">つづきから<small>${weekLabel(s.week,s.half)}</small></button>`:''}
  <button class="big ${s&&!s.over&&s.bore?'sub2':''}" onclick="view='newgame';render();window.scrollTo(0,0)">はじめから</button>
  <button class="big metab" onclick="view='meta';render();window.scrollTo(0,0)">🎁 引き継ぎ特典<small>${loadMeta().pts}ポイント</small></button>
  <button class="big hofb" onclick="view='hof';render();window.scrollTo(0,0)">🏛 殿堂入り<small>${loadHof().length}人</small></button>
  <div class="mrow"><button class="big birdb" onclick="bird={phase:'pick'};view='bird';render();window.scrollTo(0,0)">🐦 鳥よけ<small>お試し</small></button><button class="big birdb" onclick="cs={phase:'pick'};view='course';render();window.scrollTo(0,0)">🗺 コース攻略<small>お試し</small></button></div>
  <button class="big sub2 backt" onclick="cancelAnimationFrame(spRaf);view='splash';render();window.scrollTo(0,0)">‹ タイトルに戻る</button>
  </div>
  <p class="cloud mcloud c-${cloudState}">${{wait:'☁ 保存先を確認中…',on:'☁ 記録はクラウドにも保存されます',off:'⚠ この開き方ではクラウド保存が使えません。記録はこの端末だけに残ります',err:'⚠ クラウド保存に失敗しました。記録はこの端末だけに残ります'}[cloudState]}</p>
  <div class="spver">${GAME_VER}</div></div>`;
}
function newgameHTML(){
  const s=load(),has=s&&!s.over&&s.bore;
  return `<div class="top"><div class="wk">はじめから</div><div class="money"></div></div>
  <button class="ghost backtop" onclick="view='title';render()">‹ メニューに戻る</button>
  <p class="lead">クラブを握ったこともない素人が、ゴルフ場の研修生になった。<br>3年以内にプロテスト合格を目指せ。<br>3か月ごとの<b>査定ラウンド</b>で目標スコアを切れなければクビ。<br>最初の目標は<b>「135を切る」</b>。<br>仲間と練習すると伸びが大きく、絆が深まると特技を教わる。</p>
  ${has?`<p class="warn">※ 新しく始めると、途中のデータ（${weekLabel(s.week,s.half)}）は消えます</p>`:''}
  <h3>練習メニューの数</h3>
  <div class="tabs t2"><button class="${pickMode==='simple'?'on':''}" onclick="pickMode='simple';render()">絞る版（6種類）</button><button class="${pickMode==='full'?'on':''}" onclick="pickMode='full';render()">絞らない版（8種類）</button></div>
  <p class="lead">${pickMode==='simple'?'ショット・パター・小技・ショートコース・実戦ラウンド・ラウンドレッスンの6つ。迷いにくい。':'素振り、打ちっぱなし、アプローチ、バンカーなどを別々に選べる。'}</p>
  <h3>家庭環境を選ぶ（＝難易度）</h3>
  ${Object.entries(DIFFS).map(([k,d])=>`<button class="diff" onclick="start('${k}')"><b>${d.name}</b><em>${d.level}</em><span>${d.desc}<br>最初の所持金 ${yen(d.start)}</span></button>`).join('')}`;
}
function start(k){G=newGame(k);const _m=loadMeta();applyMeta(G,_m);G.mode=pickMode;menuCat='練習';roundPick=false;
  const newbie=!lsGet(LAST_KEY)&&!loadHof().length;if(newbie){G.items=G.items||{};for(const id of ['dumbbell','stretch','net','pmat','balance','sandbox'])G.items[id]=1;}
  lastLog=['研修生としての日々が始まった。','<b>まずは「おでかけ」で買い物に行き、コーチと契約しよう</b>'].concat(newbie?['（まだ合格したことがないので、ダンベル・柔軟マット・自宅用の練習ネット・高級パターマット・バランスボード・バンカー練習用の砂袋を最初から持っている）']:[]).concat(['まずは<b>素振り</b>と<b>パターマット</b>から。球を打つ練習は、コーチがいないとなかなか身につかない。','コーチや教本は「おでかけ」の「買い物・コーチ探し」で。','練習に<b>仲間のマーク</b>が付いていたら、一緒に練習できるチャンス。']);G.friendAt=placeFriends(G);save();showRes('idle','はじめに',null,lastLog);}
function cont(){G=load();fixSave(G);lastLog=['続きから再開した。'];if(!G.gift9){G.gift9=true;G.money+=2000;lastLog.push('🎁 臨時収入：所持金＋2,000円');save();}if(!G.gift1){G.gift1=true;G.money+=10000;lastLog.push('🎁 臨時収入：所持金＋10,000円');save();}if(!G.gift2){G.gift2=true;G.money+=1000000;lastLog.push('🎁 臨時収入：所持金＋1,000,000円');save();}if(!G.gift3){G.gift3=true;G.money+=10000;lastLog.push('🎁 臨時収入：所持金＋10,000円');save();}if(!G.gift4){G.gift4=true;G.money+=40000;lastLog.push('🎁 臨時収入：所持金＋40,000円');save();}if(!G.gift5){G.gift5=true;G.money+=5000;lastLog.push('🎁 お詫び：所持金＋5,000円');save();}if(!G.gift6){G.gift6=true;G.money+=15000;lastLog.push('🎁 臨時収入：所持金＋15,000円');save();}if(!G.gift7){G.gift7=true;G.money+=1000;lastLog.push('🎁 臨時収入：所持金＋1,000円');save();}if(!G.gift8){G.gift8=true;G.money+=6000;lastLog.push('🎁 臨時収入：所持金＋6,000円');save();}if(G.shopOpen){view='shop';render();}else showRes('idle','おかえり',null,lastLog);}

function statHTML(){
  const gb=gearBonus(G);
  return STAT_KEYS.map(k=>{const v=G.stats[k],b=gb[k]||0;return `<div class="stat"><div class="sn">${STAT_NAMES[k]}${hasBook(G,k)?' 📖':''}</div><div class="rk ${rankCls(v+b)}">${rankOf(v+b)}</div><div class="sv">${Math.floor(v+b)}</div><div class="bar"><i style="width:${Math.min(100,v+b)}%"></i></div></div>`;}).join('');
}
function chipsHTML(){
  const fr=FRIENDS.map(f=>{const b=G.bond[f.id]||0;return `<div class="fb"><span>${f.icon}${b?f.name:'？？？'}</span><div class="bb"><i style="width:${b}%"></i></div><small>${b>=100?'秘伝':b}</small></div>`;}).join('');
  return `<div class="friends">${fr}</div><div class="chips"><span class="${G.coach?'':'warnc'}">コーチ：${COACHES[G.coach].name}${G.coach?`（月${yen(COACHES[G.coach].fee)}）`:''}</span>${G.skills.map(s=>`<span class="sk">★${skillLabel(s,G.skillLv)}</span>`).join('')}</div>`;
}
function topHTML(){
  const stc=G.stamina>=60?'ok':G.stamina>=30?'mid':'low';
  return `<div class="top"><div><div class="wk">${weekLabel(G.week,G.half)}</div><div class="df">${DIFFS[G.diff].name}（${DIFFS[G.diff].level}）</div></div><div class="money">${yen(G.money)}</div></div>
  <div class="stam"><span>体力</span><div class="sbar ${stc}"><i style="width:${G.stamina}%"></i></div><span>${Math.round(G.stamina)}</span><span class="cond c${G.cond}">調子：${COND[G.cond]}</span>${G.injury>0?`<span class="cond inj">🤕ケガ あと約${Math.ceil(G.injury/2)}週</span>`:''}</div>`;
}
function frHTML(ids){return ids.length?`<span class="frs">${ids.map(f=>{const F=FRIENDS.find(x=>x.id===f);return `<i>${F.icon}${F.name}</i>`;}).join('')}</span>`:'';}
function actBtn(a,label){
  const c=costOf(G,a),dis=!canDo(G,a),why=unavailableReason(G,a);
  const base=a.cost[G.half];const deal=c!=null&&base!=null&&c!==base;
  const ef=effectOf(G,a);
  const cls=a.cat==='バイト'?'job':a.cat==='休む'?'rest':a.cat==='おでかけ'?'go':'';
  const tired=tooTired(G,a),stv=a.st<0?-staminaCost(G,a):a.st;
  const rk=c!=null&&!tired&&!blockedByInjury(G,a)?Math.round(injuryRisk(G,a)*100):0;
  const n=ef?{'◎':3,'○':2,'△':1,'×':0}[ef.mark]:0;
  const l2=c==null?`<span class="tired">${why}</span>`:tired?'<span class="tired">体力が足りない</span>'
    :(c>0?btnYen(c):c<0?'＋'+btnYen(-c):'無料')+(deal?'★':'')+(stv?` 体${stv>0?'+':''}${stv}`:'')+(ef?` <em class="ef e${n}">効果${ef.mark}</em>`:'')+(rk?` <em class="risk">⚠${rk}%</em>`:'');
  const l3=ef?(ef.why||''):(a.cat==='バイト'&&jobLv(G,a.id)?`昇給${jobLv(G,a.id)*5}%　`:'')+(a.desc||'');
  return `<button class="act ${cls} ${deal?'deal':''}" ${dis?'disabled':''} onclick="act('${a.id}')"><b>${label||a.name}${frHTML(friendsAt(G,a.id))}</b><span class="cost">${l2}</span>${l3?`<span class="desc">${l3}</span>`:''}</button>`;
}
const A=id=>ACTIONS.find(a=>a.id===id);
// 絞る版：練習は5つ。ショット練習は上達すると素振りから打ちっぱなしに変わる
function menuHTML(){
  if(menuCat!=='練習'||G.mode!=='simple')return ACTIONS.filter(a=>a.cat===menuCat&&!a.simple&&(a.id!=='clinic'||G.injury>0)).map(a=>actBtn(a)).join('');
  const shot=G.stats.power>=12?A('range'):A('swing');
  return actBtn(shot,shot.id==='swing'?'ショット(素振り)':'ショット(打ち込み)')+actBtn(A('mat'),'パター練習')+actBtn(A('komaza'))+actBtn(A('short'))+actBtn(A('round'))+actBtn(A('lesson'));
}
// これから必要なお金（大会・プロテストの費用と月謝）
function upcomingCosts(G,weeks){
  const items=[];let total=0;
  for(let w=G.week;w<=Math.min(TOTAL_WEEKS,G.week+weeks-1);w++){
    if(w>G.week&&w%4===1&&G.coach>0){items.push({w,name:COACHES[G.coach].name+'の月謝',cost:COACHES[G.coach].fee});}
    const e=evAt(G,w,1);if(e&&!(w===G.week&&G.half===1&&false))items.push({w,name:e.name,cost:e.cost,test:e.type==='test'});
  }
  for(const it of items)total+=it.cost;return {items,total};
}
function moneyPlanHTML(){
  const u=upcomingCosts(G,12),short=u.total-G.money;
  const y=Math.floor((G.week-1)/48)+1;
  const tests=[34,39,44].map(k=>evAt(G,(y-1)*48+k,1)).filter(e=>e&&e.type==='test');
  const testLine=tests.length?`<div class="tl">今年のプロテスト：最後まで受けると<b>計${yen(tests.reduce((a,e)=>a+e.cost,0))}</b>（${tests.map(e=>e.name.replace('プロテスト ','')+' '+shortYen(e.cost)).join('・')}）</div>`
    :`<div class="tl">プロテストは2年目から。最後まで受けると毎年<b>計${yen(230000)}</b>（1次予選6万・2次予選7万・最終10万）</div>`;
  return `<div class="plan"><div class="ph"><b>💰 これから12週で必要なお金</b><span class="${short>0?'bad':'ok'}">${yen(u.total)}${short>0?`（${yen(short)}不足）`:''}</span></div>
  ${u.items.length?`<div class="pi">${u.items.map(it=>`<span class="${it.test?'t':''}">${weekLabel(it.w).replace(/^\d年目 /,'')} ${it.name} ${shortYen(it.cost)}</span>`).join('')}</div>`:''}${testLine}</div>`;
}
function miniCalHTML(){
  let cells='';
  for(let i=0;i<8;i++){const w=G.week+i;if(w>TOTAL_WEEKS)break;const y=Math.floor((w-1)/48),ww=w-y*48,m=MONTHS[Math.floor((ww-1)/4)],k=(ww-1)%4+1;
    let bd='';for(const h of [0,1]){if(i===0&&h<G.half)continue;const e=evAt(G,w,h);if(e)bd+=`<i class="${e.type==='mp'?'amateur':e.type}">${e.type==='check'?'査定':e.type==='test'?'試験':e.type==='mp'?'対決':'大会'}</i>`;}
    cells+=`<div class="mc ${i===0?'cur':''}"><span>${k===1||i===0?m+'月':''}${k}週</span>${bd}</div>`;}
  const nc=nextEvent(G,'check'),u=upcomingCosts(G,12),short=u.total-G.money;
  return `<div class="minical" onclick="openCal()"><div class="mcrow">${cells}</div>
  <div class="mcnext">${nc?`<span class="nc">査定まで${nc.week-G.week}週：<b>${nc.target+1}切り</b></span>`:''}<span class="${short>0?'bad':''}">出費 ${shortYen(u.total)}${short>0?'（不足）':''}</span><span class="more">📅›</span></div></div>`;
}
function wxHTML(){if(!G.evWx)G.evWx=rollWeather(G,curEvent(G));const W=WX[G.evWx],rc=G.stats.recovery+(gearBonus(G).recovery||0);
  const d=W.pen?(rc>=100?'（リカバリーが高く、影響を受けない）':rc>=50?'（影響は小さめ）':'（リカバリーが低いと不利）'):'';
  return `<div class="wxf wx-${G.evWx}">天気予報：<b>${W.icon} ${W.name}</b>${W.pen?`<small>${d}</small>`:''}</div>`;}
function mainHTML(){
  fixSave(G);if(G.skillOffer&&!G.over){view='skillpick';return skillPickHTML();}
  const e=curEvent(G);const mod=MODS.find(m=>m.id===G.mod);
  const gb=gearBonus(G);
  const stc=G.stamina>=60?'ok':G.stamina>=30?'mid':'low';
  let body='';
  if(e){
    const el=eligible(G,e);
    if(e.type==='mp'){const nm=G.mk2?'早乙女markⅡ':'早乙女';body=`<div class="event"><div class="etag">マッチプレー</div><h2>${nm}との勝負</h2>${wxHTML()}<p>${nm}「今年も勝負だ。1ホールずつ、少ない打数のほうが勝ち。逃げるなよ」<br>勝てば特別な力が手に入る。負けると悔しさが残る（弱点「チャンス×」）</p><button class="big" onclick="enterEvent()">受けて立つ</button><button class="ghost" onclick="skipEvent()">断る</button></div>`;}
    else if(e.type==='check'){body=`<div class="event check"><div class="etag">査定</div><h2>${e.name}</h2>${wxHTML()}<p>目標：<b>${e.target+1}を切る</b>（${e.target}打以内）<br>届かなければ研修生をクビ＝ゲームオーバー</p>${G.stamina<30?'<p class="warn">体力が少なく、本来の力が出せないかも</p>':''}<button class="big" onclick="enterEvent()">査定に挑む</button></div>`;}
    else{
    body=`<div class="event"><div class="etag">${e.type==='test'?'プロテスト':'アマチュア大会'}</div><h2>${e.name}</h2>
    ${wxHTML()}<p>${e.field}人が出場${e.type==='test'?`／上位${e.pass}人が通過`:''}<br>参加費＋遠征費：<b>${yen(e.cost)}</b>${e.disc?'（後援会が半分負担）':''}${e.prize?`<br>賞金（商品券）：優勝 ${yen(e.prize[0])}・2位 ${yen(e.prize[1])}・3位 ${yen(e.prize[2])}`:''}</p>
    ${!el?`<p class="warn">前の段階を通過していないので出場できない</p><button class="big" onclick="skipEvent()">次へ</button>`:
      `<button class="big" ${G.money<e.cost?'disabled':''} onclick="enterEvent()">出場する</button>${G.money<e.cost?'<p class="warn">お金が足りない…</p>':''}<button class="ghost" onclick="skipEvent()">見送る</button>`}
    ${G.stamina<30?'<p class="warn">体力が少なく、本来の力が出せないかも</p>':''}</div>`;}
  }else{
    const cats=['練習','バイト','休む','おでかけ'];
    body=`<div class="tabs t4">${cats.map(c=>`<button class="${c===menuCat?'on':''}" onclick="menuCat='${c}';render()">${c}</button>`).join('')}</div><div class="acts ${((menuHTML().match(/<button/g)||[]).length)>6?'dense':''}" style="--rows:${Math.ceil(((menuHTML().match(/<button/g)||[]).length)/2)}">`+menuHTML()+`</div>`;
  }
  const stats=STAT_KEYS.map(k=>{const v=G.stats[k]+(gb[k]||0);return `<div class="cs"><small>${STAT_NAMES[k].slice(0,4)}</small><b class="${rankCls(v)}">${rankOf(v)}</b><span>${Math.floor(v)}</span></div>`;}).join('');
  const chips=`<span class="${G.coach?'':'warnc'}">コーチ:${G.coach?COACHES[G.coach].name:'なし'}</span><span class="dhint" onclick="showDetail=true;render()">👆能力の欄で仲間・特技</span><span onclick="quit()">タイトルへ</span>`;
  return `<div class="cm-main"><div class="top"><div class="wk">${weekLabel(G.week,G.half)}</div><button class="totitle" onclick="quit()">タイトルへ</button><div class="money">${yen(G.money)}</div></div>
  <div class="stam"><span>体力</span><div class="sbar ${stc}"><i style="width:${G.stamina}%"></i></div><span>${Math.round(G.stamina)}</span><span class="cond c${G.cond}">${COND[G.cond]}</span>${G.injury>0?`<span class="cond inj">🤕あと${Math.ceil(G.injury/2)}週</span>`:''}${Object.keys(G.bad||{}).some(k=>G.bad[k]>0)?`<span class="cond inj" onclick="showDetail=true;render()">💀弱点${Object.keys(G.bad).filter(k=>G.bad[k]>0).length}</span>`:''}</div>
  ${miniCalHTML()}
  ${stageHTML('idle',{rain:G.mod==='rain',wide:true,label:HALF_NAMES[G.half],label2:mod&&!e?mod.name+'：'+mod.desc:G.cont?'🏆 合格済み（'+weekLabel(G.endWeek).replace(/ 第.*/,'')+'末まで）':''})}
  <div class="cstats" onclick="showDetail=true;render()">${stats}</div>
  ${body}</div>${showDetail?detailHTML():''}`;
}
let showDetail=false;
// 特技の札（パワポケ風）。タップで効果を表示
function skCards(skills,lv,negs,bads,emptyMsg){
  const fs=FRIENDS.map(f=>f.skill),esc=t=>String(t).replace(/"/g,'&quot;');
  const c=[];
  for(const s of skills.filter(s=>GOLD[s]))c.push(['rainbow',s,(SKILLS[s]||'').replace('【金特】','')]);
  for(const s of skills.filter(s=>fs.includes(s)))c.push(['gold',skillLabel(s,lv),skillDesc(s,lv)]);
  for(const s of skills.filter(s=>!fs.includes(s)&&!GOLD[s]))c.push(['blue',s,SKILLS[s]||'']);
  for(const n of negs||[])c.push(['red',n,(NEGS[n]||'')+'（ずっと続く）']);
  for(const [k,t] of bads||[])c.push(['purple',BADS[k].name,`${BADS[k].desc}（あと約${Math.ceil(t/2)}週で消える）`,`${Math.ceil(t/2)}週`]);
  if(!c.length)return `<p class="dnone">${emptyMsg||'まだ特技はない'}</p>`;
  return `<div class="skbox" onclick="event.stopPropagation()"><div class="skgrid">${c.map(x=>`<button class="skc ${x[0]} ${/^ロングパット名人/.test(x[1])?'lp':''}" data-n="${esc(x[1])}" data-d="${esc(x[2])}" onclick="event.stopPropagation();showSk(this)">${x[1]}${x[3]?`<small>${x[3]}</small>`:''}</button>`).join('')}</div><div class="skdesc">特技をタップすると効果が出る</div></div>`;
}
function showSk(el){const box=el.closest('.skbox');box.querySelectorAll('.skc.on').forEach(b=>b.classList.remove('on'));el.classList.add('on');const d=box.querySelector('.skdesc');d.innerHTML='';const b=document.createElement('b');b.textContent=el.dataset.n+'：';d.appendChild(b);d.appendChild(document.createTextNode(el.dataset.d));}
function detailHTML(){
  const gb=gearBonus(G);
  const fr=FRIENDS.map(f=>{const b=G.bond[f.id]||0;const lv=b>=100?3:b>=65?2:b>=30?1:0,nx=[30,65,100][lv],full=b<100&&bestCount(G)>=BEST_MAX;return `<div class="dfr"><span class="dn">${f.icon} ${b?f.name:'？？？'}</span><div class="bb"><i style="width:${b}%"></i><u style="left:30%"></u><u style="left:65%"></u></div><span class="dv">${b}</span>${b?`<small>${f.role}。${lv>=3?'💞 親友':full&&lv>=2?'親友の枠がいっぱいなので、これ以上は深まらない':`絆${nx}で「${f.skill}（${LV_NAME[lv+1]}）」${lv===2?`（親友はあと${BEST_MAX-bestCount(G)}人）`:''}`}</small>`:'<small>まだ知り合っていない</small>'}</div>`;}).join('');
  const bads=Object.keys(G.bad||{}).filter(k=>G.bad[k]>0).map(k=>[k,G.bad[k]]);
  const sk=skCards(G.skills,G.skillLv,G.negs,bads);
  const st=STAT_KEYS.map(k=>{const v=G.stats[k]+(gb[k]||0);return `<div class="cs"><small>${STAT_NAMES[k]}</small><b class="${rankCls(v)}">${rankOf(v)}</b><span>${Math.floor(v)}</span></div>`;}).join('');
  return `<div class="dover" onclick="showDetail=false;retireAsk=false;render()"><div class="dpanel"><h3>能力</h3><div class="cstats dst">${st}</div><h3>コーチ</h3><div class="dsk"><b>${COACHES[G.coach].name}${G.coach?`（月謝 ${yen(COACHES[G.coach].fee)}）`:''}</b><small>${COACHES[G.coach].desc}${G.coach?'':'。コーチは「おでかけ」の「買い物・コーチ探し」で'}</small></div><h3>仲間との絆</h3>${fr}<h3>特技</h3>${sk}${G.cont?`<button class="big" onclick="event.stopPropagation();retire()">${retireAsk?'本当に終える？ もう一度押すとエンディングへ':'🏆 研修生を終えてプロになる（エンディングへ）'}</button>`:''}<div class="dclose">タップで閉じる</div></div></div>`;
}
// ---- カレンダー（見るだけ。日は進まない） ----
function openCal(){calYear=Math.min(3,Math.floor((G.week-1)/48)+1);view='cal';render();window.scrollTo(0,0);}
// 練習・バイトのボタン用：1万円以上は「1.2万円」のように短く書く
function btnYen(n){return n>=10000?(+(n/10000).toFixed(2))+'万円':shortYen(n);}
function shortYen(n){return n>=10000?(n%10000?Math.floor(n/10000)+'万'+(n%10000/1000)+'千円':(n/10000)+'万円'):(n/1000)+'千円';}
function calCell(w){
  const cur=w===G.week,past=w<G.week;let lines='';
  for(const h of [0,1]){
    const e=evAt(G,w,h);if(!e)continue;
    const rec=G.history.find(x=>x.week===w&&x.name===e.name);
    const done=past||(cur&&h<G.half);
    const tag=e.type==='check'?'査定':e.type==='test'?'プロ試験':e.type==='mp'?'対決':'大会';
    let sub=e.type==='check'?`${e.target+1}切り`:shortYen(e.cost);
    if(rec)sub=`${rec.score}打`+(rec.target!=null?(rec.score<=rec.target?' ○':' ×'):` ${rec.rank}位`);
    else if(done)sub='不参加';
    lines+=`<div class="ce ${e.type}"><b>${tag}</b><span>${sub}</span></div>`;
  }
  return `<div class="cc ${cur?'cur':''} ${past?'past':''}"><small>第${(w-1)%4+1}週</small>${lines}</div>`;
}
function calHTML(){
  const y=calYear,base=(y-1)*48;let rows='',list='';
  for(let m=0;m<12;m++){rows+=`<div class="cm">${MONTHS[m]}月</div>`;for(let k=1;k<=4;k++)rows+=calCell(base+m*4+k);}
  for(let w=base+1;w<=base+48;w++)for(const h of [0,1]){const e=evAt(G,w,h);if(!e)continue;
    const d=e.type==='check'?`目標 <b>${e.target+1}を切る</b>（届かないとクビ）`:`参加費＋遠征費 <b>${yen(e.cost)}</b>　${e.field}人出場`+(e.type==='test'?`・上位${e.pass}人が通過`:'');
    list+=`<div class="cl ${w<G.week?'past':''}"><span>${weekLabel(w,h).replace(/^\d年目 /,'')}</span><div><b>${e.name}</b><br>${d}</div></div>`;}
  const D=DIFFS[G.diff],c=COACHES[G.coach];
  return `<div class="top"><div class="wk">📅 カレンダー</div><div class="money">${yen(G.money)}</div></div>
  <button class="ghost backtop" onclick="view='main';render();window.scrollTo(0,0)">‹ 元の画面に戻る</button>
  <div class="tabs">${[1,2,3].map(n=>`<button class="${n===y?'on':''}" onclick="calYear=${n};render()">${n}年目</button>`).join('')}</div>
  ${moneyPlanHTML()}
  <div class="calgrid">${rows}</div>
  <p class="lead">黄色の枠が今週。毎月の第1週に、仕送り${D.monthly?`（＋${yen(D.monthly)}）`:'（なし）'}${G.coach?`と${c.name}の月謝（−${yen(c.fee)}）`:''}があります。<br>プロテストは毎年受けられます（1次予選→2次予選→最終）。</p>
  <div class="cat">${y}年目の予定</div>${list}
  <button class="big" onclick="view='main';render();window.scrollTo(0,0)">戻る</button>`;
}
// ---- 結果画面：上に絵、下に能力の変化と文章。確認したらいつもの画面へ ----
function snap(){return {stats:Object.assign({},G.stats),money:G.money,stamina:G.stamina,cond:G.cond,injury:G.injury||0};}
function showRes(kind,title,before,msgs,friends){
  resData={kind,title,before,msgs:msgs.slice(),friends:friends||[]};view='res';render();window.scrollTo(0,0);
}
function resNext(){resData=null;view=G.over?'ending':G.skillOffer?'skillpick':G.pending?'revent':'main';render();window.scrollTo(0,0);}
function resHTML(){
  const r=resData,b=r.before,gb=gearBonus(G);
  let n=0;
  const tiles=STAT_KEYS.map(k=>{const v=G.stats[k]+(gb[k]||0),d=b?G.stats[k]-b.stats[k]:0,ch=Math.abs(d)>=0.05;
    return `<div class="rs ${ch?(d>0?'up':'down'):''}" style="--d:${ch?(n++)*0.12:0}s"><small>${STAT_NAMES[k]}</small><b class="${rankCls(v)}">${rankOf(v)}</b><span>${Math.floor(v)}</span>${ch?`<i>${d>0?'+':'−'}${Math.abs(d).toFixed(1)}</i>`:''}</div>`;}).join('');
  let side='';
  if(b){
    const dm=G.money-b.money,ds=Math.round(G.stamina-b.stamina),dc=G.cond-b.cond;
    if(dm)side+=`<span class="${dm>0?'up':'down'}">所持金 ${dm>0?'＋':'−'}${Math.abs(dm).toLocaleString()}円</span>`;
    if(ds)side+=`<span class="${ds>0?'up':'down'}">体力 ${ds>0?'+':''}${ds}</span>`;
    if(dc)side+=`<span class="${dc>0?'up':'down'}">調子 ${dc>0?'↗':'↘'} ${COND[G.cond]}</span>`;
    if((G.injury||0)>0&&!b.injury)side+=`<span class="down">🤕 ケガ</span>`;
  }
  const all=r.msgs.join(' ');
  const banner=all.includes('プロテスト合格')?'':all.includes('大成功')?'<div class="banner crit">★ 大 成 功 ★</div>':all.includes('ケガをしてしまった')?'<div class="banner hurt">🤕 ケ ガ …</div>':all.includes('金特に進化')?'<div class="banner skill">🌟 金特に進化！ 🌟</div>':all.includes('ついてしまった…（')||all.includes('長引いてしまった')?'<div class="banner hurt">💀 弱 点 …</div>':all.includes('覚えるチャンス')?'<div class="banner skill">✨ 特技のチャンス！ ✨</div>':all.includes('特技「')?'<div class="banner skill">✨ 特技を習得！ ✨</div>':'';
  return `<div class="resv">${stageHTML(r.kind,{big:true,friends:r.friends})}
  ${banner}<h2 class="rt">${r.title||''}</h2>
  ${b?`<div class="rstats">${tiles}</div>`:''}${side?`<div class="rside">${side}</div>`:''}
  <div class="rmsg">${r.msgs.map((m,i)=>`<div style="animation-delay:${0.15+i*0.12}s">${m}</div>`).join('')}</div>
  <div class="tapnext">▼</div></div>`;
}
function quit(){view='title';render();window.scrollTo(0,0);}
// ---- 行動 → アニメーション → 結果 ----
function act(id){
  if(view!=='main')return;
  const a=ACTIONS.find(x=>x.id===id);if(!canDo(G,a))return;
  if(id==='shop'){G.shopOpen=true;G.shopBought=false;view='shop';save();render();window.scrollTo(0,0);return;}
  if(id==='range'&&!teeSkip){openTee();return;}
  lastActId=id;const before=snap();const frNow=friendsAt(G,id).slice();const m=doAction(G,id);let m2=advanceTurn(G);
  if(a.turns===2&&!G.over){const keep=G.pending;m2=m2.concat(advanceTurn(G));if(keep)G.pending=keep;}
  lastLog=m.concat(m2);roundPick=false;save();resData={kind:SCENE_OF[id]||(id==='clinic'?'rest':id),title:a.name,before,msgs:lastLog,friends:frNow};
  playAnim(SCENE_OF[id]||(id==='clinic'?'rest':id),frNow);
}
// ---- ティーショットのミニゲーム（打ちっぱなし用） ----
let tee=null,teeSkip=false,teeRaf=0;
const TEE_AIM={attack:{name:'ドライバーで攻める',sub:'一番飛ぶ。芯が狭い',w:0.6,d:12},normal:{name:'ドライバーで普通に',sub:'標準',w:1,d:0},safe:{name:'短いクラブで刻む',sub:'飛ばないが芯が広い',w:1.5,d:-30}};
const TEE_SHOTS=3;
function openTee(){tee={aim:'normal',shots:[],phase:'ready',t0:performance.now(),last:null};view='tee';render();window.scrollTo(0,0);}
function teeStats(){const gb=gearBonus(G),inj=G.injury>0?8:0;return {pw:Math.max(0,G.stats.power+(gb.power||0)-inj),ac:Math.max(0,G.stats.accuracy+(gb.accuracy||0)-inj)};}
// 帯の幅（中央からの片側の幅。バー全体の半分を1とする）。正確性で芯とまずまずが広がり、能力が低いと両端にチョロの帯が出る
function teeZones(){const s=teeStats(),A=TEE_AIM[tee.aim],cm=[0.8,0.9,1,1.08,1.15][G.cond]*(hasBad(G,'slump')?0.9:1);
  const w1=(0.03+s.ac*0.0022)*A.w*cm,w2=w1+(0.10+s.ac*0.002)*Math.min(1.2,A.w),w3=w2+0.25;
  const duff=Math.max(0,Math.min(0.32,(0.40-Math.min(s.pw,s.ac)*0.014)*0.8));
  return {w1:Math.min(w1,0.6),w2:Math.min(w2,0.8),w3:Math.min(w3,0.95),duff};}
function teePeriod(){return 1250*[0.85,0.93,1,1.06,1.12][G.cond]*(tee.aim==='attack'?0.9:tee.aim==='safe'?1.1:1);}
function teeX(now){const ph=(((now-tee.t0)/teePeriod())%1+1)%1;return ph<0.5?-1+4*ph:3-4*ph;}
function teeLoop(){if(view!=='tee'||!tee||tee.phase!=='ready')return;const n=document.getElementById('teeneedle');if(n)n.style.left=(50+teeX(performance.now())*50)+'%';teeRaf=requestAnimationFrame(teeLoop);}
function teeHit(){
  if(!tee||tee.phase!=='ready'||performance.now()-tee.t0<350)return;
  const x=teeX(performance.now()),ax=Math.abs(x),Z=teeZones(),s=teeStats(),A=TEE_AIM[tee.aim];
  const max=driveDist(s.pw)+A.d+[0,5,10,16][skLv({skills:G.skills,skillLv:G.skillLv},'飛ばし屋')];
  let kind,q,dist,side=0;
  if(ax>1-Z.duff){kind='チョロ…';q=0;dist=10+Math.random()*40;side=x*0.2;}
  else if(ax<=Z.w1){kind='芯を食った！';q=1;dist=max*(0.98+Math.random()*0.04);side=x*0.15;}
  else if(ax<=Z.w2){kind='まずまず';q=0.6;dist=max*(0.90+Math.random()*0.05);side=x*0.5;}
  else if(ax<=Z.w3){kind=x<0?'左に曲がった':'右に曲がった';q=0.25;dist=max*(0.82+Math.random()*0.06);side=x*1.0;}
  else{kind=x<0?'左へ大きく曲がってOB…':'右へ大きく曲がってOB…';q=0;dist=max*(0.75+Math.random()*0.08);side=x*1.6;}
  tee.last={x,kind,q,dist:Math.round(dist),side,aim:tee.aim};tee.shots.push(tee.last);tee.phase='shown';render();
}
function teeNext(){if(tee.shots.length>=TEE_SHOTS){tee.phase='done';}else{tee.phase='ready';tee.t0=performance.now();tee.last=null;}render();}
function teeBonus(){return tee.shots.length?1+0.2*tee.shots.reduce((a,s)=>a+s.q,0)/tee.shots.length:1;}
function teeFinish(skip){const b=skip?1:teeBonus();const msg=skip?null:`🏌️ ティーショット${TEE_SHOTS}球：${tee.shots.map(s=>s.dist+'ヤード').join('・')}（練習の伸び +${Math.round((b-1)*100)}%）`;
  tee=null;view='main';G.miniBonus=b;teeSkip=true;act('range');teeSkip=false;if(msg&&resData)resData.msgs.unshift(msg);}
function teeRangeSVG(){
  const W=320,H=130,yOf=d=>H-12-(d/300)*(H-24),xOf=s=>W/2+s*52;
  let g=`<rect width="${W}" height="${H}" fill="#2e6b3a"/><polygon points="${W/2-70},${yOf(0)} ${W/2+70},${yOf(0)} ${W/2+95},${yOf(300)} ${W/2-95},${yOf(300)}" fill="#3f8a4a"/>`;
  for(const d of [100,150,200,250,300])g+=`<line x1="${W/2-100}" x2="${W/2+100}" y1="${yOf(d)}" y2="${yOf(d)}" stroke="#cfe8cf" stroke-opacity=".45" stroke-dasharray="4 4"/><text x="${W/2+104}" y="${yOf(d)+4}" fill="#e6f2e6" font-size="10">${d}</text>`;
  g+=`<circle cx="${W/2}" cy="${yOf(0)}" r="4" fill="#fff"/>`;
  tee.shots.forEach((s,i)=>{const cx=Math.max(8,Math.min(W-8,xOf(s.side))),cy=yOf(Math.min(300,s.dist)),lastOne=i===tee.shots.length-1;
    g+=`<line x1="${W/2}" y1="${yOf(0)}" x2="${cx}" y2="${cy}" stroke="#fff" stroke-opacity="${lastOne?0.8:0.25}" stroke-width="${lastOne?2:1}"/><circle cx="${cx}" cy="${cy}" r="${lastOne?5:3.5}" fill="${s.q>=1?'#ffd84a':s.q>=0.6?'#9be37a':s.q>0?'#ffb35c':'#ff7a7a'}" stroke="#123" />`;});
  return `<svg viewBox="0 0 ${W} ${H}" class="teerange">${g}</svg>`;
}
function teeHTML(){
  const Z=teeZones(),s=teeStats(),n=tee.shots.length,L=tee.last,A=TEE_AIM[tee.aim];
  const band=(w,c)=>`<i class="${c}" style="left:${50-w*50}%;width:${w*100}%"></i>`;
  const bar=`<div class="teebar" onclick="teeHit()">${band(Z.w3,'z3')}${band(Z.w2,'z2')}${band(Z.w1,'z1')}${Z.duff>0?`<i class="zd" style="left:0;width:${Z.duff*50}%"></i><i class="zd" style="right:0;width:${Z.duff*50}%"></i>`:''}<u id="teeneedle" style="left:${L?50+L.x*50:50}%"></u></div>
  <div class="teeleg"><span class="l1">■芯</span><span class="l2">■まずまず</span><span class="l3">■曲がる</span><span class="l4">■OB</span>${Z.duff>0?'<span class="l5">■チョロ</span>':''}</div>`;
  let body;
  if(tee.phase==='done'){const b=teeBonus();body=`<div class="teeres"><b>${TEE_SHOTS}球の結果</b>${tee.shots.map((x,i)=>`<div>${i+1}球目：${x.kind}　${x.dist}ヤード</div>`).join('')}<div class="tb">練習の伸び <b>+${Math.round((b-1)*100)}%</b></div></div><button class="big" onclick="teeFinish(false)">練習の結果を見る</button>`;}
  else if(tee.phase==='shown'){body=`${bar}<div class="teeres"><b class="${L.q>=1?'q1':L.q>=0.6?'q2':L.q>0?'q3':'q0'}">${L.kind}</b><div>${L.dist}ヤード</div></div><button class="big" onclick="teeNext()">${n>=TEE_SHOTS?'結果を見る':'次の球へ（'+(n+1)+'球目）'}</button>`;}
  else{body=`<div class="teeaims">${Object.entries(TEE_AIM).map(([k,a])=>`<button class="${tee.aim===k?'on':''}" onclick="event.stopPropagation();tee.aim='${k}';render()"><b>${a.name}</b><span>${a.sub}</span></button>`).join('')}</div>
    <p class="teehint">芯なら約<b>${Math.round(driveDist(s.pw)+A.d)}ヤード</b>。針が中央に来たときにタップ！</p>${bar}
    <button class="big" onclick="teeHit()">打つ！（${n+1}球目／${TEE_SHOTS}球）</button>
    ${n===0?`<button class="ghost" onclick="teeFinish(true)">ミニゲームなしで練習する</button><button class="ghost" onclick="tee=null;view='main';render()">やめる（戻る）</button>`:''}`;}
  setTimeout(()=>{cancelAnimationFrame(teeRaf);teeLoop();},0);
  return `<div class="top"><div class="wk">🏌️ 打ちっぱなし</div><div class="money">${Math.min(n+(tee.phase==='ready'?1:0),TEE_SHOTS)}／${TEE_SHOTS}球</div></div>${teeRangeSVG()}${body}`;
}
// ---- 鳥よけショット（横スクロールの避けゲーム。お試し版） ----
let bird=null,birdRaf=0,birdHold=false;
const BIRD_LV={beginner:{name:'初心者',pw:25,ac:20,mt:20},middle:{name:'中級者',pw:55,ac:55,mt:55},expert:{name:'上級者',pw:85,ac:85,mt:85}};
const BW=160,BH=90,BGROUND=82,BX=34,BSPD=55;
function birdStatsOf(lv){
  if(lv&&BIRD_LV[lv])return BIRD_LV[lv];
  const gb=gearBonus(G),v=k=>Math.max(0,Math.min(100,G.stats[k]+(gb[k]||0)));
  return {name:'今の能力',pw:v('power'),ac:v('accuracy'),mt:v('mental')};
}
// どれか1つでも能力がSランクならスキップできる
function birdCanSkip(){const gb=gearBonus(G);return STAT_KEYS.some(k=>G.stats[k]+(gb[k]||0)>=80);}
// 本編から呼ぶ：ctx は 'crow'（カラスの襲撃）か 'match'（試合中の鳥の群れ）。終わると onEnd({ok,frac,graze,skipped}) を呼ぶ
function birdOpen(ctx,onEnd){bird={phase:'intro',ctx,onEnd,back:view};view='bird';render();window.scrollTo(0,0);}
function birdSkip(){const f=bird.onEnd,b=bird.back;bird=null;view=b;f({ok:true,frac:1,graze:0,skipped:true});}
function birdNext(){const B=bird,f=B.onEnd,b=B.back,r={ok:B.ok,frac:Math.min(1,B.t/B.T),graze:B.graze,skipped:false};bird=null;view=b;f(r);}
function birdStart(lv){
  const s=birdStatsOf(lv),prev=bird||{};
  bird={phase:'play',lv,s,ctx:prev.ctx||'trial',onEnd:prev.onEnd,back:prev.back,t:0,T:8+s.pw*0.1,y:40,vy:0,hp:2,inv:0,obs:[],next:1.2,graze:0,sparks:[],trail:[],last:performance.now(),max:Math.round(driveDist(s.pw)),
    acc:170+s.ac*3.5,vmax:60+s.ac*0.6,lead:0.3+s.mt*0.012,fall:null};
  birdHold=false;view='bird';render();window.scrollTo(0,0);
}
function birdSpawn(){
  const B=bird,x0=BW+8+B.lead*BSPD,r=Math.random(),late=B.t/B.T;
  if(r<0.30){const h=20+Math.random()*32;B.obs.push({k:'tree',x:x0,h,vx:0});}
  else if(r<0.62){const crow=Math.random()<0.3;B.obs.push({k:'bird',crow,x:x0,y0:14+Math.random()*50,amp:5+Math.random()*9,ph:Math.random()*6,vx:crow?55:25});}
  else if(r<0.82){const gap=10+Math.random()*44,gs=24-late*4;for(let y=6;y<BGROUND-6;y+=9){if(y>gap-2&&y<gap+gs)continue;B.obs.push({k:'bird',x:x0+Math.abs(y-40)*0.15,y0:y,amp:0,ph:0,vx:15,flock:true});}}
  else{B.obs.push({k:'balloon',x:x0,y0:22+Math.random()*36,amp:8,ph:Math.random()*6,vx:-12,col:['#e85a6a','#5aa8e8','#f2c94c'][Math.floor(Math.random()*3)]});}
  B.next=B.t+(1.25-late*0.4)*(0.75+Math.random()*0.5);
}
function birdObsY(o,t){return o.k==='tree'?BGROUND-o.h:o.y0+Math.sin(t*(o.k==='balloon'?2:4)+o.ph)*o.amp;}
function birdStep(dt){
  const B=bird;B.t+=dt;
  if(B.fall!=null){B.vy+=260*dt;B.y+=B.vy*dt;if(B.y>=BGROUND-2){B.y=BGROUND-2;B.fall+=dt;if(B.fall>0.7){birdEnd(false);return;}}return;}
  B.vy+=(birdHold?-B.acc:130*(B.t<1.5?0.1:1))*dt;B.vy=Math.max(-B.vmax,Math.min(62,B.vy));B.y+=B.vy*dt;
  if(B.y<3){B.y=3;B.vy=0;}
  if(B.y>=BGROUND-3){B.y=BGROUND-3;B.ground=true;B.dist=Math.round(B.max*Math.min(1,B.t/B.T));birdEnd(false);return;}
  if(B.inv>0)B.inv-=dt;
  if(B.t>=B.next&&B.t<B.T-1.2)birdSpawn();
  B.trail.push({x:BX,y:B.y});if(B.trail.length>14)B.trail.shift();for(const p of B.trail)p.x-=BSPD*dt*0.6;
  for(const o of B.obs){o.x-=(BSPD+o.vx)*dt;
    let d;const oy=birdObsY(o,B.t);
    if(o.k==='tree'){const dx=Math.max(o.x-7-BX,0,BX-(o.x+7)),dy=Math.max(oy-B.y,0);d=Math.hypot(dx,dy)-0.5;}
    else d=Math.hypot(o.x-BX,oy-B.y)-(o.k==='balloon'?4.5:3);
    if(d<1.5){if(B.inv<=0){B.hp--;B.inv=1.1;birdHUD();for(let i=0;i<8;i++)B.sparks.push({x:BX,y:B.y,vx:(Math.random()-0.5)*80,vy:(Math.random()-0.5)*80,l:0.4,c:'#ff6a5a'});
        if(B.hp<=0){B.fall=0;B.vy=-30;B.dist=Math.round(B.max*Math.min(1,B.t/B.T));return;}}}
    else if(d<6.5&&!o.gz&&B.inv<=0){o.gz=1;B.graze++;birdHUD();for(let i=0;i<4;i++)B.sparks.push({x:BX,y:B.y,vx:-20-Math.random()*40,vy:(Math.random()-0.5)*50,l:0.3,c:'#ffe9a8'});}
  }
  B.obs=B.obs.filter(o=>o.x>-20);
  for(const p of B.sparks){p.x+=p.vx*dt;p.y+=p.vy*dt;p.l-=dt;}B.sparks=B.sparks.filter(p=>p.l>0);
  if(B.t>=B.T){B.dist=B.max;birdEnd(true);}
}
function birdEnd(ok){cancelAnimationFrame(birdRaf);bird.phase='done';bird.ok=ok;const m=loadMeta();if(bird.graze>(m.gz||0)){m.gz=bird.graze;saveMeta(m);bird.newBest=true;}bird.best=Math.max(m.gz||0,bird.graze);render();}
function birdHUD(){const h=document.getElementById('birdhp');if(h)h.textContent='❤️'.repeat(Math.max(0,bird.hp))+'🖤'.repeat(2-Math.max(0,bird.hp));const g=document.getElementById('birdgz');if(g)g.textContent='かすり '+bird.graze;}
function birdDraw(){
  const c=document.getElementById('birdcv');if(!c)return;const x=c.getContext('2d'),B=bird,R=(col,a,b,w,h)=>{x.fillStyle=col;x.fillRect(Math.round(a),Math.round(b),Math.round(w),Math.round(h));};
  const sky=['#3a6ea8','#4a82ba','#5e98c8','#7ab0d6','#9ac6e0','#bcdcea'];sky.forEach((s,i)=>R(s,0,i*14,BW,14));
  const sc=B.t*BSPD;
  for(let i=0;i<4;i++){const cx=((i*70-sc*0.15)%(BW+60)+BW+60)%(BW+60)-30,cy=10+(i*17)%30;R('#eef6fa',cx,cy,16,4);R('#eef6fa',cx+3,cy-3,9,3);}
  for(let i=0;i<5;i++){const hx=((i*50-sc*0.4)%(BW+50)+BW+50)%(BW+50)-25;R('#4f8a5a',hx,BGROUND-8,30,8);R('#4f8a5a',hx+5,BGROUND-12,20,4);R('#4f8a5a',hx+10,BGROUND-15,10,3);}
  R('#3f7a3f',0,BGROUND,BW,BH-BGROUND);for(let i=0;i<12;i++){const gx=((i*16-sc)%(BW+16)+BW+16)%(BW+16)-8;R('#57984f',gx,BGROUND,6,2);R('#2f6232',gx+8,BGROUND+4,5,1);}
  for(const o of B.obs){const oy=birdObsY(o,B.t),ox=o.x;
    if(ox>BW+2){const wy=o.k==='tree'?BGROUND-o.h/2:oy;if(Math.floor(B.t*6)%2){R('#ff3b3b',BW-5,wy-4,3,6);R('#ff3b3b',BW-5,wy+3,3,2);}continue;}
    if(o.k==='tree'){R('#6b4a2a',ox-1.5,BGROUND-o.h*0.45,3,o.h*0.45);R('#2f6b35',ox-7,oy,14,o.h*0.6);R('#3f8a45',ox-5,oy-2,10,3);R('#255a2c',ox-7,oy+o.h*0.6-3,14,3);R('#4fa055',ox-4,oy+2,4,3);}
    else if(o.k==='bird'){const fl=Math.floor(B.t*8+ox)%2,col=o.crow?'#1c1c22':'#f4f1e6',dk=o.crow?'#000':'#b8b4a4';
      R(col,ox-3,oy-1,6,3);R(col,ox-5,oy-1,2,2);R('#f2a23c',ox-6,oy,1,1);R(dk,ox+3,oy,2,1);
      if(fl){R(col,ox-1,oy-4,3,3);R(dk,ox,oy-5,2,1);}else{R(col,ox-1,oy+2,3,3);R(dk,ox,oy+5,2,1);}
      R(o.crow?'#e33':'#111',ox-4,oy-1,1,1);}
    else{R(o.col,ox-3,oy-5,6,9);R(o.col,ox-4,oy-3,8,5);R('#fff',ox-2,oy-4,2,2);R('#ddd',ox,oy+4,1,6);}
  }
  for(const p of B.trail)R('rgba(255,255,255,.35)',p.x,p.y,1,1);
  for(const p of B.sparks)R(p.c,p.x,p.y,2,2);
  if(B.ctx==='crow'){if(!(B.inv>0&&Math.floor(B.t*14)%2)){R('#fff',BX-1,B.y-4,3,2);R('#fff',BX-2,B.y-2,5,2);R('#fff',BX-3,B.y,7,2);R('#fff',BX-4,B.y+2,9,2);R('#1c1c22',BX-2,B.y+1,5,3);R('#e9eef0',BX+2,B.y-1,1,1);}}
  else if(!(B.inv>0&&Math.floor(B.t*14)%2)){R('#fff',BX-2,B.y-2,5,5);R('#fff',BX-1,B.y-3,3,7);R('#fff',BX-3,B.y-1,7,3);R('#cfd6da',BX,B.y+1,2,2);R('#cfd6da',BX+2,B.y,1,1);}
  const pb=document.getElementById('birdpb');if(pb)pb.style.width=Math.min(100,B.t/B.T*100)+'%';
  const yd=document.getElementById('birdyd');if(yd)yd.textContent=Math.round(B.max*Math.min(1,B.t/B.T))+'ヤード';
}
function birdLoop(now){
  if(view!=='bird'||!bird||bird.phase!=='play')return;
  let dt=Math.min(0.05,(now-bird.last)/1000);bird.last=now;if(dt>0)birdStep(dt);
  if(bird&&bird.phase==='play'){birdDraw();birdRaf=requestAnimationFrame(birdLoop);}
}
function birdBind(){
  const el=document.getElementById('birdwrap');if(!el)return;
  const dn=e=>{e.preventDefault();birdHold=true;},up=e=>{e.preventDefault();birdHold=false;};
  el.addEventListener('pointerdown',dn);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',up);
  el.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});el.addEventListener('contextmenu',e=>e.preventDefault());
  bird.last=performance.now();cancelAnimationFrame(birdRaf);birdRaf=requestAnimationFrame(birdLoop);
}
document.addEventListener('keydown',e=>{if(view==='bird'&&e.code==='Space'){birdHold=true;e.preventDefault();}});
document.addEventListener('keyup',e=>{if(e.code==='Space')birdHold=false;});
function birdHTML(){
  const B=bird,trial=!B.ctx||B.ctx==='trial',back=`<button class="ghost" onclick="cancelAnimationFrame(birdRaf);bird=null;view='title';render()">タイトルへ</button>`;
  const what=B.ctx==='crow'?'おにぎり':'ボール';
  if(B.phase==='pick')return `<div class="top"><div class="wk">🐦 鳥よけショット</div><div class="money">お試し</div></div>
    <p class="lead">打ったボールを操って、鳥や木をよけよう。<br><b>画面を押している間は上がり、離すと下がる。</b><br>❤️は2個。2回当たるか、地面につくと終わり。ぎりぎりでよけると「かすり」が増える。</p>
    <p class="lead">能力を選ぶ（正確性＝動きの機敏さ、飛距離＝飛ぶ時間、メンタル＝予告の早さ）</p>
    ${Object.entries(BIRD_LV).map(([k,s])=>`<button class="act" onclick="birdStart('${k}')"><b>${s.name}</b><span class="desc">飛距離${s.pw}・正確性${s.ac}・メンタル${s.mt}</span></button>`).join('')}${back}`;
  if(B.phase==='intro')return `<div class="top"><div class="wk">${B.ctx==='crow'?'🍙 カラスの襲撃':'🐦 鳥の群れだ！'}</div><div class="money"></div></div>
    <div class="revent"><div class="ico">${B.ctx==='crow'?'🍙':'🐦'}</div><h2>${B.ctx==='crow'?'おにぎりを取り返せ！':'打球の先に鳥の群れ！'}</h2>
    <p>${B.ctx==='crow'?'カラスにさらわれたおにぎりを操って、群れをよけて逃げ切ろう。':'ボールを操って、鳥や木をよけよう。途中で落ちると、このホールは1打増える。'}<br><b>画面を押している間は上がり、離すと下がる。</b><br>❤️は2個。2回当たるか、地面につくと終わり。</p>
    <button class="big" onclick="birdStart()">始める</button>
    ${birdCanSkip()?`<button class="ghost" onclick="birdSkip()">スキップする（Sランクの余裕）</button>`:''}</div>`;
  if(B.phase==='done'){const gz=`<div class="tb">かすり ${B.graze}回${B.newBest?'（新記録！）':''}　最高記録 ${B.best}回</div>`;
    return `<div class="top"><div class="wk">${B.ctx==='crow'?'🍙 カラスの襲撃':'🐦 鳥よけショット'}</div><div class="money">${B.s.name}</div></div>
    <div class="teeres"><b class="${B.ok?'q1':'q0'}">${B.ok?'よけ切った！':B.ground?`${what}が地面に落ちた…`:`${what}が落とされた…`}</b><div>${B.ctx==='crow'?(B.ok?'最後まで逃げ切った':`全体の${Math.round(Math.min(1,B.t/B.T)*100)}%まで逃げた`):`${B.dist}ヤード${B.ok?'':`（最後まで飛べば${B.max}ヤード）`}`}</div>${gz}</div>
    ${trial?`<button class="big" onclick="birdStart('${B.lv}')">もう一度</button><button class="ghost" onclick="bird={phase:'pick'};render()">能力を変える</button>${back}`:`<button class="big" onclick="birdNext()">次へ</button>`}`;}
  setTimeout(birdBind,0);
  return `<div class="top"><div class="wk"><span id="birdhp">❤️❤️</span>　<span id="birdgz" class="bgz">かすり 0</span></div><div class="money" id="birdyd">0ヤード</div></div>
    <div class="birdbar"><i id="birdpb"></i></div>
    <div id="birdwrap" class="birdwrap"><canvas id="birdcv" width="${BW}" height="${BH}"></canvas><div class="birdpad">ここを押してもよい<br><b>押している間は上がる</b>・離すと下がる</div></div>`;
}
// ---- 殿堂入りツアー（1シーズン8試合。能力の変化はこのツアーの中だけ。記録は選手ごとの最高賞金のみ） ----
const TOUR_KEY='golfIkusei_tour',TOUR_LV=72;
const TOUR_INVITE=['J・スミス','M・ガルシア','K・アンダーソン','P・ラーセン','T・ウォン','R・シルバ','D・マクレガー','L・ベルナール'];
const TOUR_EVENTS=[{name:'開幕戦 さくらオープン',lv:0,pr:0.5,win:1500},{name:'新緑カップ',lv:1,pr:0.5,win:1500},{name:'梅雨明けクラシック',lv:2,pr:0.6,win:2000},{name:'真夏の選手権',lv:2,pr:0.6,win:2000},
  {name:'秋風オープン',lv:3,pr:0.6,win:2000},{name:'紅葉マスターズ',lv:4,pr:0.7,win:2500},{name:'日本オープン',lv:6,pr:0.8,win:4200,big:true},{name:'ツアー最終戦',lv:4,pr:0.8,win:3000,big:true}];
let T=null;
function loadTour(){try{return JSON.parse(lsGet(TOUR_KEY)||'null');}catch(e){return null;}}
function saveTour(){lsSet(TOUR_KEY,JSON.stringify(T));}
function tourKey(x){return [x.name,x.date,x.week].join('|');}
function tourIsOn(x){const s=loadTour();return !!(s&&s.key===tourKey(x));}
function tourPct(r){return r===1?1:r===2?0.5:r===3?0.34:r===4?0.24:r===5?0.2:r<=10?0.13:r<=20?0.07:r<=40?0.03:0;}
// 60人を3つの層に分ける：トップ10人（86前後）、中堅30人（80前後）、若手・新人19人（74前後。名前付きの14人はここ）。早乙女markⅡはトップ
// NPCの特技：雨男・晴れ男は付けない。能力と特技はシーズンの初めに決めて、シーズン中は変えない
const TOUR_SKPOOL=['飛ばし屋','ロングパット名人','バンカー巧者','ここ一番','寄せワン','パー5◎','ショートパット◎','アイアン巧者','OBなし','立ち上がり◎','上がり3ホール◎','勝負師','河童の末裔','風読み'];
const TOUR_GOLD=['一気通貫','小技の鬼','精密機械','天気の申し子'],TOUR_NEG=['ノミの心臓','スロースターター','ショートパット×','OB癖','終盤に弱い'];
const TIER_NAME={star:'スター選手',top:'トップ',mid:'中堅',new:'新人'};
function tourMakeProfile(base,tier){const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1)),pick=(a,n)=>a.filter(x=>SKILLS[x]||NEGS[x]).sort(()=>Math.random()-0.5).slice(0,n),st={};
  for(const k of ['power','accuracy','approach','putt','recovery'])st[k]=Math.round(base+ri(-6,6));st.mental=Math.round(base+ri(-8,8));
  let sk=[],ng=[];
  if(tier==='star'){sk=pick(TOUR_SKPOOL,ri(3,5));if(Math.random()<0.5)sk.push(pick(TOUR_GOLD,1)[0]);}
  else if(tier==='top'){sk=pick(TOUR_SKPOOL,ri(2,3));if(Math.random()<0.2)ng=pick(TOUR_NEG,1);}
  else if(tier==='mid'){sk=pick(TOUR_SKPOOL,ri(1,2));if(Math.random()<0.3)ng=pick(TOUR_NEG,1);}
  else{sk=pick(TOUR_SKPOOL,ri(0,1));if(Math.random()<0.4)ng=pick(TOUR_NEG,1);}
  const lv={};for(const x of sk)if(SKILL_LV[x])lv[x]=ri(1,2);return {stats:st,skills:sk.filter(Boolean),skillLv:lv,negs:ng};}
function tourEnsure(r){if(!r.p)r.p=tourMakeProfile(TOUR_LV+r.off,r.tier);return r.p;}
function tourNpcScore(r,ev,wx){const P=tourEnsure(r);
  const one=b=>{const f=Math.random()*4-2,p={stats:{},skills:P.skills,skillLv:P.skillLv,negs:P.negs};for(const k in P.stats)p.stats[k]=P.stats[k]+ev.lv+f+(b||0);return playRoundAuto(p,ev.pr,wx);};
  const n=r.nd&&NAMED.find(x=>x.name===r.name);
  if(n){if(n.steady)return Math.round((one()+one())/2);if(n.wild)return one()+Math.round(Math.random()*12-6);if(n.lucky&&Math.random()<0.15)return one(12);}
  return one();}
function tourRoster(){const nm=fieldNames(47),r=[],j=b=>b+(Math.random()*6-3)-TOUR_LV;
  for(let i=44;i<47;i++)r.push({name:nm[i],off:j(95),m:0,tier:'star'});
  for(let i=0;i<9;i++)r.push({name:nm[i],off:j(86),m:0,tier:'top'});
  r.push({name:'🤖早乙女markⅡ',off:j(86)+1,m:0,tier:'top'});
  for(let i=9;i<39;i++)r.push({name:nm[i],off:j(80),m:0,tier:'mid'});
  for(const n of NAMED)r.push({name:n.name,off:74+n.off*0.5-TOUR_LV-2,m:0,nd:1,tier:'new'});
  for(let i=39;i<41;i++)r.push({name:nm[i],off:j(74),m:0,tier:'new'});
  r.forEach(tourEnsure);T.roster=r;}
function tourGo(i){
  const x=loadHof()[i];if(!x)return;const s=loadTour();
  if(s&&s.key===tourKey(x))T=s;
  else{T={key:tourKey(x),name:x.name,base:Object.assign({},x.stats),stats:Object.assign({},x.stats),skills:x.skills||[],skillLv:x.skillLv||{},negs:x.negs||[],season:1,idx:0,money:0,res:[],phase:'home'};tourRoster();saveTour();}
  if(T.phase==='match')T.phase='home';
  (T.roster||[]).forEach(tourEnsure);
  view='tour';render();window.scrollTo(0,0);
}
function tourRank(){return 1+T.roster.filter(r=>r.m>T.money).length;}
// 賞金ランキング（招待選手は入らない）。同じ賞金なら同じ順位
function tourMoneyList(){const l=T.roster.map(r=>({name:r.name,m:r.m})).concat([{name:T.name,m:T.money,me:true}]);l.sort((a,b)=>b.m-a.m||(a.me?-1:b.me?1:0));l.forEach(x=>x.rank=1+l.filter(y=>y.m>x.m).length);return l;}
function tourLeadGap(){const l=tourMoneyList(),me=l.find(x=>x.me);return me.rank===1?0:l[0].m-T.money;}
function tourEnter(){
  const ev=TOUR_EVENTS[T.idx],mom=T.mom||0,st={};for(const k of STAT_KEYS)st[k]=Math.max(0,T.stats[k]+mom);
  match={e:{name:ev.name,pressure:ev.pr+(T.chased?0.25:0),type:'tour'},p:{stats:st,gear:{},skills:T.skills,skillLv:T.skillLv,negs:T.negs,bad:[],fatigue:0},hole:0,scores:[],lastLog:[],wx:rollWeather({skills:T.skills,negs:T.negs})};
  T.phase='match';render();window.scrollTo(0,0);
}
function tourHole(sk){playOne(sk);if(match.hole>=18)return tourFinish();render();}
function tourAuto(){while(match.hole<18)playOne('normal');tourFinish();}
function tourFinish(){
  const ev=TOUR_EVENTS[T.idx],lv=TOUR_LV+ev.lv,score=match.scores.reduce((a,b)=>a+b,0);
  const rows=T.roster.map(r=>({r,name:r.name,s:tourNpcScore(r,ev,match.wx)}));
  if(ev.big){const inv=TOUR_INVITE.slice().sort(()=>Math.random()-0.5).slice(0,4);for(const nm of inv){const rv=makeRival(95+(Math.random()*4-2));for(const k in rv.stats)rv.stats[k]=Math.round(rv.stats[k]);rows.push({name:'🌐'+nm+'（招待）',s:playRoundAuto(rv,ev.pr,match.wx),inv:rv.stats});}}
  rows.push({me:true,name:T.name,s:score});rows.sort((a,b)=>a.s-b.s||(a.me?-1:b.me?1:0));
  const prev={};for(const x of tourMoneyList())prev[x.me?'@me':x.name]=x.rank;
  let mine=null;rows.forEach((x,i)=>{x.rank=i+1;x.pz=Math.round(ev.win*tourPct(i+1));if(x.me)mine=x;else if(x.r)x.r.m+=x.pz;});
  // 勢い：−3〜+3。試合ごとに0へ半分戻ってから、順位の分だけ足す
  const d=mine.rank===1?1.5:mine.rank<=3?1:mine.rank<=10?0.5:mine.rank<=40?0:-0.5,m0=T.mom||0;
  T.mom=Math.max(-3,Math.min(3,Math.round((m0*0.5+d)*10)/10));const wasChased=!!T.chased;T.chased=mine.rank===1;
  T.money+=mine.pz;T.res.push({name:ev.name,score,rank:mine.rank,pz:mine.pz});
  const mi=mine.rank-1,show=new Set([0,1,2]);for(let i=mi-2;i<=mi+2;i++)if(i>=0&&i<rows.length)show.add(i);
  T.last={ev:ev.name,n:rows.length,wasChased,mom:T.mom,scores:match.scores.slice(),d,prev:T.idx?prev:null,rank:mine.rank,pz:mine.pz,score,rows:[...show].sort((a,b)=>a-b).map(i=>({rank:rows[i].rank,name:rows[i].name,s:rows[i].s,me:!!rows[i].me,pz:rows[i].pz,inv:rows[i].inv}))};
  T.idx++;T.phase='result';saveTour();render();window.scrollTo(0,0);
}
function tourNext(){
  if(T.phase==='result'){T.phase='rank';saveTour();render();window.scrollTo(0,0);return;}
  if(T.phase==='rank'&&T.idx>=TOUR_EVENTS.length){T.phase='podium';saveTour();render();window.scrollTo(0,0);return;}
  if(T.idx>=TOUR_EVENTS.length){T.phase='end';
    if(!T.recorded){T.recorded=true;const l=loadHof(),x=l.find(h=>tourKey(h)===T.key);if(x){T.newBest=T.money>(x.tourBest||0);if(T.newBest){x.tourBest=T.money;saveHof(l);}}}}
  else T.phase='home';
  saveTour();render();window.scrollTo(0,0);
}
function tourNextSeason(){T.season++;T.idx=0;T.money=0;T.res=[];T.mom=0;T.chased=false;T.recorded=false;T.newBest=false;T.last=null;for(const k of STAT_KEYS)T.stats[k]=Math.max(0,Math.round((T.stats[k]-1)*10)/10);tourRoster();T.phase='home';saveTour();render();window.scrollTo(0,0);}
function tourBack(end){if(end){lsDel(TOUR_KEY);}T=null;view='hof';render();window.scrollTo(0,0);}
function tourStatsHTML(){const mom=T.mom||0;return `${mom||T.chased?`<p class="tmom">${mom?`${mom>0?'📈':'📉'} 勢い ${mom>0?'+':''}${mom}（全能力に反映）`:''}${T.chased?'　🔥 追われる立場：次の試合は緊張が強い':''}</p>`:''}<div class="cstats">${STAT_KEYS.map(k=>{const v=T.stats[k],df=Math.round((v-T.base[k])*10)/10;return `<div class="cs"><small>${STAT_NAMES[k].slice(0,4)}</small><b class="${rankCls(v)}">${rankOf(v)}</b><span>${Math.floor(v)}</span>${df?`<em class="${df>0?'tup':'tdn'}">${df>0?'+':''}${df}</em>`:''}</div>`;}).join('')}</div>`;}
// 順位表の名前をタップすると、その選手の能力と特技を見られる
let tourPeekData=null;
function tourNameBtn(name,me,inv){const id=me?'@me':inv?'@inv:'+encodeURIComponent(JSON.stringify({n:name,s:inv})):encodeURIComponent(name);return `<span class="tname" onclick="tourPeek('${id}')">${name}</span>`;}
function tourPeek(id){let d;
  if(id==='@me')d={name:T.name+'（あなた）',tier:'殿堂入り',stats:T.stats,skills:T.skills,skillLv:T.skillLv,negs:T.negs,m:T.money};
  else if(id.startsWith('@inv:')){const o=JSON.parse(decodeURIComponent(id.slice(5)));d={name:o.n,tier:'海外からの招待選手',stats:o.s,skills:[],skillLv:{},negs:[],m:null};}
  else{const nm=decodeURIComponent(id),r=T.roster.find(x=>x.name===nm);if(!r)return;const P=tourEnsure(r);d={name:r.name,tier:TIER_NAME[r.tier]||'',stats:P.stats,skills:P.skills,skillLv:P.skillLv,negs:P.negs,m:r.m};}
  tourPeekData=d;render();}
function tourPeekHTML(){const d=tourPeekData;if(!d)return '';const man=n=>n.toLocaleString()+'万円';
  return `<div class="peekbg" onclick="tourPeekData=null;render()"><div class="peek" onclick="event.stopPropagation()"><button class="peekx" onclick="tourPeekData=null;render()">×</button>
  <div class="ph"><b>${d.name}</b><small>${d.tier}${d.m!=null?`　今シーズン ${man(d.m)}`:''}</small></div>
  <div class="cstats">${STAT_KEYS.map(k=>{const v=Math.round(d.stats[k]*10)/10;return `<div class="cs"><small>${STAT_NAMES[k].slice(0,4)}</small><b class="${rankCls(v)}">${rankOf(v)}</b><span>${Math.floor(v)}</span></div>`;}).join('')}</div>
  ${skCards(d.skills||[],d.skillLv||{},d.negs||[],[],'特技は持っていない')}</div></div>`;}
function tourHTML(){return tourHTML0()+tourPeekHTML();}
function tourHTML0(){
  const man=n=>n.toLocaleString()+'万円',n=TOUR_EVENTS.length;
  if(T.phase==='match'){const i=match.hole,[par,y]=COURSE[i]||[0,0],tot=match.scores.reduce((a,b)=>a+b,0),played=match.scores.length,pp=COURSE.slice(0,played).reduce((a,c)=>a+c[0],0);
    return `<div class="mhead"><div><div class="etag">${match.e.name}　${WX[match.wx].icon}${WX[match.wx].name}</div></div><div class="tot">${played?toPar(tot-pp):'±0'}<small>（${tot}打）</small></div></div>
    ${scorecard()}
    <div class="holeinfo"><span class="hn">${i+1}番</span>　パー${par}　${y}ヤード${i>=15?'<span class="pr">　終盤の重圧…</span>':''}</div>
    <div class="strat">
     <button class="s-atk" onclick="tourHole('attack')"><b>攻める</b><span>飛ばしてピンを狙う。曲がると大けが</span></button>
     <button class="s-nor" onclick="tourHole('normal')"><b>普通</b><span>いつも通り</span></button>
     <button class="s-safe" onclick="tourHole('safe')"><b>刻む</b><span>安全第一。そのぶん距離が残る</span></button>
    </div>
    <button class="ghost" onclick="tourAuto()">残りのホールをおまかせ（普通）</button>
    ${match.lastLog.length?`<div class="log hl">${match.lastLog.map(m=>`<div>${m}</div>`).join('')}</div>`:''}`;}
  if(T.phase==='result'){const L=T.last;let rows='',prev=0;
    for(const x of L.rows){if(x.rank>prev+1)rows+=`<tr class="gap"><td colspan="4">⋮</td></tr>`;rows+=`<tr class="${x.me?'me':''}"><td>${x.rank}位</td><td>${tourNameBtn(x.name,x.me,x.inv)}</td><td>${x.s}</td><td>${toPar(x.s-PAR)}</td></tr>`;prev=x.rank;}
    const sc=match&&match.e&&match.e.type==='tour'&&match.scores.length===18?scorecard():'';
    return `<div class="result ${L.rank===1?'win':''}"><h2>${L.ev} 結果</h2>${sc}
    <div class="board"><div class="bt">順位表（${L.n||60}人）</div><table>${rows}</table></div>
    <p>${L.rank===1?'🏆 <b>優勝！</b>':`${L.rank}位`}　スコア${L.score}（${toPar(L.score-PAR)}）</p>
    <p>${L.pz?`💰 賞金 <b>${man(L.pz)}</b>`:'予選落ち…賞金なし'}</p>
    <p>${L.mom!=null?`勢い ${L.mom>0?'+':''}${L.mom}（全ての能力に${L.mom>=0?'+':''}${L.mom}）`:(L.d>0?`全ての能力 +${L.d}`:'')}</p>
    ${L.rank===1?'<p>🔥 優勝したので、次の試合は<b>追われる立場</b>。いつもより緊張する</p>':''}
    <button class="big" onclick="tourNext()">次へ</button></div>`;}
  if(T.phase==='rank'){const l=tourMoneyList(),mi=l.findIndex(x=>x.me),pv=T.last&&T.last.prev,show=new Set([0,1,2,3,4]);for(let i=mi-2;i<=mi+2;i++)if(i>=0&&i<l.length)show.add(i);
    let rows='',prev=-1;for(const i of [...show].sort((a,b)=>a-b)){if(i>prev+1)rows+=`<tr class="gap"><td colspan="4">⋮</td></tr>`;const x=l[i],o=pv?pv[x.me?'@me':x.name]:null,mv=o==null?'—':o>x.rank?`<span class="good">↑${o-x.rank}</span>`:o<x.rank?`<span class="bad">↓${x.rank-o}</span>`:'→';
      rows+=`<tr class="${x.me?'me':''}"><td>${x.rank}位</td><td>${tourNameBtn(x.name,x.me)}</td><td>${man(x.m)}</td><td>${mv}</td></tr>`;prev=i;}
    const me=l[mi],po=pv?pv['@me']:null,up=me.rank===1&&po!==1,gap=T.idx===n-1&&me.rank>1?tourLeadGap():0;
    return `<div class="result"><h2>賞金ランキング</h2><p style="margin:0 0 6px">第${T.idx}戦 ${T.last?T.last.ev:''} 終了時点</p>
    ${up?'<div class="tb" style="font-size:17px;margin-bottom:6px">👑 賞金ランキング首位に浮上！</div>':''}
    <div class="board"><div class="bt">賞金ランキング（${l.length}人）</div><table>${rows}</table></div>
    ${gap?`<p>🔥 最終戦を前に、首位まであと <b>${man(gap)}</b></p>`:''}
    <button class="big" onclick="tourNext()">${T.idx>=n?'シーズン表彰へ':'次へ'}</button></div>`;}
  if(T.phase==='podium'){const l=tourMoneyList().slice(0,3),md=['🥇','🥈','🥉'];
    return `<div class="result win"><h2>🏆 ${T.season}年目 シーズン表彰</h2><p style="margin:0 0 8px">賞金ランキング上位3人</p>
    ${l.map((x,i)=>`<div class="podium p${i+1} ${x.me?'me':''}"><span class="md">${md[i]}</span><div><small>${i===0?'賞金王':`賞金ランキング${i+1}位`}</small><b>${x.name}${x.me?'（あなた）':''}</b></div><em>${man(x.m)}</em></div>`).join('')}
    ${l.some(x=>x.me)?'':`<p>あなた（${T.name}）は ${tourRank()}位　${man(T.money)}</p>`}
    <button class="big" onclick="tourNext()">次へ</button></div>`;}
  const list=TOUR_EVENTS.map((e,i)=>{const r=T.res[i];return `<div class="trow ${i===T.idx?'cur':''}"><span>第${i+1}戦</span><b>${e.name}</b><em>${r?`${r.rank}位　${r.pz?man(r.pz):'予選落ち'}`:`優勝 ${man(e.win)}`}</em></div>`;}).join('');
  if(T.phase==='end'){const rk=tourRank(),wins=T.res.filter(r=>r.rank===1).length;
    return `<div class="top"><div class="wk">🏌️ ツアー ${T.season}年目 終了</div><div class="money">${man(T.money)}</div></div>
    <div class="teeres"><b class="${rk===1?'q1':'q2'}">${rk===1?'👑 賞金王！':`賞金ランキング ${rk}位`}</b><div>${T.name}　獲得賞金 ${man(T.money)}　優勝${wins}回</div>${T.newBest?'<div class="tb">🎉 この選手の最高賞金記録を更新！</div>':''}</div>
    ${tourStatsHTML()}<div class="tlist">${list}</div>
    <button class="big" onclick="tourNextSeason()">次のシーズンへ（年齢で全能力 -1）</button>
    <button class="ghost" onclick="tourBack(true)">ツアーを終えて殿堂入りに戻る</button>`;}
  const ev=TOUR_EVENTS[T.idx];
  return `<div class="top"><div class="wk">🏌️ ツアー ${T.season}年目　第${T.idx+1}戦／${n}</div><div class="money">${man(T.money)}</div></div>
  <p class="lead" style="margin:2px 0 6px"><b>${T.name}</b>　賞金ランキング ${T.idx?tourRank()+'位':'—'}（60人）${T.idx===n-1&&tourRank()>1?`<br>🔥 最終戦を前に、首位まであと <b>${man(tourLeadGap())}</b>`:''}</p>
  ${tourStatsHTML()}<div class="tlist">${list}</div>
  <button class="big" onclick="tourEnter()">${ev.name}に出場する</button>
  <button class="ghost" onclick="tourBack(false)">殿堂入りに戻る（つづきはあとで）</button>
  <p class="lead" style="font-size:12px">10位以内で「勢い」がつき（最大+3）、予選落ちで下がる。勢いは試合ごとに半分ずつ0へ戻る。優勝した次の試合は追われる立場で緊張が強い。日本オープンと最終戦には、海外の強豪が招待される。能力の変化はこのツアーの中だけで、殿堂入りの記録は変わらない。</p>`;
}
// ---- コース攻略（上から見た地図で、狙う場所を決めて打つ。お試し版・1ホール） ----
let cs=null,csRaf=0,csBg=null,csGrid=null;
// コース（どちらもマスターの描いた地図をもとにした地形。o=コース外 t=林 r=ラフ f=フェアウェイ b=バンカー w=池 g=グリーン）
const CS_COURSES=[
  {name:'コース1',sub:'まっすぐなパー5・左に大きな池',W:48,H:166,ypp:3.42,pin:[22.5,17.2],tee:[27.3,150.1],par:5,yard:471,rle:'o120t2o32r2t3r1o7t5r3o26r2t6r3t9r2o26r1t7r3t9r2o25r1t9r3f1t7r1o25r1t8r4f3t7r1o24r1t7r6f2r1t7r1o22r1t8r6f1r4t6r1o21r1t7r13t5r2o20r1t6r15t4r3o19r1t6r10b4r4t1r3o18r2t6r5f3r2b4r9o17r2t6r4f1g3f2r1f4r1b1r6o17r1t7r4f1g5f1g4f1b2r6o16r1t7r4f1g11b2f2r4o16r1t7r4f1g11b3r6o15t8r4f1g11r1b1r8o14r1t6r5f1g9f2r10o14r1t6r6f1g8f1r12o13t8r6f5r16o13r1t8r27o12r1t9r4w2r2f2r16o12r1t9r3w11r12o13r1t9r2w12r12o12r1t9r1w12r13o12r1t9r1w12r2f4r8o11r2t8w13r2f5r7o12r1t7w14r2f6r6o12r2t5r1w14r1f7r7o12r2t4w14r2f7r7o12r1t1r1t3w14f1r1f7r4f1r2o14r2t2w15r1f7r7o16r2w15r2f5r1f2r5o15r3w14r1f1r1f6r8o14r2w15r3f5r1f1r7o13r3w16r2f5r6f1r2o13r2w18r2f5r5f1r2o12r3w18r2f5r8o12r2w20r1f6r7o12r2w20r2f5r7o12r2w20r2f6r6o11r3w20r2f6r6o11r3w20r1f7r6o11r2w20r2f7r1f1r4o10r3w19r2f7r8o9r3w17r3f8r8o9r2w12r2w1r3t1f10r8o8r3w12r6f11r8o8r2w13r4f13r8o8r2w13r4f12r8o9r2w13r4f12r8o9r2w14r3f12r8o9r2w14f1r2f11r9o10r2w12r1f2r1f11r9o11r17f7r1t1f1r10o10r7f1r10f7t3r5f1r1f1r2o8r2w8r10f9r7t1r3o7r2w11r8f9r11o6r2w19r1f9r6t2r3o3r3w21r2f7r1f1r5t2r3o3r2w23f8r7t3r2o3r2w23r1f7r6t4r2o3r2w23r1f7r5t5r2o3r2w23r1f7r5t5r2o3r2w23r2f6r5t5r2o3r2w23r2f6r6t4r2o3r1w24r2f7r5t4r2o3r1w24r2f7r3f1r1t4r3o2r1w24r2f7r4f1t4r3o2r1w24r2f7r3f1r1t4r3o2r1w23r1f9r5t4r2o3r1w23r3f7r5t4r3o2r1w23r1b2f7r4f1r1t4r2o2r1w23r1b1r1f7r6t4r2o2r2w21r2b1r1f7r7t3r3o1r2w21f1b3f7r7t3r3o1r3w20r1f1b1r1f6r6f1r1t4r2o3r2w19r1b2r1f6r8t4r3o3r2w17r2b2r1f6r1f1r6t4r3o4r3w16r2b1r1f8r7t4r2o6r2w15r1b3f6r1b2r7t3r2o7r4w12r1b3f5r2b2r8t2r2o7r7w1r5w2r3b1r1f5r2b3f1r6t1f1r2o7r12b1r7f5r2b2r8t1f1r2o7r12b5r3f5r3b2r11o7r13b3r4f5r2f1r1b1r11o7r20f5r9f1r6o7r2f1r16f6r14t2o6r3t1r11f3r2f6r13t3o6r1t4r15f7r12t3o6r1t7r11f8r12t3o6r1t11r7f8r12t3o6r1t12r4f10r11t4o6r1t12r2f1r2f10r9t5o6r1t13r4f11r7t6o6r2t13r3f11r3f1r3t6o7r1t14r2f11r7t6o7r1t14r2f11r7t6o7r2t14r1f11r7t6o7r3t14f11r7t6o7r3t14f11r7t6o8r3t12r1f11r6t7o8r4t11r2f11r1f1r3t7o9r3t11r2f9r1f1r2f1r2t7o9r2t12r2f13r2t7r1o9r2t12r2f9r3f1r2t6r2o10t13r2f9r6t5r3o10r1t12r2f8r7t5r3o10r1t12r2f8r7t5r2o11r2t12r1f8r7t5r2o12r1t11r2f7r7t5r3o12r1t10f1r2f7r3f1r2t6r2o13r2t9f1r2f7r5t7r2o13r2t9r3f7r5t6r2o14r3t9r1f8r1f2r2t6r2o15r3t8r1f8r2f1r2t5r3o15r3t8r2f7r4t5r4o15r2t9r2f7r5t4r3o16r2t9r2f7r5t4r3o16r1t10r2f7r5t4r2o17r2t10r1f8r1f1r2t3r3o17r2t9r2f7r3f1r1t3r3o17r2t9r2f7r5t2r3o18r2t9r2f7r4t3r3o18r2t9r2f7r9o19r2t9r2f7r6f1r2o20r1t9r2f6r6t1r3o20r1t9r2f6r10o20t10r2f5r10o21r1t9r3f3r11o21r1t9r2f1r11f1r2o21r1t9r14f1r2o21r1t8r3f1r4f2r5f1r2o21r1t8r8f2r5f1r2o21t8r16f1r2o21t7r17f1r2o21t7r17f1r2o21t8r19o20r2t7r14f1r4o20r2t8r9f1r7o21r2t9r4f1r11o21r2t9f3r1f2r10o21r2t9r13f1r2o21r2t8r14f1r2o21r2t8r2f6r6f1r2o21r2t9r1f6r9o22r1t9f7r9o22r1t9f2r13o23r2t8r3f4r3f1r4o23r2t9r2f4r3f1r4o23r2t8r3f4r3f2r3o23r1t9r4f3r8o24t10r3f3r8o24r1t10r2f3r7o25r1t10r3f2r7o25r2t9r12o26r2t9r3f1r1f2r3o27r3t8r10o28r2t8r10o28r3t7r9o30r2t7r8o32r2t6r6o35r1t6r1o44t1o24'},
  {name:'コース2',sub:'左に曲がるパー4・手前に池',W:90,H:166,ypp:2.31,pin:[17,16],tee:[21,152],par:4,yard:386,rle:'o19r1t15r1o72r2t16o72r2t18r1o69r2t19r1o64r6t21r2o57r10t22r1o55r16t19r2o52r18t20r1o49r21t21o48r6f1r3f3r5f2r2t21r3o43r8f8r8t21r2o42r10f8r7t21r3o41r8f3g5f3r8t19r3o40r9f2g7f3r8t19r2o40r9f2g8f2r10t18r1o39r6f1r3f2g9f2r1f1r1b2r5t20r2o35r10f2g9f2r3b3r5t19r3o34r9f3g9f2r3b3r6t19r2o33r11f2g8f4r2b4r7t18r1o33r7f1r3f3g7f4r3b3r9t1r3t12r3o31r12f3g5f5r3b3r13t12r3o31r13f14r2b2r14t12r2o31r13b1f14r2b1r14t12r2o31r12b3f3g4f6r18t10f1r2o31r12b3f1g7f7r18t8f1r2o31r12b3f1g8f8r17t7r3o31r12b2f2g8f16r9t1r2t2r7o29r13b1f2g9f17r20o28r14f2g9f18r6f1r13o27r14f2g8f20r20o4t1o21r14f4g5f21r14f3r5t6r3o15r14f31r21t6r3o16r14f32r18t8r3o15r16f31r7f2r8t8r2o16r23f27r14t9r2o16r15f2r7f27r2f2r3f1r2f1r2t10o16r23f1r1f27r12t12r3o12r25f28r10t13r2o12r3f2r7f1r13f27r11t13r1o12r8f2r17f27r10t13r3o11r2f4t4r1f2r11f30r8f1r1t13r2o11r2f1r2t6f3r11f1r1f28r9t14r2o10r5t9f1r4f1r8f28r8t14r2o10r4t11r12f29r8t15r3o9r3f1t11r12f29r7t15r3o10r3t20r2f1r1f31r3t16f1r3o9r3t20r5f30r1f1r2t16r3o11t1r1t20r6f26r7t15f1r2o12r3t23r2f26r6f1t3r2t10r2o13r3t25f1r3f21r2f1r9t10r3o14r5t22r9f16r12f1r1t8r3o14r4t22r1f1r10f13r15t8r2o16r2t22r14f12r15t7r2o18t23r1f1r8b3r1f12r14t7r3o19t22r1f1r6b4r1f13r13t7r3o20t21r2f1r5b5r1f13r12t8r2o22r3t17r7b5r1f14r1f1r1f2r2f1r3t8r2o25t17r3f1r3b5r2f15r2f2r1f1r3t8r2o28t15r8b2r3f16r8t9r1o30r2t13r12f16r7t10o31r1t14r12f17r6t9o32r1t12r9f1r3f17r6t9o33r2t10r11b1r2f17r6t8o34r2t10r9b3r2f17r5t8o35r1t11r7b4r2f17r5t8o35r2t10r6f1b4r2f17r5t8o36r1t11r6b4r2f17r4f1t8o36r1t12r6b3r2f17r4t9o37r1t12r6b1r2f18r4t9o37r1t12r9f18r4t9o37r1t12r10f16r4t10o38r1t11r9f17r4t10o38r1t11r9f17r4t10o38r1t11r9f17r4t10o38r1t11r5f21r4t10o38r1t11r9f17r1f2t11o38r1t11r8f18r3t11o39t12r3f1r3f18r1f1r1t11o39t13r6f18r3t11o39t13r6f18r3t11o38r1t13r6f18r3t11o38r1t12r6f19r3t11o38r2t11r7f18r3t11o38r2t12r6f18r2f1t10r1o38r2t11r7f18r3t10r1o38r1t11r8f17r1f1r2t10r1o38r1t10r9f19r2t10r1o38r1t9r3f1r1f1r4f19r1t10r2o37r1t9r12f18r1t10r2o37r1t9r12f15r2f1r2t9r2o37r1t9r12f15r5t9r2o37r1t8r13f14r6t9r2o36r2t8r4f1r8f14r6t8r3o36r2t7r14f15r5t9r2o36r2t7r14f15r6t8r2o36r1t8r14f13r9t7r2o35r2t8f1r13f13r1f2r6t6r3o35r1t10r12f13r9t7r3o34r2t10r12f13r7t9r2o35r2t10r7f3r2f13r6t10r2o35r1t11r7f3r2f12r7t10r2o35r1t12r5f4r2f12r6t10r3o34r2t12r5f4r1f13r5t11r3o34r1t12r4f1r2f2r1f13r5t12r2o34r1t13r10f13r4t13r2o33r1t14r9f13r5t12r2o33r1t15r9f13r4t13r2o32r1t13r11f13r6t11r3o32r1t12r10f15r5t11r4o31r1t13r11f13r7t10r3o31r2t13r11f12r8t10r3o31r1t13f1r11f12r2f1r5t10r2o32r1t8r1t4r12f11r9t9r3o32r1t8r4f2r5f1r5f10r3f1r5t9r3o32r1t11r3f2r10f9r10t9r3o31r2t8f1t1r3f1r3f1r8f8r6f2r3t8r3o32r2t7r7f1r5f1r2f1r1f1r2f5r8f1r4t7r3o32r2t4r14f2r19f2r5t6r3o33r2t2r12f1r12f1r18t5r3o33r23f1r1f1r7f1r15t5r3o31r3w1r5f1r11f1r30t4r2o30r3w4r5f1r23f1r18t1o33r3w5r4f1r30f2r10o34r3w7r34w2r1f1r7o35r2w8r32w6r5o36r3w8t1r20f3r7w8r2o37r3w8r9f3r5f2r5f1r6w9r3o36r2w9r10f2r5f3r10w9r3o36r3w8r17f4r7w12r3o36r2w8r18f4r6w12r3o36r3w8r16f1r2f2r5w13r3o36r3w9r10f1r2f1r6f1r3f1w13r2o38r3w8r10f2r10f1r2w13r3o38r2w9r8f6r10w13r3o38r3w9r10f2r9f2r1w12r2o40r2w10r2f1r7f2r12w10r3o40r3w9f2r7f1r15w9r3o41r3w8r9f3r15w6r3o43r3w8r9f3r15o2w3o1r2o44r3w7r10f3r14o54r3w5r12f1r14o54r35o55r13f1r2f1r17o56r15f1r17o56r33o57r32o57r11f2r7f1r4f1r7o57r32o58r2f1r28o59r2f1r27o60r2f1r5f1r21o60r2f1r13f1r1f1r10o61r2f1r16f1r1f1r6o62r2f1r9f2r7f2r4o63r2f7r2f4r3f4r4o64r2f1r8f4r3f3r4o65r2f1r3f2r3f4r9o66r9f5r9o67r22o69r20o70r19o72r16o76r12o335'},
  {name:'コース3',sub:'S字のパー5・真ん中を小川が流れる',W:76,H:166,ypp:3.33,pin:[17.8,21],tee:[16,152.5],par:5,yard:473,rle:'o12t14r2o58r2t6r1t6r3o57r2t6r2t8r2o55r4t15r3o53r6t1r1t12r3o52r10t9r1t2r3o50r11t8r2t3r2o50r14t10r1o51r2f1r12t10o51r2f1r12t10r2o49r2f1r13t10r2o48r2f1r13t10r2o48r2f1r13t10r1o49r17t9r1o49r17t10r2o46r12g3r3t10r3o45r10g6r2t6r1t4r2o44r3f1r6g8r2t4r2t5r2o42r11g8r1t13r2o40r12g8r1t14r2o39r13g7r1t15r3o36r14g8r2w2t12r2o36r3f1r10g7r3w2t13r2o35f3r8b3g7r3w2t14r1o35f3r9b3g6r2w3t14r2o34f3r8b4g6r2w3t15r1o34f2r8b6g5r2w3t16r1o33b2r9b4f2g3r2w3r4t2r2t8r2o33b2r12f5r3w3r8t8r3o32b2r12f4r4w3r9t5r1t2r3o31f2r11f5r3w4r12t1r2t3r2o31f2r11f6r2w3r13t1r1t4r2o31f3t1r3b4r2f6r2w3r3f5r5t6r2o31f1t2f1r3b4r2f6r2w3r1f8r4t7r1o31f1t2f1r4b3r2f6r2w3r2f8r4t7r1o30f1t1r2f1r4b2r2f6r2w3r2f9r3t7r1o30f2r1f3r2b4r2f5r2w3r2f9r3t7r2o29r5f1r2b3r3f6r1w2r3f9r4t7r1o29r6f1r2b1r4f6r1w2r3f10r3t9r2o27r4t1f1r7f5r2w2r3f10r3t9r2o28r3t2f1r8f3r2w2r3f10r4t9r2o27r6f1r12w2r4f10r3t10r1o28r6f1r11w3r3f10r4t10r1o28r6f1r10w2r3f11r4t11r1o27r7f1r8w3r3f11r4t12o28r7f1r7w3r3f12r4t12o28r7f1r5w4r3f12r3t13r1o27r4t2r1f1r3t3w3r3f12r3t13r2o27r3t2r4t4w3r3f13r4t12r2o27r3t2r3t4w3r4f12r5t12r2o27r2t2r5t4r6f12r4t12r2o29t2r4t6r5f12r4t12r2o30r4f1t7r4f13r4t12r2o29r5t7r4f13r5t4r2t1r2t3r1o30r4t7r4f13r5t4r1t1r2t5r2o30r2t6w2r4f13r4t6r2t6r1o30r3t7r2f1r1f13r4t15o31r2t9f2r1f12r5t16o30r2t11r2f11r5t16o30r2t12r2f10r4t17o29r2t13r2f9r4t17o30r2t13r2f10r4t16o1r2o26r2t14r3f9r3t18r1o27r2t13r7f5r2f1t18r2o27r2t12r9f7t1r2t14r2o28r3t11r9f8r3t13r2o28r3t9r11f7r5t3r1t7r2o29r2t10r10f6r7t1r2t7r3o29r2t11r8f7r8t9r3o29r2t10w1r7f7r7t11r3o29r2t9w2r6f7r7t7r1t4r2o29r2t10w1r6f7r8t5r2t5r2o29r2t9w1r5f7r1f1r7t12r3o28r3t8w2r4f7r8t14r2o29r2t9w2r3f7r9t12f3o30r2t7w3r3f7r10t4r1t7f2o30r2t7w4r2f7r3b1r6t12f2o31r2t6w3r3f7r2b3r5t12f2o31r2t6w4r2f7r2b3r5t13f1o32r2t5w4r2f8r1b3r2b1r4t7r2t3o32r2t6w3r2f8r5b4r3t6r2t3o32r2t7w2r2f9r4b3r5t10o32r2t6w3r3f10r10t10o33r2t5w3r3f11r10t2r1t6o33r2t4w4r4f11r9t1r2t6o33r2t4w4r4f11r9t9o33r2t4w3r6f11r7t4r2t4o32r4t3w3r6f11r1f1r5t5r1t4o32r5t2w3r6f13r5t9f1o32r2f1t4w3r6f13r5t9f1o32r2t5w2r7f13r5t8f2o32r2t5w2r7f13r5t8f2o31r3t4w4r6f12r6t3r2t3f2o31r2t4w5r5f12r5t3r4t3f1r1o31r2t4w5r4f13r5t3r2t5f1r1o31r2t3w5r5f10r1f1r6t3r1t6f1r1o31r2t3w5r4f9r9t11r2o31r2t3w6r3f6r12t11r2o31r1t3r2w5r2f7r12t11r2o30r2t3r2w5r2f6r13t10r3o30r2t3r2w5r1f6r14t11r2o30r2t4r1w6f6r15t10r2o30r2t3r2w6f5r15t11r2o30r2t3r2w6f5r15t10r2o31r2t3r4w5f3r16t9f1r2o31r2t3r4w5r19t9r3o32r2t2r5w4r19t9r3o32r2t2r5w4r19t8r3o32r2t3r5w4r18t9r3o32r1t3r6w5r8f1r8t9r2o32r2t3r7w5r5f4r7t8r3o32r2t3r7w6r4f4r6t9r3o32r2f1r10w6r3f3r7t9r2o33r2f1r11w6r2f3r7t8r3o33r14w7r10t9r2o34r14w8t2r7t9r2o33r16w7t3r6t8r3o33r17w7t3r4t9r2o33r21t2w3t2r4t9r2o33r22t2w1t2r4t3r1t6r2o33r23t4r4t1r2t7r2o32r25t9r1t7r2o32r25t17r2o32r24t17r3o32r24t17r2o32r15f4r5t15f2r3o31r15f5r2t17r6o31r14f5t1r1t16r7o31r15f4t17f1r5o33t1r16f2t17f1r5o32r1t3r16t14f2r6o33r2t4r9f3r2t14f1r7o33r2t6r7f5r1t13r6o36r2t6r6f4r4t10r6o37r2t5r10f2r2t10r5o39r2t7r9f2r1t8r7o40r2t7r12t7r7o40r3t8r10t6f1r5o43r2t7r10t6f2r4o44r3t5r7f3r1t6f2r4o45r1t7r3f7t6f1r5o45r2t7r3f7t4f2r5o46r2t6r4f6r2t3f1r4o48t8r1f7r1t1r1t3f1r4o46r2t9f6r3t4f1r4o47r2t7r2f7r2t3f2r3o48r2t7r2f6r2t3f2r3o49r2t6r5f3r2t3f2r4o48r3t5r11t2f3r3o49r2t5r11t3f2r3o49r3t2r14t3r5o49r3t2r3f2r9t2r5o50r2f1t2r3f4r7t2r4o51r2f1t2r3f5r5t2r1f1r3o51r2f1t1r4f5r4t2r5o52r2t2r5f3r4t3r5o51r3t4r10t2f1r4o52r3t4r10t2f2r3o53r3t3r12f1r3o55r3t3r15o55r3t3r9f1r4o57r3t2r4t2r3f1r4o58r3t2r3t2r7o59r3t8r5o61r3t5r6o63r2t4r3o54'},
  {name:'コース4',sub:'まっすぐなパー5・左に長い小川と池',W:45,H:166,ypp:3.62,pin:[16.6,14.1],tee:[18.3,151.9],par:5,yard:501,rle:'o12w7t3o32w9t4r3o25w13t4r3o22r2w13t2r2t1r5o3r3o13r2w13r1t3r14o11r2w13r3t1r5t2r11o8r3t1w10r10t3f2r8o8f2t3w8t2r10t2r11o7f1t4w5r1t3r12t1r11o7t5w3r2t3r22f1r2o7t5w2r2t3r4g4r14f2r3o6t5w2r2t2r4g5r15f1r3o6t5w5r5g6r15f1r2o6t4w8r2g7r14f2r3o5f1t3w8r1g7r1b3r12f1r4o4f1t3w8r1g7r1b2r13t3r1o5f1t3w8r1g8r15t5o4f2t2w8r1g8b4r13t4r2o1r2t3w8r1g6b5r7t2r3t5r5t4w8r2g1f3b5r7t2r3t5r3o1r2t3w9r2f4b4r10t8f1r1o1r2t4w10r1f4b3r10t8f1r1o2r2t4w10f5r12t7f2r1o2r2t4w11f4r12t7f3o2r2t4w11f5r11t10o2r2f1t3w11f5r10t11o2r2f1t3w11f5r13t8o2r2f1t3w11r1f4r13t7f1o2r3t4w10r1f4r13t8o2r3t4w9r2f5r14t6o3r2t4w8r2f7r12t7o3r2t4w8r2f7r11t8o3r2t4w8r1f8r11t8o3r2t5w7r1f8r10t9o4r2t4w7r1f7r11t9o4r2t5w5r2f7r11t9o4r2t5w4r3f7r11t9o5r2t4w4r3f6r2b3r8t8o5r2t6w2r4f5r2b3r8t8o5r2t7w1r4f6b4r9t7o5r2t7w1r4f6b4r9t7o6r2t6w1r4f6r2b4r8t6o6r2t5w3r3f7r1b4r7t7o7r2t5w3r1f10b3r8t6o8r2t4w3r1f11r9t7o9r1t4w2r2f11r8t8o9r2t3w2r2f12r7t8o9r2t3w2r3f12r6t1r1t6o10r2t2w2r3f12r8t6o10r2t2w3r3f11r6t8o10r2t2w3r5f9r6t7f1o11r2t2w3r4f9r5t8f1o11r3t3w2r4f8r5t7f2o12r2t3w4r3f7r5t8f1o13r2t2w5r2f7r4t8f2o13r2t3w4r2f7r4t8f2o13r2t3w4r2f6r5t9f1o13r2t3w5r1f5r6t9f1o14r1t3w4r2f5r6t9f1o14r2t2w4r1f6r7t8f1o14r2t1w4r2f6r6t9f1o13r3t2w2r3f6r6t9f1o13r3t2w2r3f6r6t9f1o13r4w3r3f6r7t8f1o13r4w2r4f6r6t9f1o13r4w2r4f6r7t8f1o12r5w3r3f6r7t7f2o12r5w4r2f7r5t8f2o12r6w4r1f8r5t7r2o11r8w4r1f8r3t7r3o11r9w4r1f7r2t8r2o12r11w3r2f4r3t8r2o12r12w3r1f4r3t7r2o12r14w4r6t7r2o12r10f3r2w4r5t6r2o13r2f1r6f4r3w4r4t5r2o14r2f1r6f9w3r3t5r2o14r9f10w2r2t6r2o14r9f10w3r1t6r2o14r10f9r1w3t1r2t3r2o14r10f9r2w1t2r2t3r3o13r10f9r3t7r3o13r9f9r3w2t6f1r2o13r9f10r2w2t7r2o12r10f9r3w2t6r3o12r10f9r3w1t7r2o13r10f8r4w1t7r2o13r10f8r4w1t7r2o13r10f9r2w2t7r2o12r11f9r2w2t7r2o12r10f9r1f1r1w2t6r3o12r10f10r1w2t7r3o12r2f1r7f10r1w2t7r2o13r2f1r1t2r4f10w2t7f1r2o13r2f1t3r4f10w2t2r2t3f1r2o13r2t3r5f10w2t2r1t4r3o13r2t3r5f9r1w1t8r3o13r2t3r4f9r2w2t7r2o14r2t3r4f7r1f1r1w3t6r3o14r2t3r4f7r3w2t7r3o14r2t3r4f7r3w2t7r2o15r2t2r5f9r1w2t6r3o15r2t4r3f9r1w2t6r2o17r1t4r3f9r1w1t7r3o16r2t2r4f8r1w2t7r2o17r2t3r3f5r4w2t7r2o17r2t3r3f4r5w1t8r3o16r2f1t1r4f5r3w2t8r3o16r2t3r3f8w2t8r2o17r2t3r3f6r1f1w2t8r3o17r1t2r4f8w2t8r3o17r2t2r3f6r1f1w1t9f1r2o17r2t2r3f5r3w2t2r1t6r2o17r2t2r3f4r4w2t2r1t6r3o16r2t3r3f3r4w3r2t6r2o17r2f1t2r11w2t8r2o17r2t3r11w2t8r2o17r2t2r12w2t8r2o17r2t3r12w2t7r2o17r2t2r13w2t6f1r2o17r3t3r11w2t7r2o18r2t3r11w2t6r3o18r2t2r12w2t6r3o18r2t1r13w2t6r2o19r2f1r12w3t6r2o19r15w2t7r2o19r2t1r11w2r2t5r3o19r2t2r2f1r1f2r4w2r1t6r2o19r3t2r1f5r4w2t7r2o19r3t2r1f5r3w2t8r2o19r2f1t2r4f1r5t9r2o19r2t3r9t5r1t4r2o19r2t3r8w1t5r2t3r2o19r2t3r8w1t10r2o19r2t3f5r2w2t10r2o19r1t4f5r2w2t10r2o18r2t3r4f1r3w2t9f1r2o18r2t3r8w2t10r2o18r2t3r8w2t10r2o18r2t3f4r4w2t10r2o18r1t3f6r3w2t10r2o17r3t1f1r2f4r4w2t9r2o17r2t1f2r11w2t7r3o17r2t2r2f1r9w3t6r3o17r2t2r1f4r9w4t3r2o18r2t2r2f4r10w2t3r2o18r3t2r1f3r12t4r3o18r2t1r17t5r2o18r2t3r2f2r9t6f1r2o19r1t3r2f3r7t7r3o19r2t3r1f3r7t7r3o19r3t3f3r6t8r2o21r2t4f2r3f2r1t8r2o21r2t4r5f2r1t7r3o22r1t4r4f3r1t7r3o22r1t4r3t1f3r1t7r2o22r3t3r2t3f1r2t6r3o22r2t5r3t10r3o22r2t6r1t11r2o23r2t17r3o23r2t17r2o24r2t17o26r2t16o28r2t13o31r2t9o35r2t5o24'},
  {name:'コース5',sub:'まっすぐなパー4・ダブルグリーン',W:58,H:166,ypp:3.15,pin:[20,20],tee:[28.2,142.3],par:4,yard:385,greens:[[20,20],[35,21]],rle:'o22t14o3t13o25t12r1t16r1t4o23t14r2t13r2t3r2o10t9o2t15r1t14r2t4r3o7r2t47r2o7r2t47r2o7r2t6r2t14r1t25r2o6r2t6r1t15r2t15r1t7r3o5r2t23r1t15r3t6f1r2o5r2t30r1t18r2o4r2t17r4t5r3t2r3t8r1t7r3o3r2t12r3t2r4t5r4t1r7t3r2t7r3o3r2f1t6r36t7r2o3r4t5r38t6r3o2r4t5r12f1r25t6r3o2r1t8r8f8r22t6f2r1o1r2t7r6f5g3f3r7g3f2r10t7f1r4t7r5f4g7f1r4f2g5f3r3b2r2t8f1r4t6r5f3g9f1r3f2g7f3r2b2r2t8f1r1f2t6r6f3g9f1r3f2g7f3r2b2r1t9f1r1f2t2r1t2r8f2g8f1r3f2g9f2r5t9f1r1f2t1r2t2r8f2g8f1r3f2g9f2r5t9r2f1t6r8b1f2g6f1t2r2f2g9f1r4t10r3t8r5b4f1g6f1t2r2f2g8f2r4t10r2o1t9r4b5f2g3f2r5f1g7f2b4t10r2o2t9r4t2b4f5r7f1g5b6t11r2o2f2t8r2t2r2b3r7f7r3b7t12r1o2f1t13r12f8r1b8t5r2t6r1o1f1t14r11f9b7r1t4r2t8r3t16r4b3r2f9b2r3b1r2t14r3t14w2r2b5r2f8r9t13o1r2t14w2r2b6r1f8r9t13o2r2t13w5b5r1f8r8t14o3r2t12w9r2f8r3f1r3t14f1o4r3t10r1w9f9r2f1r5t12r2o5r2t9r2w9f9r2f1r1t1r2t2r1t11r1o5r2t8r3w9f9r3t5r2t5r1t4r1o6r1t9r2w8r2f8r3t6r1t5r2t2f1r2o6r1t9r2w8r1f9r2t17f1r2o5r2t10w8r2f9r2t17f1r2o5r2t10w8r2f9r2t17r3o5r2t10w8r2f8r3t17r3o5r1t2r2t2r2t2w10r1f8r3t18r1o5r2t1r2t3r1t4w10f8r4t17o6r2t11r1w9f8r5t17o5r2t10r2w9r1f7r5t17r1o4r2t10r2w8r2f8r4t5r1t11r2o3r2t9r3w7r3f8r4t2r1t2r2t9r1t1r1o3r2t6r5w8r3f8r1b1r2t2r2t13r1o4r2t6r3w10r3f8r1b2r1t2r1t14r2o3r2t7r1w11r3f9r1b1r1t18r1o3r2t1r2t4r2w11r3f8r1f1r2t18o3r2t1r2t4r2w11r3f8r1f2r1t18o3r2t7r3w11r2f8r2f1r4t15o3r2t7r2w11r4f8r7t14o3r2t7r2w10r5f8r11t10o3r2t7r2w5r7b2r1f8r12t9o3r2t7r1w6r3b1r2b3r1f8r11t10o3r2t8w5r2b7r2f9r9t11o3r2t8w5r2b7r1f10r9t10f1o3r2t9w3r3b3r1b3r1f10r9t9f2o3r2t9w2r4b2r6f10r9t9f2o3r2t9w1r5b2r3b1r2f10r9t9f2o3r2t9r4b9f11r9t9r2o3r2t9r3b9r1f11r9t8r3o3r2t9r3b3r1b3r3f11r8t9r2o4r2t9r3b2r2b3r2f12r8t9r3o3r2t8r3b3r2b3r2f12r8t9r2o4r2t8r4b6r2f13r6t10r3o4r2t7r6b2r1b2r2f13r2f1r2t11r2o6r2t8r11f13r2f1r2t12r1o6r2t8r10f14r2f1r2t11r1t1o6r2t7r11f13r6t11r1t1o6r2t8r10f13r6t10r1t1o7r2t7r11f13r7t9r1o9r2t6r11f13r7t8r2o9r2t7r10f12r8t7r3o9r2t7r10f12r9t6r2o10r2t7r9f13r7t8r2o10r2t7r10f12r6t9r2o10r3t6r10f11r8t8r2o11r2t3r1t3r9f11r7t8r3o11r2t2r2t4r8f10r8t8r2o12r2t9r7f10r7t7r3o13r3t5r10f10r5b1t8r2o15r2t6r9f9r5b2t7f1r2o15r2t8r7f9r6t8r3o15r2t8r7f9r6t8r3o15r2t7r8f8r5f2t8r2o16r2t7r7f9r5f1t9r2o17r2t7r5f10r5t9r2o18r2t7r4f11r5t8r2o19r2t5r6f10r5t9r1o20r2t5r6f10r5t7r3o20r2t4r7f10r4f1t7r2o21r2t4r6f11r4f1t8r1o21r2t3r7f11r5t9o21r2t1r1t1r7f10r6t1r2t7o20r4t3r6f9r7t10o19r4t4r5f9r6t11o18r5t4r5f9r5t13o18r5t3r5f8r5t14o17r3f1t5r6f7r5t12r2o17r3t5r7f6r6t12r1o18r3t6r8f2r7t12r1o20r2t7r16t12r1o20r2t7r16t12r1o20r2t7r15t13r1o20r2t7r15t12r2o21r1t8r14t12r2o21r2t7r14t12r2o21r2t7r14t12r1o23r2t6r14t10r2o24r2t6r14t2r2t6r1o25r2t7r16t6r2o25r3t6r14t8r2o26r2t7r12t9r2o26r2t7r12t9r2o26r2t8r11t9r2o27r2t6r12t9r2o27r2t6r11t10r1o28r2t7r10t11o28r2t3r1t2r10t13o27r2t2r2t3r9t11r2o28r2t7r5f2r2t10r1o30r1t8r3f2r4t9r1o30r2t3r2t1r3f1r5t9r1o31r2t3r2t1r9t9r1o31r2t3r2t2r8t9r1o30r3t3r1t3r8t10r1o28r3t1r1t7r1f5r1t10r2o27r2t2r1t6f8t10r1o28r4t7f8t9r2o28r2t1r1t7f8t9r3o27r2t2r4t4f7t9r2o28r2t2r3t5f7t9r2o29r2t9f1r2f4r1t7f1r2o29r2t10r3f3r1t7f1r2o30r1t10r7t7f1r2o30r2t9r7t8r2o31r1t10f6t8r2o31r2t10f5t9r1o31r2t10f5t9r1o32r2t10f4t9r1o33r1t11f3t9r1o35t10f3t9r2o35r1t9f2t8r2o36r2t8f2r1t1r1t4f1r2o35r3t9r4t5r2o35r2t9r3t6r3o35r1t11r1t7r2o35r2t11r1t7r2o35r2t10r3t6r2o35r2t9r4t6r2o35r2t8r2t9r2o35r2t7r3t9r2o35r2t7r2t10r2o35r2t8r1t10r2o36r1t18r2o37r2t6r2t8r2o38r2t5r3t7o41r2t14o43r2t10o47r2t8o51t6o55t1o30'}];
let CSW,CSH,CS_YPP,CS_PIN,CS_TEE,CS_PAR,CS_YARD,CS_RLE,csCourse=0;
// ダブルグリーン：毎回どちらのグリーンを使うか、どこに旗を立てるかをランダムに決める。使わないほうのグリーンはフェアウェイ扱い
function csPrepHole(){const c=CS_COURSES[csCourse];csGrid=null;csBg=null;CS_PIN=c.pin;csGreenSide=null;if(!c.greens)return;csTerr(0,0);
  const G=csGrid.split(''),fill=([sx,sy])=>{const out=[],seen=new Set(),q=[[Math.round(sx),Math.round(sy)]];while(q.length){const [x,y]=q.pop(),k=y*CSW+x;if(x<0||y<0||x>=CSW||y>=CSH||seen.has(k)||G[k]!=='g')continue;seen.add(k);out.push([x,y]);q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}return {out,seen};};
  const gs=c.greens.map(fill),k=Math.floor(Math.random()*gs.length);
  gs.forEach((o,i)=>{if(i!==k)for(const [x,y] of o.out)G[y*CSW+x]='f';});
  const me=gs[k],inner=me.out.filter(([x,y])=>[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]].every(([dx,dy])=>me.seen.has((y+dy)*CSW+x+dx))),pool=inner.length?inner:me.out;
  const p=pool[Math.floor(Math.random()*pool.length)];CS_PIN=[p[0],p[1]];csGrid=G.join('');
  csGreenSide=c.greens.length===2?(k===0?'左':'右'):String(k+1);}
let csGreenSide=null;
function csSetCourse(i){const c=CS_COURSES[i];csCourse=i;CSW=c.W;CSH=c.H;CS_YPP=c.ypp;CS_PIN=c.pin;CS_TEE=c.tee;CS_PAR=c.par;CS_YARD=c.yard;CS_RLE=c.rle;csGrid=null;csBg=null;}
csSetCourse(0);
const CS_LV={beginner:{name:'初心者',power:25,accuracy:22,approach:22,putt:25,recovery:15,mental:22},middle:{name:'中級者',power:55,accuracy:55,approach:52,putt:55,recovery:48,mental:55},expert:{name:'上級者',power:85,accuracy:85,approach:82,putt:85,recovery:80,mental:85}};
const CS_LIE={tee:'ティー',fair:'フェアウェイ',rough:'ラフ',bunker:'バンカー',tree:'林の中'};
const CS_T={o:'ob',t:'tree',r:'rough',f:'fair',b:'bunker',w:'water',g:'green'};
function csTerr(x,y){
  if(!csGrid){csGrid='';CS_RLE.replace(/([a-z])(\d+)/g,(m,c,n)=>{csGrid+=c.repeat(+n);});}
  x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=CSW||y>=CSH)return 'ob';return CS_T[csGrid[y*CSW+x]];
}
function csMakeBg(){
  const c=document.createElement('canvas');c.width=CSW;c.height=CSH;const x=c.getContext('2d'),h=(a,b)=>((a*73856093)^(b*19349663))>>>0;
  for(let j=0;j<CSH;j++)for(let i=0;i<CSW;i++){const t=csTerr(i,j),r=h(i,j)%7;let col;
    if(t==='ob')col=r<2?'#12281a':'#16301c';
    else if(t==='tree')col=r===0?'#c8d84a':r<3?'#8fb83a':r<5?'#4f8a35':'#2f6b35';
    else if(t==='rough')col=r===0?'#37803d':'#3f8a45';
    else if(t==='fair')col=(Math.floor((i+j)/5)%2)?'#6cbf62':'#63b55a';
    else if(t==='bunker')col=r===0?'#d8cc98':'#eadfb0';
    else if(t==='water')col=r===0?'#6aa8f0':'#3a7fd0';
    else col=(i+j)%2?'#9be07f':'#8fd67a';
    x.fillStyle=col;x.fillRect(i,j,1,1);}
  x.fillStyle='#fff';x.fillRect(CS_TEE[0]-2,CS_TEE[1]+1,1,1);x.fillRect(CS_TEE[0]+2,CS_TEE[1]+1,1,1);
  return c;
}
function csStart(lv,ci){if(ci!=null)csSetCourse(ci);csPrepHole();let s0=CS_LV[lv],sk={skills:[],skillLv:{},negs:[]};
  if(lv==='custom'){const c=csCusLoad();s0={name:'カスタム'};for(const k of ['power','accuracy','approach','putt','recovery','mental'])s0[k]=c[k];sk={skills:c.skills.slice(),skillLv:Object.assign({},c.skillLv),negs:c.negs.slice()};}
  cs={course:csCourse,phase:'play',lv,s:Object.assign(csApplySk(s0,sk),{name:s0.name}),sk,ball:CS_TEE.slice(),lie:'tee',strokes:0,target:null,trails:[],msg:'地図をタップして、狙う場所を決めよう',aimT:0,settleT:performance.now()};view='course';render();window.scrollTo(0,0);}
// ティーショットの最大距離（ラン込み）：飛距離25で190、55で257、85で299ヤード
// ---- コース攻略の特性 ----
const CS_SKILLS=['一気通貫','精密機械','小技の鬼','飛ばし屋','パー5◎','アイアン巧者','寄せワン','OBなし','バンカー巧者','ロングパット名人','ショートパット◎','ここ一番','勝負師'];
const CS_NEGS=['ノミの心臓','OB癖','ショートパット×'];
const CS_SKDESC={'一気通貫':'6つの能力がすべて＋3','精密機械':'ミスの確率が3割減り、大きなスライス・フックが出ない','小技の鬼':'P・A・Sの輪が25%小さく、2メートル以内のパットが入りやすい','飛ばし屋':'ドライバーとウッドが（小）＋5（中）＋10（大）＋16ヤード','パー5◎':'パー5ではドライバーが＋15ヤード','アイアン巧者':'アイアンの輪が10%小さい','寄せワン':'P・A・Sの輪が15%小さい','OBなし':'大きなスライス・フックが半分に','バンカー巧者':'バンカーの不利が（小）3分の1（中）3分の2（大）ほぼ全部なくなる','ロングパット名人':'5メートル以上の1パットが（小）1.2倍（中）1.4倍（大）1.6倍','ショートパット◎':'2メートル以内のパットが入りやすい','ここ一番':'池越えのメンタルの減りが（小）−10（中）−5（大）0','勝負師':'池越えのメンタルの減りが−12','ノミの心臓':'池越えのメンタルの減りが−21','OB癖':'大きなスライス・フックが1.4倍','ショートパット×':'2メートル以内のパットが入りにくい'};
const CS_CUS_KEY='golfIkusei_cscustom';
function csCusLoad(){let c=null;try{c=JSON.parse(lsGet(CS_CUS_KEY)||'null');}catch(e){}return c||{name:'カスタム',power:50,accuracy:50,approach:50,putt:50,recovery:50,mental:50,skills:[],skillLv:{},negs:[]};}
function csCusSave(c){lsSet(CS_CUS_KEY,JSON.stringify(c));}
function csHas(n){return !!(cs&&cs.sk&&cs.sk.skills.includes(n));}
function csLv(n){return csHas(n)?((cs.sk.skillLv&&cs.sk.skillLv[n])||3):0;}
function csNg(n){return !!(cs&&cs.sk&&cs.sk.negs.includes(n));}
function csApplySk(st,sk){const o=Object.assign({},st);if(sk.skills.includes('一気通貫'))for(const k of ['power','accuracy','approach','putt','recovery','mental'])o[k]+=3;return o;}
function csWaterPen(){let p=15;if(csHas('勝負師'))p=12;const l=csLv('ここ一番');if(l)p=Math.min(p,[15,10,5,0][l]);if(csNg('ノミの心臓'))p=Math.round(p*1.4);return p;}
function csStartTest(cb){const ci=Math.floor(Math.random()*CS_COURSES.length);csSetCourse(ci);csPrepHole();const P=playerForMatch(G),st={name:'あなた'};
  for(const k of ['power','accuracy','approach','putt','recovery','mental'])st[k]=Math.max(0,Math.min(100,P.stats[k]+((P.gear&&P.gear[k])||0)));
  const sk={skills:(G.skills||[]).slice(),skillLv:Object.assign({},G.skillLv||{}),negs:(G.negs||[]).slice()};
  cs={course:ci,phase:'play',lv:null,s:csApplySk(st,sk),sk,test:true,cb,ball:CS_TEE.slice(),lie:'tee',strokes:0,target:null,trails:[],msg:'地図をタップして、狙う場所を決めよう',aimT:0,settleT:performance.now()};view='course';render();window.scrollTo(0,0);}
function csTestDone(){const n=cs.strokes,cb=cs.cb;cancelAnimationFrame(csRaf);cs=null;cb(n);}
// 100から先：130で世界一の飛ばし屋（平均331ヤード）と同じ。130より先も同じ割合で伸びる
function csTeeTotal(pw){const P=[[0,115],[25,190],[55,257],[85,299],[100,320],[130,331]];for(let i=1;i<P.length;i++)if(pw<=P[i][0]){const [a,b]=P[i-1],[c,d]=P[i];return b+(d-b)*(pw-a)/(c-a);}return 331+(pw-130)*11/30;}
const CS_RUN=1.12; // フェアウェイでのランの分（最大距離はラン込み。狙うのは落ちる場所）
// クラブ（中級者のキャリーの最大。飛距離で全体が伸び縮みする）。長いクラブほどぶれやすい
const CS_CLUBS=[
  {id:'D',name:'ドライバー',carry:229,spread:1.0,long:true,where:['tee']},
  {id:'W',name:'ウッド',carry:205,spread:0.9,long:true,where:['tee','fair']},
  {id:'U',name:'ユーティリティ',carry:185,spread:0.85,long:true,where:['tee','fair','rough']},
  {id:'I',name:'アイアン',carry:160,spread:0.72,where:['tee','fair','rough','bunker','tree']},
  {id:'P',name:'P（ピッチング）',carry:115,spread:0.6,where:['tee','fair','rough','bunker','tree']},
  {id:'A',name:'A（アプローチ）',carry:85,spread:0.55,where:['tee','fair','rough','bunker','tree']}];
const CS_SAND={id:'S',name:'S（サンド）',carry:70,spread:0.65};
// ランの割合（トータル飛距離に対する。フェアウェイに落ちたとき。ラフでは半分）：ドライバー15%、ウッド・ユーティリティ12%、アイアン8%、P・A・Sはアプローチが低いほど止まらない（初心者15%〜上級者3%）
function csRunFrac(c){if(!c)return 0;if(c.id==='D')return 0.15;if(c.id==='W'||c.id==='U')return 0.12;if(c.id==='I')return c.fixed?0.05:0.08;return Math.max(0.03,Math.min(0.18,0.15-(cs.s.approach-22)*0.002));}
function csScale(){return csTeeTotal(cs.s.power)*0.85/229;}
function csLieMult(){const rc=cs.s.recovery;return cs.lie==='rough'?0.85+rc*0.001:cs.lie==='bunker'?0.6+rc*0.002:1;}
// グリーン側の深いバンカー（ピンから40ヤード以内）は、自動でSを使う
function csDeepBunker(){return cs.lie==='bunker'&&Math.hypot(CS_PIN[0]-cs.ball[0],CS_PIN[1]-cs.ball[1])*CS_YPP<=40;}
function csClubs(){if(cs.lie==='tree')return [{id:'I',name:'アイアン（出すだけ）',carry:40,spread:0.9,fixed:true}];if(csDeepBunker())return [Object.assign({},CS_SAND,{fixed:true})];
  const sc=csScale(),lm=csLieMult(),tb=[0,5,10,16][csLv('飛ばし屋')];
  return CS_CLUBS.filter(c=>c.where.includes(cs.lie)).map(c=>Object.assign({},c,{max:c.carry*sc*lm+((c.id==='D'||c.id==='W')?tb:0)+(c.id==='D'&&CS_PAR===5&&csHas('パー5◎')?15:0)}));}
function csClubMax(c){return c.fixed?c.carry:c.max;}
// 狙った距離を「力み：小」以下（8割5分まで）で打てる一番短いクラブ。どれでも届かなければ一番長いクラブ
function csPickClub(d){const cl=csClubs();for(let i=cl.length-1;i>=0;i--)if(d<=csClubMax(cl[i])*0.85)return cl[i];return cl[0];}
function csReach(){const cl=csClubs();return csClubMax(cl[0]);}
function csTotal(){const c=csClubs()[0];return cs.lie==='tree'?csReach():csReach()/(1-csRunFrac(c));}
// 力み：そのクラブの最大距離の7割を超えると、輪が広がりミスが増える（8割5分で1.2倍・+6%、全力で1.8倍・+12%）
function csEffort(d,c){const p=d/csClubMax(c),k=Math.max(0,(p-0.7)/0.3);return {p,ring:1+k*k*0.8,miss:k*0.12,lv:p<=0.7?'なし':p<=0.85?'小':p<=0.95?'中':'大'};}
// 輪の大きさとミスの確率：ドライバー・ウッド・ユーティリティは飛距離と正確性、アイアン・P・A・Sはアプローチと正確性。ラフとバンカーではリカバリーも使う
// 池越え：今の場所から狙った場所までの線が池をまたぎ、狙った場所は池でないとき
function csOverWater(tx,ty){if(csTerr(tx,ty)==='water')return false;const n=Math.ceil(Math.hypot(tx-cs.ball[0],ty-cs.ball[1])*2);for(let i=1;i<n;i++){if(csTerr(cs.ball[0]+(tx-cs.ball[0])*i/n,cs.ball[1]+(ty-cs.ball[1])*i/n)==='water')return true;}return false;}
function csMental(){return cs.target&&csOverWater(cs.target[0],cs.target[1])?Math.max(0,cs.s.mental-csWaterPen()):cs.s.mental;}
// 120ヤード以内では地図を拡大（ボールとピンが入る範囲）。拡大中は輪が1割小さくなる（隠し効果）
let csZoomOn=false;try{csZoomOn=lsGet('golfIkusei_zoom')==='1';}catch(e){}
function csZoomToggle(){csZoomOn=!csZoomOn;lsSet('golfIkusei_zoom',csZoomOn?'1':'0');if(cs&&cs.phase!=='anim')csSetZoom();render();}
function csSetZoom(){if(!cs)return;if(!csZoomOn){cs.zoom=null;return;}const d=Math.hypot(CS_PIN[0]-cs.ball[0],CS_PIN[1]-cs.ball[1])*CS_YPP;if(d>120){cs.zoom=null;return;}
  const dx=Math.abs(CS_PIN[0]-cs.ball[0]),dy=Math.abs(CS_PIN[1]-cs.ball[1]);let z=Math.min(3,CSW/(dx+14),CSH/(dy+14));z=Math.max(1.5,Math.floor(z*2)/2);
  const w=CSW/z,h=CSH/z,cx=(CS_PIN[0]+cs.ball[0])/2,cy=(CS_PIN[1]+cs.ball[1])/2;
  cs.zoom={z,ox:Math.max(0,Math.min(CSW-w,cx-w/2)),oy:Math.max(0,Math.min(CSH-h,cy-h/2))};}
// P・A・Sのブレやすさ：アプローチ0で0.9、アプローチ60で元の値（P0.6・A0.55・S0.65）まで均等に下がる
function csSpread(c){if(c.id==='P'||c.id==='A'||c.id==='S')return 0.9-(0.9-c.spread)*Math.min(1,cs.s.approach/60);return c.spread;}
function csCalc(tx,ty){
  const s=cs.s,d=Math.hypot(tx-cs.ball[0],ty-cs.ball[1])*CS_YPP,bad=cs.lie==='rough'||cs.lie==='bunker'||cs.lie==='tree',c=csPickClub(d);
  let skill=c.long?(s.power+s.accuracy)/2:(s.approach+s.accuracy)/2;if(bad)skill=skill*0.6+s.recovery*0.4;
  const bkf=[0,1/3,2/3,0.95][csLv('バンカー巧者')];
  const lieM=cs.lie==='rough'?Math.max(1,1.3-s.recovery*0.003):cs.lie==='bunker'?1+(Math.max(1,1.6-s.recovery*0.006)-1)*(1-bkf):cs.lie==='tree'?1.3:1;
  const short=c.id==='P'||c.id==='A'||c.id==='S',skM=(c.id==='I'&&!c.fixed&&csHas('アイアン巧者')?0.9:1)*(short&&csHas('寄せワン')?0.85:1)*(short&&csHas('小技の鬼')?0.75:1);
  const ef=csEffort(d,c),R=Math.max(4,d*(0.32-skill*0.0024)*csSpread(c)*lieM*ef.ring)*(cs.zoom?0.9:1)*skM;
  const ow=csOverWater(tx,ty),mt=ow?Math.max(0,s.mental-csWaterPen()):s.mental;
  let pm=Math.max(0,0.42-0.006*Math.min(skill,mt))+ef.miss;if(cs.lie==='rough')pm+=0.05*(1-s.recovery/100);if(cs.lie==='bunker')pm+=0.10*(1-s.recovery/100)*(1-bkf);if(csHas('精密機械'))pm*=0.7;
  return {d,R,pm:Math.min(0.6,pm),ef,club:c,ow};
}
// テンポ：狙いを決める → 構える0.8秒（針は止まったまま）→ 針が動き出して0.4秒は打てない → 打てる
const CS_SET=800,CS_LOCK=400,CS_SETTLE=500;
function csTap(ev){
  if(!cs)return;if(cs.phase==='anim')return csSkip();
  if(cs.phase!=='play'||performance.now()-cs.settleT<CS_SETTLE)return;
  const c=document.getElementById('cscv'),b=c.getBoundingClientRect();
  const Z=cs.zoom||{z:1,ox:0,oy:0};let x=Z.ox+(ev.clientX-b.left)/b.width*CSW/Z.z,y=Z.oy+(ev.clientY-b.top)/b.height*CSH/Z.z;
  const dx=x-cs.ball[0],dy=y-cs.ball[1],len=Math.hypot(dx,dy),mx=csReach()/CS_YPP;if(len<1)return;
  if(len>mx){x=cs.ball[0]+dx/len*mx;y=cs.ball[1]+dy/len*mx;}
  const had=!!cs.target;cs.target=[x,y];cs.aimT=performance.now();if(had)csInfo();else render();
}
function csInfo(){const el=document.getElementById('csinfo');if(el)el.innerHTML=csInfoText();}
function csInfoText(){
  const toPin=Math.round(Math.hypot(CS_PIN[0]-cs.ball[0],CS_PIN[1]-cs.ball[1])*CS_YPP);
  let t=`${cs.strokes+1}打目　${csDeepBunker()?'グリーン側の深いバンカー':CS_LIE[cs.lie]}　ピンまで<b>${toPin}</b>ヤード（最大${Math.round(csTotal())}ヤード${cs.lie==='tree'||csDeepBunker()?'':'・ラン込み'}）`;
  if(cs.target){const k=csCalc(cs.target[0],cs.target[1]);t+=`<br>${k.ow?'<b class="rk大">池越え！</b> ':''}<b class="csclub">${k.club.name}</b>　落とす場所 <b>${Math.round(k.d)}</b>ヤード　±${Math.round(k.R)}　ミス${Math.round(k.pm*100)}%　<span class="rk${k.ef.lv}">力み：${k.ef.lv}</span>`;}
  return t;
}
function csPeriod(){return 1150*(1+(csMental()-50)*0.004);}
function csNeedle(now){const e=now-cs.aimT-CS_SET;if(e<=0)return -1;const ph=(e/csPeriod())%1;return ph<0.5?-1+4*ph:3-4*ph;}
function csCanHit(now){return cs&&cs.phase==='play'&&cs.target&&now-cs.aimT>=CS_SET+CS_LOCK;}
function csHit(){
  const now=performance.now();if(!csCanHit(now))return;
  const x=csNeedle(now),[bx,by]=cs.ball,[tx,ty]=cs.target,k=csCalc(tx,ty),len=Math.hypot(tx-bx,ty-by),ux=(tx-bx)/len,uy=(ty-by)/len,nx=-uy,ny=ux,R=k.R/CS_YPP;
  const forced=Math.abs(x)>0.8,ow=k.ow;let lx,ly,note='',duff=false;
  // 池越えは飛距離が出にくい（狙いより3〜8%手前に落ちやすい）
  const sh=ow?1-(0.03+Math.random()*0.05):1;
  if(forced||Math.random()<k.pm){
    const type=forced?(x>0?'slice':'hook'):['slice','hook','duff'][Math.floor(Math.random()*3)];
    if(type==='duff'){duff=true;const f=0.3+Math.random()*0.2,o=(Math.random()*2-1)*R;lx=bx+ux*len*f+nx*o;ly=by+uy*len*f+ny*o;note='ダフった…';}
    else{// 曲がり方は3段階。正確性が高いほど軽く済みやすい
      const ac=cs.s.accuracy,wl=0.35+ac*0.003,r=Math.random(),sgn=type==='slice'?1:-1,nm=type==='slice'?'スライス':'フック';let o,f;
      if(r<wl){o=R*(1.2+Math.random()*0.4);f=0.92;note=`軽い${nm}`;}
      else if(r<1-Math.max(0,1-wl-0.33)*(csHas('精密機械')?0:(csHas('OBなし')?0.5:1)*(csNg('OB癖')?1.4:1))){o=R*(1.8+Math.random()*0.6);f=0.88;note=`${nm}！`;}
      else{o=R*3+len*0.12;f=0.85;note=`大きな${nm}！`;}
      lx=bx+ux*len*f*sh+nx*o*sgn;ly=by+uy*len*f*sh+ny*o*sgn;}
  }else{
    // 輪の中ならどこにでも落ちる。針をちゃんと止めると、多少真ん中に落ちやすい
    const f=Math.min(1,Math.abs(x)/0.8),e=0.35+0.65*(1-f),a=Math.random()*6.283,r=R*Math.pow(Math.random(),e);
    const cx0=bx+ux*len*sh,cy0=by+uy*len*sh;lx=cx0+Math.cos(a)*r;ly=cy0+Math.sin(a)*r;note=Math.abs(x)<0.2?'ナイスショット！':Math.abs(x)<0.5?'まずまず':'少しずれた';}
  // 落ちた場所（キャリー）。林・OB・バンカー・池に落ちたらそこで止まる。フェアウェイ・ラフ・グリーンなら前へ転がり、途中で林・OB・バンカー・池に入ったらそこで止まる
  const cx=lx,cy=ly,ct=csTerr(cx,cy),carryY=Math.hypot(cx-bx,cy-by)*CS_YPP;let runY=0;
  if(ct==='fair'||ct==='rough'||ct==='green'){
    const rf=duff?0.2:csRunFrac(k.club)*(ct==='rough'?0.5:1);runY=carryY*rf/(1-rf);
    const ux2=(cx-bx)/Math.max(0.01,Math.hypot(cx-bx,cy-by)),uy2=(cy-by)/Math.max(0.01,Math.hypot(cx-bx,cy-by)),steps=Math.ceil(runY/CS_YPP*2);
    for(let i=1;i<=steps;i++){const px=cx+ux2*runY/CS_YPP*i/steps,py=cy+uy2*runY/CS_YPP*i/steps,pt=csTerr(px,py);lx=px;ly=py;if(pt!=='fair'&&pt!=='rough'&&pt!=='green')break;}
  }
  const t=csTerr(lx,ly),dy2=Math.hypot(lx-bx,ly-by)*CS_YPP,pen=t==='ob'||t==='water',ranY=Math.hypot(lx-cx,ly-cy)*CS_YPP;
  // 飛ぶ時間は1.2〜4秒（キャリーが長いほど長い）。ランは距離に応じて0.4〜1.6秒、だんだん減速する
  const fly=Math.max(1.2,Math.min(4,1.2+carryY/300*2.8)),run=ranY>1?Math.min(1.6,0.4+ranY/40):0;
  let res;
  if(t==='ob')res='OB…1打罰で打ち直し';else if(t==='water')res='池に入った…1打罰で打ち直し';
  else if(t==='green')res='ナイスオン！';else res=t==='fair'?'フェアウェイ':t==='rough'?'ラフ':t==='bunker'?'バンカーにつかまった…':'林の中へ…次は出すだけ';
  cs.anim={t0:now,x,note,res,from:[bx,by],carry:[cx,cy],land:[lx,ly],terr:t,pen,duff,ow,dy:dy2,fly,run,H:duff?1.5:Math.min(16,3+dy2/18),stage:''};
  cs.phase='anim';cs.target=null;render();
}
function csSkip(){if(cs&&cs.phase==='anim')csAnimEnd();}
function csAnimEnd(){
  const A=cs.anim;if(!A)return;cs.anim=null;cs.strokes++;cs.trails.push([A.from[0],A.from[1],A.land[0],A.land[1]]);cs.phase='play';
  if(A.pen){cs.strokes++;cs.msg=`${A.note} ${A.res}`;}
  else{cs.ball=A.land.slice();
    if(A.terr==='green'){const m=Math.hypot(A.land[0]-CS_PIN[0],A.land[1]-CS_PIN[1])*CS_YPP*0.9144,p=csPutt(m);cs.strokes+=p;cs.msg=`ナイスオン！ ピンまで${m.toFixed(1)}メートル → ${p}パット`;cs.ball=CS_PIN.slice();cs.phase='done';}
    else{cs.lie=A.terr;cs.msg=`${A.note} ${A.res}`;}}
  if(cs.phase!=='done')csSetZoom();
  if(cs.phase!=='done'&&cs.strokes>=CS_PAR*2){cs.strokes=CS_PAR*2;cs.msg+='（大たたきでギブアップ）';cs.phase='done';}
  cs.settleT=performance.now();render();
}
function csPutt(m){const pt=cs.s.putt;let n=0,d=m;while(n<4){n++;const k=1.6+pt*0.02;let pm=1/(1+Math.pow(d/k,2.2));
  if(d>=5)pm*=[1,1.2,1.4,1.6][csLv('ロングパット名人')];if(d<=2)pm+=(csHas('ショートパット◎')?0.08:0)+(csHas('小技の鬼')?0.15:0)-(csNg('ショートパット×')?0.08:0);pm=Math.max(0.01,Math.min(0.99,pm));if(Math.random()<pm)break;d=0.2+Math.random()*d*(0.15*Math.max(0.5,Math.min(1.5,1.5-pt/100))+Math.max(0,20-pt)*0.02);}return n;}
function csFlash(txt,cls){const f=document.getElementById('csflash');if(f){f.textContent=txt;f.className='csflash on '+(cls||'');}}
function csDraw(now){
  const c=document.getElementById('cscv');if(!c||view!=='course'||!cs||cs.phase==='pick')return;
  const x=c.getContext('2d'),R=(col,a,b,w,h)=>{x.fillStyle=col;x.fillRect(Math.round(a),Math.round(b),w||1,h||1);};
  if(!csBg)csBg=csMakeBg();x.setTransform(1,0,0,1,0,0);x.imageSmoothingEnabled=false;const Z=cs.zoom;if(Z)x.setTransform(Z.z,0,0,Z.z,-Z.ox*Z.z,-Z.oy*Z.z);x.drawImage(csBg,0,0);
  const ring=(cx,cy,r,col,gap)=>{const n=Math.max(12,Math.round(r*6.3/(gap||1)));for(let i=0;i<n;i++){const a=i/n*6.283;R(col,cx+Math.cos(a)*r,cy+Math.sin(a)*r);}};
  const dots=(ax,ay,bx,by,col,st)=>{const n=Math.ceil(Math.hypot(bx-ax,by-ay));for(let i=0;i<=n;i+=st||2)R(col,ax+(bx-ax)*i/Math.max(1,n),ay+(by-ay)*i/Math.max(1,n));};
  const ballAt=(px,py,h)=>{if(h>0.5)R('rgba(0,0,0,.4)',px-1,py,3,2);const z=h>8?3:h>3?2:1,o=Math.floor(z/2),yy=py-h;R('#000',px-o-1,yy-o-1,z+2,z+2);R('#fff',px-o,yy-o,z,z);};
  for(const [ax,ay,bx,by] of cs.trails){dots(ax,ay,bx,by,'rgba(255,255,255,.4)',3);R('#fff',bx,by);}
  R('#e9eef0',CS_PIN[0],CS_PIN[1]-6,1,7);R('#e33',CS_PIN[0]+1,CS_PIN[1]-6,3,2);
  if(cs.phase==='anim'&&cs.anim){
    const A=cs.anim,t=(now-A.t0)/1000,T1=0.5,T2=T1+A.fly,T3=T2+A.run,T4=T3+0.8,T5=T4+(A.pen?0.6:0);
    const st=t<T1?'impact':t<T3?'fly':t<T4?'land':t<T5?'back':'end';
    if(st!==A.stage){A.stage=st;if(st==='impact')csFlash((A.ow?'池越え！ ':'')+A.note,A.note.includes('ナイス')?'good':/スライス|フック|ダフ/.test(A.note)?'bad':'');else if(st==='fly')csFlash('','');else if(st==='land')csFlash(A.res,A.pen||/バンカー|林/.test(A.res)?'bad':A.terr==='green'?'good':'');else if(st==='back')csFlash('打ち直し','');}
    if(st==='end'){csAnimEnd();return;}
    let px=A.from[0],py=A.from[1],h=0;
    if(st==='fly'){
      if(t<T2){const k=(t-T1)/A.fly,e=1-Math.pow(1-k,1.6);px=A.from[0]+(A.carry[0]-A.from[0])*e;py=A.from[1]+(A.carry[1]-A.from[1])*e;h=Math.sin(Math.PI*k)*A.H;}
      else{const k=(t-T2)/A.run,e=1-Math.pow(1-k,3);px=A.carry[0]+(A.land[0]-A.carry[0])*e;py=A.carry[1]+(A.land[1]-A.carry[1])*e;h=Math.abs(Math.sin(k*9.4))*2.2*(1-k)*(1-k);}
      dots(A.from[0],A.from[1],px,py,'rgba(255,255,255,.75)',2);
    }else if(st==='land'){px=A.land[0];py=A.land[1];const k=(t-T3)/0.8;dots(A.from[0],A.from[1],px,py,'rgba(255,255,255,.6)',2);
      const col=A.terr==='water'?'#cfe8ff':A.terr==='bunker'?'#fff3c4':A.terr==='ob'?'#ff6a5a':A.terr==='green'?'#ffe14a':'#ffffff';
      if(k<0.7){ring(px,py,1.5+k*9,col,1.6);if(A.terr==='water'||A.terr==='bunker')for(let i=0;i<6;i++){const a=i*1.05+1;R(col,px+Math.cos(a)*k*8,py-Math.abs(Math.sin(a))*k*10+k*k*9);}}
      h=A.pen||A.run?0:Math.abs(Math.sin(k*9))*2*(1-k);if(A.terr==='water'&&k>0.25)h=-99;
    }else if(st==='back'){const k=(t-T4)/0.6;px=A.land[0]+(A.from[0]-A.land[0])*k;py=A.land[1]+(A.from[1]-A.land[1])*k;h=0;}
    if(h>-50)ballAt(px,py,h);
    const nd=document.getElementById('csneedle');if(nd)nd.style.left=(50+A.x*50)+'%';
  }else{
    if(cs.phase==='play'){
      const fade=Math.min(1,(now-cs.settleT)/CS_SETTLE);
      ring(cs.ball[0],cs.ball[1],csReach()/CS_YPP,`rgba(255,255,255,${(0.55*fade).toFixed(2)})`,2.5);
      if(cs.target){const [tx,ty]=cs.target,k=csCalc(tx,ty),bl=Math.floor(now/250)%2,pop=Math.min(1,(now-cs.aimT)/180);ring(tx,ty,k.R/CS_YPP*pop,bl?'#ffe14a':'#ff9a2a',1);R('#ff3b3b',tx-1,ty,3,1);R('#ff3b3b',tx,ty-1,1,3);
        dots(cs.ball[0],cs.ball[1],tx,ty,'rgba(255,225,74,.7)',3);
        const nd=document.getElementById('csneedle');if(nd)nd.style.left=(50+csNeedle(now)*50)+'%';
        const bt=document.getElementById('csbtn'),ok=csCanHit(now);if(bt&&bt.disabled===ok){bt.disabled=!ok;bt.textContent=ok?'打つ！':'構え中…';bt.classList.toggle('rdy',ok);}}
    }
    ballAt(cs.ball[0],cs.ball[1],0);
  }
  csRaf=requestAnimationFrame(csDraw);
}
function csCustomHTML(){const c=csCusLoad(),K=['power','accuracy','approach','putt','recovery','mental'];
  const sl=K.map(k=>`<div class="cusrow"><span class="cn">${STAT_NAMES[k]}</span><input type="range" min="0" max="130" step="1" value="${c[k]}" oninput="csCusSet('${k}',this.value)"><b id="cus_${k}" class="${rankCls(c[k])}">${rankOf(c[k])} ${c[k]}</b></div>`).join('');
  const lvn=['','（小）','（中）','（大）'];
  const sk=CS_SKILLS.map(n=>{const on=c.skills.includes(n),lvd=SKILL_LV[n],l=on?(c.skillLv[n]||3):0;return `<button class="cussk ${on?'on':''} ${GOLD[n]?'gold':''}" onclick="csCusSk('${n}')"><b>${n}${lvd&&on?lvn[l]:''}</b><small>${CS_SKDESC[n]}</small></button>`;}).join('');
  const ng=CS_NEGS.map(n=>`<button class="cussk neg ${c.negs.includes(n)?'on':''}" onclick="csCusNg('${n}')"><b>${n}</b><small>${CS_SKDESC[n]}</small></button>`).join('');
  return `<div class="top"><div class="wk">🛠 カスタム</div><div class="money">コース攻略</div></div>
  <div class="cusbox">${sl}</div>
  <div class="cat">特技（タップで付け外し${'・'}段階のある特技は 小→中→大→外す）</div><div class="cusgrid">${sk}</div>
  <div class="cat">デメリット</div><div class="cusgrid">${ng}</div>
  <p class="lead" style="font-size:11.5px">コース攻略で効く特性だけを並べている。天気や試合の流れの特性は、コース攻略では効かない。</p>
  <button class="big" onclick="csStart('custom')">この能力で始める（${CS_COURSES[csCourse].name}）</button>
  <div class="mrow"><button class="ghost" onclick="csCusReset()">初期値に戻す</button><button class="ghost" onclick="cs={phase:'pick'};render();window.scrollTo(0,0)">戻る</button></div>`;}
function csCusSet(k,v){const c=csCusLoad();c[k]=+v;csCusSave(c);const el=document.getElementById('cus_'+k);if(el){el.textContent=rankOf(c[k])+' '+c[k];el.className=rankCls(c[k]);}}
function csCusSk(n){const c=csCusLoad();if(!c.skills.includes(n)){c.skills.push(n);if(SKILL_LV[n])c.skillLv[n]=1;}else if(SKILL_LV[n]&&(c.skillLv[n]||3)<3){c.skillLv[n]=(c.skillLv[n]||1)+1;}else{c.skills=c.skills.filter(x=>x!==n);delete c.skillLv[n];}csCusSave(c);render();}
function csCusNg(n){const c=csCusLoad();c.negs=c.negs.includes(n)?c.negs.filter(x=>x!==n):c.negs.concat([n]);csCusSave(c);render();}
function csCusReset(){lsDel(CS_CUS_KEY);render();}
function csHTML(){
  const back=`<button class="ghost" onclick="cancelAnimationFrame(csRaf);cs=null;view='title';render()">メニューへ</button>`;
  if(cs.phase==='pick')return `<div class="top"><div class="wk">🗺 コース攻略</div><div class="money">お試し</div></div>
    <div class="tabs t${CS_COURSES.length}">${CS_COURSES.map((c,i)=>`<button class="${csCourse===i?'on':''}" onclick="csSetCourse(${i});render()">${c.name}<small style="display:block;font-size:11px;font-weight:400">パー${c.par}${CS_COURSES.length>=4?'<br>':'・'}${c.yard}ヤード</small></button>`).join('')}</div>
    <p class="lead">${CS_COURSES[csCourse].sub}（パー${CS_PAR}・${CS_YARD}ヤード）。地図をタップして<b>狙う場所</b>を決め、動く針を<b>中央で止めて</b>打とう。<br>白い点線の輪が届く範囲、黄色い輪が球の落ちそうな範囲。池とOBは1打罰、林は出すだけになる。<br>能力が低いと、スライスやダフリで輪から大きく外れることがある。</p>
    ${Object.entries(CS_LV).map(([k,s])=>`<button class="act" onclick="csStart('${k}')"><b>${s.name}</b><span class="desc">飛距離${s.power}・正確性${s.accuracy}・アプローチ${s.approach}・リカバリー${s.recovery}・メンタル${s.mental}</span></button>`).join('')}
    ${(()=>{const c=csCusLoad(),n=c.skills.length+c.negs.length;return `<button class="act" onclick="cs={phase:'custom'};render();window.scrollTo(0,0)"><b>🛠 カスタム</b><span class="desc">飛距離${c.power}・正確性${c.accuracy}・アプローチ${c.approach}・パター${c.putt}・リカバリー${c.recovery}・メンタル${c.mental}${n?`・特性${n}個`:''}　（タップして調整）</span></button>`;})()}${back}`;
  if(cs.phase==='custom')return csCustomHTML();
  setTimeout(()=>{cancelAnimationFrame(csRaf);csRaf=requestAnimationFrame(csDraw);},0);
  const cv=`<div class="cswrap ${cs.phase==='done'?'fin':''}"><div class="csmap"><canvas id="cscv" width="${CSW}" height="${CSH}" style="aspect-ratio:${CSW}/${CSH}" onclick="csTap(event)"></canvas><button class="cszoom ${csZoomOn?'on':''}" onclick="csZoomToggle()">🔍120ヤード以内で拡大：${csZoomOn?'する':'しない'}</button></div><div class="csflash" id="csflash"></div></div>`;
  if(cs.phase==='done'){const d=cs.strokes-CS_PAR,nm={'-3':'アルバトロス','-2':'イーグル','-1':'バーディー','0':'パー','1':'ボギー','2':'ダブルボギー','3':'トリプルボギー'}[d]||`+${d}`;
    if(cs.test)return `<div class="top"><div class="wk">🗺 ${match.e.name}</div><div class="money">パー${CS_PAR}</div></div>${cv}
    <div class="teeres cres"><b class="${d<0?'q1':d===0?'q2':'q0'}">${cs.strokes}打　${nm}</b><div>${cs.msg}</div><div>この結果が、本番のパー${CS_PAR}のホール2つのスコアになる</div></div>
    <button class="big" onclick="csTestDone()">1番ホールへ</button>`;
    return `<div class="top"><div class="wk">🗺 コース攻略</div><div class="money">${cs.s.name}</div></div>${cv}
    <div class="teeres cres"><b class="${d<0?'q1':d===0?'q2':'q0'}">${cs.strokes}打　${nm}</b><div>${cs.msg}</div></div>
    <button class="big" onclick="csStart('${cs.lv}')">もう一度</button><div class="mrow"><button class="ghost" onclick="cs={phase:'pick'};render()">能力を変える</button>${back}</div>`;}
  const bar=`<div class="teebar csbar" onclick="csHit()"><i class="z2" style="left:10%;width:80%"></i><i class="z1" style="left:40%;width:20%"></i><u id="csneedle" style="left:${cs.anim?50+cs.anim.x*50:0}%"></u></div>`;
  return `<div class="top"><div class="wk">🗺 ${cs.test?'本番前の攻略　':''}パー${CS_PAR}　${CS_YARD}ヤード</div>${cs.test?'':`<button class="totitle" onclick="cancelAnimationFrame(csRaf);cs=null;view='title';render()">メニューへ</button>`}<div class="money">${cs.s.name}</div></div>${cv}
    <div class="csmsg">${cs.phase==='anim'?'':cs.msg}</div><div class="csinfo" id="csinfo">${cs.phase==='anim'?`${Math.round(cs.anim.dy)}ヤード`:csInfoText()}</div>
    ${cs.phase==='anim'?`${bar}<button class="ghost csskip" onclick="csSkip()">タップで飛ばす</button>`:cs.target?`${bar}<button class="big" id="csbtn" disabled onclick="csHit()">構え中…</button>`:`<button class="big" disabled>地図をタップして狙う</button>`}`;
}
function playAnim(kind,friends){
  anim={kind,friends:friends||[],label:SCENE_LABEL[lastActId]||SCENE_LABEL[kind]};view='anim';render();window.scrollTo(0,0);
  clearTimeout(animTimer);animTimer=setTimeout(endAnim,1300);
}
function endAnim(){
  clearTimeout(animTimer);if(view!=='anim')return;
  if(resData){view='res';render();window.scrollTo(0,0);return;}
  view=G.over?'ending':G.pending?'revent':'main';render();
}
function animHTML(){
  return `<div>${stageHTML(anim.kind,{big:true,friends:anim.friends})}<div class="doing">${anim.label||''}${anim.friends&&anim.friends.length?`<div class="with">${anim.friends.map(f=>FRIENDS.find(x=>x.id===f).icon+FRIENDS.find(x=>x.id===f).name).join('・')}と一緒に</div>`:''}<small>タップで飛ばす</small></div></div>`;
}
function skillPickHTML(){
  const o=(G.skillOffer||[]).map(x=>typeof x==='string'?{s:x,n:null}:x),neg=o.some(x=>x.n);
  return `${topHTML()}<div class="evflag">✨ 特技を覚えるチャンス！</div>
  <div class="revent ${skSel==null?'lock':''}"><h2>どれを覚える？</h2><p>${neg?'3つの中から1つ選ぶ。<b>どれにもデメリットが付いてくる</b>。':'3つの中から1つ選べる（デメリットなし）。'}</p>
  ${o.map((x,i)=>`<button class="act skp ${skSel===i?'sel':''}" onclick="skSel=${i};render()"><b>${skSel===i?'✔ ':''}★${x.s}</b><span class="desc">${SKILLS[x.s]}</span>${goldPair(x.s)&&G.skills.includes(goldPair(x.s))?`<span class="goldh">🌟「${goldPair(x.s)}」とそろうと金特「${goldOf(x.s)}」</span>`:''}${x.n?`<span class="negl">💀${x.n}：${NEGS[x.n]}</span>`:''}</button>`).join('')}
  <button class="big" ${skSel==null?'disabled':''} onclick="if(skSel!=null)chooseSkill(skSel)">${skSel==null?'覚える特技をタップして選ぶ':'これに決める'}</button></div>`;
}
let skSel=null;
function chooseSkill(i){skSel=null;const m=pickSkill(G,i);save();showRes('idle','特技を習得',null,[m]);}
function reventHTML(){
  const e=RANDOM_EVENTS.find(x=>x.id===G.pending);
  if(!e){G.pending=null;view='main';return mainHTML();}
  return `${topHTML()}<div class="evflag">⚡ イベント発生！</div>
  <div class="revent lock"><div class="ico">${e.icon}</div><h2>${e.title}</h2><p>${e.text}</p>
  ${e.choices.map((c,i)=>`<button class="${i===0?'big':'ghost'}" onclick="chooseEvent(${i})">${c.label}</button>`).join('')}</div>`;
}
function chooseEvent(i){
  if(G.pending==='karasu'&&i===0&&!chooseEvent.skipBird){birdOpen('crow',r=>{const before=snap(),e=RANDOM_EVENTS.find(x=>x.id==='karasu');
    const m=karasuResult(G,r.ok?2:r.frac>=0.5?1:0);G.pending=null;lastLog=m;save();showRes('idle',e.icon+' '+e.title,before,m);});return;}
  const e=RANDOM_EVENTS.find(x=>x.id===G.pending),before=snap();const m=resolveEvent(G,i);lastLog=m;save();showRes('idle',e?e.icon+' '+e.title:'',before,m.map(x=>x.replace(/^.*?：/,'')));}
function skipEvent(){const e=curEvent(G);const m=[`${e.name}は見送った`];if(e.type==='test'&&e.stage<3)G.testStage[e.stage]=0;const before=snap();lastLog=m.concat(advanceTurn(G));save();if(G.over){view='ending';render();}else showRes('idle','',before,lastLog);}
function enterEvent(){
  const e=curEvent(G);G.money-=e.cost;
  match={e,p:playerForMatch(G),hole:0,scores:[],lastLog:[],wx:G.evWx||'sun'};
  if(e.type==='mp'){match.mp={o:makeRival(rivalLevel(G,null)),up:0,c:0,os:[],res:[]};}
  if(e.type==='test'){save();csStartTest(n=>{const par=CS_PAR,idx=COURSE.map((c,i)=>c[0]===par?i:-1).filter(i=>i>=0);
    for(let k=idx.length-1;k>0;k--){const j=Math.floor(Math.random()*(k+1));[idx[k],idx[j]]=[idx[j],idx[k]];}
    match.fixed={};idx.slice(0,2).forEach(i=>match.fixed[i]=n);match.fixedPar=par;
    const h=idx.slice(0,2).sort((a,b)=>a-b).map(i=>i+1).join('番と');
    match.lastLog=[`🗺 本番前の攻略は<b>パー${par}で${n}打</b>。${h}番はこのスコアになる`];view='match';render();window.scrollTo(0,0);});return;}
  view='match';save();render();window.scrollTo(0,0);
}
// ---- 試合 ----
function toPar(n){return n===0?'±0':n>0?'+'+n:''+n;}
function playOne(sk){
  const i=match.hole;const [par,y]=COURSE[i];
  const c=match.carry||0;
  const fx=match.fixed&&match.fixed[i]!=null;
  const r=fx?{strokes:match.fixed[i],log:['🗺 本番前のコース攻略の結果が、このホールのスコアになる']}:playHole(match.p,par,y,sk,{pressure:holePressure(match.e.pressure,i),hole:i,carry:c,wx:match.wx});
  if(fx)sk='normal';
  if(!fx&&c<0)r.log.unshift(`（前のホールを引きずっている…打球の能力 ${c}）`);else if(!fx&&c>0)r.log.unshift(`（切り替えて集中！ 打球の能力 +${c}）`);
  match.birdNote='';
  if(match.birdRes==='ng'){r.strokes+=1;match.birdNote='🐦鳥の群れに球を落とされた（+1打）';r.log.unshift('🐦 鳥の群れに球を落とされた…（+1打）');}
  else if(match.birdRes==='ok'){match.birdNote='🐦鳥の群れをよけ切った';r.log.unshift('🐦 鳥の群れをよけ切った！');}
  match.birdRes=null;
  match.carry=carryAfter(match.p,par,r.strokes);
  match.scores.push(r.strokes);
  const diff=r.strokes-par;const nm={'-3':'アルバトロス','-2':'イーグル','-1':'バーディー','0':'パー','1':'ボギー','2':'ダブルボギー','3':'トリプルボギー'}[diff]||`+${diff}`;
  match.lastLog=[`<b>${i+1}番 パー${par}${fx?'（攻略の結果）':`（${STRAT[sk].name}）`}</b>`].concat(r.log).concat([`→ <b class="${diff<0?'good':diff>0?'bad':''}">${r.strokes}打 ${nm}</b>`]);
  if(match.mp){const M=match.mp,b=playHole(M.o,par,y,'normal',{pressure:holePressure(match.e.pressure,i),hole:i,carry:M.c,wx:match.wx}).strokes;M.c=carryAfter(M.o,par,b);M.os.push(b);
    const w=r.strokes<b?1:r.strokes>b?-1:0;M.up+=w;M.res.push(w);const nm=G.mk2?'早乙女markⅡ':'早乙女';
    match.lastLog.push(`${nm}は${b}打 → <b class="${w>0?'good':w<0?'bad':''}">${w>0?'このホールを取った！':w<0?'このホールを取られた…':'分け'}</b>　${mpState()}`);}
  match.hole++;
}
function mpDone(){const M=match.mp;return M&&Math.abs(M.up)>18-match.hole;}
function mpState(){const u=match.mp.up;return u>0?`${u}アップ`:u<0?`${-u}ダウン`:'オールスクエア（互角）';}
function birdRoll(rate){const par=COURSE[match.hole][0];if(match.fixed&&match.fixed[match.hole]!=null)return false;if(match.birdDone||par<4||Math.random()>=rate)return false;match.birdDone=true;return true;}
function hole(sk){
  if(birdRoll(0.05)){birdOpen('match',r=>{match.birdRes=r.ok?'ok':'ng';view='match';hole(sk);});return;}
  playOne(sk);if(match.hole>=18||mpDone())return endMatch();render();}
function autoRest(){const all=match.autoLog=match.autoLog||[];
  while(match.hole<18&&!mpDone()){
    if(!match.birdRes&&birdRoll(0.025)){birdOpen('match',r=>{match.birdRes=r.ok?'ok':'ng';view='match';autoRest();});return;}
    playOne('normal');all.push(`${match.hole}番：`+(match.birdNote?match.birdNote+' ':'')+match.lastLog[match.lastLog.length-1].replace('→ ',''));match.birdNote='';}
  match.lastLog=all;endMatch();}
function endMatch(){
  if(match.mp){resultMsgs=mpFinish(G,match.mp.up,match.hole);match.board=null;view='result';save();render();window.scrollTo(0,0);return;}
  const score=match.scores.reduce((a,b)=>a+b,0);
  G._named=null;const field=makeField(match.e,match.wx,G);match.board=match.e.type==='check'?null:{field,names:fieldNames(field.length),score};
  resultMsgs=finishEvent(G,match.e,score,field);
  if(match.board&&G.lastMk2!=null){const k=field.indexOf(G.lastMk2);if(k>=0)match.board.names[k]='🤖早乙女markⅡ';}
  if(match.board&&G._named){const used={};for(const x of G._named){let k=-1;for(let i=0;i<field.length;i++)if(field[i]===x.score&&!used[i]&&match.board.names[i]!=='🤖早乙女markⅡ'){k=i;break;}if(k>=0){used[k]=1;match.board.names[k]=x.name;}}G._named=null;}
  view='result';save();render();window.scrollTo(0,0);
}
function scorecard(){
  let h='<div class="card">';
  for(let half=0;half<2;half++){
    h+='<div class="row">';
    for(let i=half*9;i<half*9+9;i++){const s=match.scores[i];const par=COURSE[i][0];const c=s==null?'':s<par?'good':s>par?'bad':'';h+=`<div class="cell ${i===match.hole?'cur':''} ${match.fixed&&match.fixed[i]!=null?'fx':''}"><small>${i+1}${match.fixed&&match.fixed[i]!=null?'🗺':''}</small><span class="${c}">${s??'·'}</span></div>`;}
    h+='</div>';
  }
  return h+'</div>';
}
function matchHTML(){
  const i=match.hole,[par,y]=COURSE[i]||[0,0],e=match.e;
  const played=match.scores.length;const tot=match.scores.reduce((a,b)=>a+b,0);
  const pr=holePressure(e.pressure,i);
  let goal='';
  if(e.type==='check'){const left=18-played;const room=e.target-tot;goal=`<div class="goal">目標：${e.target+1}を切る　残り${left}ホールを<b>${room}打以内</b>${left?`（平均${(room/left).toFixed(1)}打）`:''}</div>`;}
  return `<div class="mhead"><div><div class="etag">${e.name}　${WX[match.wx].icon}${WX[match.wx].name}</div>${goal}</div><div class="tot">${match.mp?`<small>${mpState()}</small>`:`${tot}<small>打</small>`}</div></div>
  ${scorecard()}
  <div class="holeinfo"><span class="hn">${i+1}番</span>　パー${par}　${y}ヤード${i>=15?'<span class="pr">　終盤の重圧…</span>':pr>=0.6?'<span class="pr">　大舞台の緊張…</span>':''}</div>
  ${match.fixed&&match.fixed[i]!=null?`<button class="big" onclick="hole('normal')">🗺 攻略の結果（${match.fixed[i]}打）を記入する</button>`:`<div class="strat">
   <button class="s-atk" onclick="hole('attack')"><b>攻める</b><span>飛ばしてピンを狙う。曲がると大けが</span></button>
   <button class="s-nor" onclick="hole('normal')"><b>普通</b><span>いつも通り</span></button>
   <button class="s-safe" onclick="hole('safe')"><b>刻む</b><span>安全第一。そのぶん距離が残る</span></button>
  </div>`}
  <button class="ghost" onclick="autoRest()">残りのホールをおまかせ（普通）</button>
  ${match.lastLog.length?`<div class="log hl">${match.lastLog.map(m=>`<div>${m}</div>`).join('')}</div>`:''}`;
}
const PAR=COURSE.reduce((a,c)=>a+c[0],0);
function boardHTML(){
  const B=match.board;if(!B)return '';
  const all=B.field.map((s,i)=>({name:B.names[i],s})).concat([{name:'あなた',s:B.score,me:true}]).sort((a,b)=>a.s-b.s||(a.me?-1:b.me?1:0));
  all.forEach((x,i)=>x.rank=i&&all[i-1].s===x.s?all[i-1].rank:i+1);
  const mi=all.findIndex(x=>x.me),pass=match.e.pass;
  const show=new Set([0]);for(let i=mi-2;i<=mi+2;i++)if(i>=0&&i<all.length)show.add(i);
  let rows='',prev=-1;
  for(const i of [...show].sort((a,b)=>a-b)){
    if(i>prev+1)rows+=`<tr class="gap"><td colspan="4">⋮</td></tr>`;
    const x=all[i],cut=pass&&i===pass?'cut':'';
    rows+=`<tr class="${x.me?'me':''} ${pass&&x.rank<=pass?'in':''} ${cut}"><td>${x.rank}位</td><td>${x.name}</td><td>${x.s}</td><td>${toPar(x.s-PAR)}</td></tr>`;prev=i;
  }
  return `<div class="board"><div class="bt">順位表（${all.length}人）${pass?`<small>上位${pass}人が通過</small>`:''}</div><table>${rows}</table></div>`;
}
function resultHTML(){
  return `<div class="result ${G.passed?'win':''}"><h2>${match.e.name} 結果</h2>${scorecard()}${boardHTML()}${resultMsgs.map(m=>`<p>${m}</p>`).join('')}
  ${G.over&&G.passed&&!G.cont&&G.passWeek<=96?`<div class="contbox"><b>このままプロになる？ それとも…</b><small>${Math.floor((G.passWeek-1)/48)+2}年目の終わりまで研修生を続けて、さらに腕を磨くこともできる。合格は取り消されず、引き継ぎポイントも今の成績のまま。査定で目標に届かなくてもクビにならない。</small><button class="ghost" onclick="keepGoing()">もう1年、研修生を続ける</button></div>`:''}
  <button class="big" onclick="afterResult()">${G.over?'エンディングへ':'次へ'}</button></div>`;
}
function keepGoing(){G.over=false;G.cont=true;G.endWeek=(Math.floor((G.passWeek-1)/48)+2)*48;save();afterResult();}
function retire(){if(!retireAsk){retireAsk=true;return render();}retireAsk=false;showDetail=false;G.over=true;view='ending';render();window.scrollTo(0,0);}
let retireAsk=false;
function afterResult(){
  if(G.over){view='ending';return render();}
  const before=snap();lastLog=advanceTurn(G);save();if(G.over){view='ending';render();}else if(lastLog.length)showRes('idle','',before,lastLog);else resNext();
}
// ---- 買い物・コーチ探し（出かけると1日使う） ----
function shopHTML(){
  const item=(name,sub,price,own,fn)=>`<button class="act" ${own||G.money<price?'disabled':''} onclick="${fn}"><b>${name}</b><span class="cost">${own?own:yen(-price)}</span><span class="desc">${sub}</span></button>`;
  return `<div class="top"><div class="wk">買い物・コーチ探し</div><div class="money">${yen(G.money)}</div></div>
  <button class="ghost backtop" onclick="leaveShop()">‹ ${G.shopBought?'帰る（今日はおしまい）':'何もせず戻る（日は進まない）'}</button>
  ${stageHTML('shop')}
  ${lastLog.length&&G.shopBought?`<div class="log hl">${lastLog.map(m=>`<div>${m}</div>`).join('')}</div>`:''}
  <p class="lead">何か買うか契約すると、今日はこれで終わり。いくつ買っても1日。</p>
  <div class="cat">コーチ（月謝は毎月初めに自動で支払い。払えないと契約が切れる）</div>
  ${COACHES.map((c,i)=>`<button class="act ${G.coach===i?'cur':''}" ${G.coach===i||(i>0&&G.money<c.fee)?'disabled':''} onclick="hire(${i})"><b>${c.name}</b><span class="cost">${G.coach===i?'いまの契約':i===0?'契約をやめる':'月'+yen(c.fee)}</span><span class="desc">${c.desc}</span></button>`).join('')}
  <div class="cat">トレーニング用品・消耗品</div>
  ${ITEMS.map(it=>it.use?item(it.name,it.desc,it.price,it.id==='shippu'&&!(G.injury>0)?'ケガをしていない':'',`buyItem('${it.id}')`):item(it.name,it.desc,it.price,hasItem(G,it.id)?'持っている':'',`buyItem('${it.id}')`)).join('')}
  <div class="cat">教本（その能力の伸びがずっと1.25倍）</div>
  ${BOOKS.map(b=>item(b.name,b.stats.map(k=>STAT_NAMES[k]).join('・')+'の伸びが上がる',b.price,G.books[b.id]?'持っている':'',`buyBook('${b.id}')`)).join('')}
  ${Object.entries(GEAR).map(([s,g])=>`<div class="cat">${g.slot}${G.owned[s]!=null?`（使用中：${g.items[G.owned[s]].name}）`:''}</div>`+g.items.map((it,i)=>item(it.name,Object.entries(it.bonus).map(([k,v])=>`${STAT_NAMES[k]}+${v}`).join('、'),it.price,G.owned[s]!=null&&G.owned[s]>=i?'持っている':'',`buy('${s}',${i})`)).join('')).join('')}
  <button class="big" onclick="leaveShop()">${G.shopBought?'帰る（今日はおしまい）':'何もせず戻る（日は進まない）'}</button>`;
}
function bought(msg){G.shopBought=true;lastLog=(G.shopLog=(G.shopLog||[]).concat([msg]));save();render();}
function buy(s,i){const it=GEAR[s].items[i];if(G.money<it.price)return;G.money-=it.price;G.owned[s]=i;bought(`${it.name}を買った（${yen(-it.price)}）`);}
function buyBook(id){const b=BOOKS.find(x=>x.id===id);if(G.money<b.price||G.books[id])return;G.money-=b.price;G.books[id]=1;bought(`${b.name}を買った（${yen(-b.price)}）`);}
function buyItem(id){const it=ITEMS.find(x=>x.id===id);if(G.money<it.price)return;G.items=G.items||{};
  if(!it.use){if(G.items[id])return;G.money-=it.price;G.items[id]=1;return bought(`${it.name}を買った（${yen(-it.price)}）`);}
  if(id==='shippu'){if(!(G.injury>0))return;G.money-=it.price;G.injury=Math.max(0,G.injury-3);return bought(`湿布と包帯で手当てした（${yen(-it.price)}）`+(G.injury?`。ケガはあと約${Math.ceil(G.injury/2)}週`:'。ケガが治った！'));}
  if(id==='drink'){G.money-=it.price;G.stamina=Math.min(100,G.stamina+15);return bought(`栄養ドリンクを飲んだ（${yen(-it.price)}）。体力+15`);}
}
function hire(i){const m=signCoach(G,i);if(m)bought(m);}
function leaveShop(){window.scrollTo(0,0);
  const did=G.shopBought,log=G.shopLog||[];G.shopOpen=false;G.shopBought=false;G.shopLog=null;
  if(!did){view='main';save();render();return;}
  lastActId='shop';const before=snap();doAction(G,'shop');lastLog=log.concat(advanceTurn(G));save();resData={kind:'shop',title:'買い物・コーチ探し',before,msgs:lastLog,friends:[]};playAnim('shop');
}
function scoreGraph(){
  const h=G.history.filter(x=>x.score);if(h.length<2)return '';
  const W=320,H=170,L=34,R=8,T=12,B=24;
  const ss=h.map(x=>x.score),mx=Math.ceil((Math.max(...ss)+3)/10)*10,mn=Math.floor((Math.min(...ss)-3)/10)*10;
  const X=w=>L+(W-L-R)*(w-1)/(TOTAL_WEEKS-1),Y=v=>T+(H-T-B)*(v-mn)/(mx-mn||1);
  let g='';for(let v=mn;v<=mx;v+=10)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1f3d2c"/><text x="${L-4}" y="${Y(v)+4}" text-anchor="end">${v}</text>`;
  for(const y of [1,2,3])g+=`<text x="${X((y-1)*48+24)}" y="${H-6}" text-anchor="middle">${y}年目</text>`+(y>1?`<line x1="${X((y-1)*48)}" x2="${X((y-1)*48)}" y1="${T}" y2="${H-B}" stroke="#2c5a40" stroke-dasharray="3 3"/>`:'');
  const pts=h.map(x=>`${X(x.week).toFixed(1)},${Y(x.score).toFixed(1)}`).join(' ');
  const best=Math.min(...ss);
  const dots=h.map(x=>`<circle cx="${X(x.week)}" cy="${Y(x.score)}" r="${x.score===best?5:3.5}" fill="${x.target?'#9fb8a6':/プロテスト/.test(x.name)?'#e8c25a':'#5ec27a'}" stroke="${x.score===best?'#fff':'none'}" stroke-width="1.5"/>`).join('');
  return `<div class="graph"><div class="gt">スコアの推移　<b>ベスト ${best}</b></div><svg viewBox="0 0 ${W} ${H}">${g}<polyline points="${pts}" fill="none" stroke="#5ec27a" stroke-width="2"/>${dots}</svg>
  <div class="gl"><span style="color:#9fb8a6">●査定</span><span style="color:#5ec27a">●大会</span><span style="color:#e8c25a">●プロテスト</span></div></div>`;
}
// ---- エンディングの絵：18番グリーンでの胴上げ（空から斜めに見下ろす） ----
let dgRaf=0,dgConf=null;
const DG_PEOPLE=[['#1c1a17','#2f4f38'],['#7a4a2a','#c46a7a'],['#d8d3c4','#6b5a3a'],['#2b3a6b','#e8e4d6'],['#3a2a1c','#b08a3a'],['#222','#5a7aa8'],['#4a3a2a','#8a4a4a'],['#2a2a2a','#7a8a5a'],['#5a4030','#d0c8b0']];
function dgDraw(now){
  const c=document.getElementById('dgcv');if(!c||view!=='ending')return;
  const x=c.getContext('2d'),W=160,H=100,t=now/1000,R=(col,a,b,w,h)=>{x.fillStyle=col;x.fillRect(Math.round(a),Math.round(b),Math.round(w),Math.round(h));};
  // 地面：ラフ、グリーン（芝のしま模様）、バンカー、木、クラブハウス
  R('#2f6b35',0,0,W,H);
  for(let i=0;i<40;i++)R('#286030',(i*37)%W,(i*53)%H,2,1);
  const gx=84,gy=58,grx=62,gry=32;
  for(let yy=-gry;yy<=gry;yy++){const w=Math.round(grx*Math.sqrt(1-(yy*yy)/(gry*gry)));for(let xx=-w;xx<w;xx+=1){const band=Math.floor((xx+yy*1.2+200)/9)%2;R(band?'#5fb062':'#55a258',gx+xx,gy+yy,1,1);}}
  for(let yy=-gry-2;yy<=gry+2;yy++){const w=Math.round((grx+3)*Math.sqrt(Math.max(0,1-(yy*yy)/((gry+2)*(gry+2)))));R('#3f8a45',gx-w-1,gy+yy,2,1);R('#3f8a45',gx+w-1,gy+yy,2,1);}
  R('#e2d3a0',6,78,26,10);R('#e2d3a0',10,75,18,3);R('#e2d3a0',9,88,20,3);R('#cdbd88',8,86,22,2);
  R('#e2d3a0',132,14,20,7);R('#e2d3a0',136,11,12,3);R('#cdbd88',134,19,16,2);
  R('#7a3b32',0,0,52,7);R('#8f463a',0,7,48,3);R('#d9d0b8',2,10,44,7);R('#7a96b0',6,12,6,3);R('#7a96b0',18,12,6,3);R('#7a96b0',30,12,6,3);R('#4a3323',40,12,4,5);
  for(const [tx,ty] of [[62,6],[78,3],[96,7],[112,4],[150,40],[154,70],[60,95],[120,94]]){R('#1f4a26',tx-4,ty+3,9,3);R('#2a5a30',tx-4,ty-3,9,7);R('#2a5a30',tx-3,ty-5,7,2);R('#3a7a40',tx-2,ty-3,3,2);}
  // カップと旗
  R('#123',118,50,3,2);R('#e9eef0',119,36,1,15);R('#d83a3a',120,36,7,2);R('#d83a3a',120,38,5,2);R('#b02a2a',120,40,3,1);
  // 胴上げ
  const cx=78,cy=62,ph=(t*0.9)%1,h=Math.sin(Math.min(1,ph/0.85)*Math.PI)*17,up=ph<0.42;
  const ring=DG_PEOPLE.map((p,i)=>{const a=i/DG_PEOPLE.length*Math.PI*2+0.35;return {p,px:cx+Math.cos(a)*15,py:cy+Math.sin(a)*8,a};});
  const person=o=>{const {px,py,p}=o,lift=h<4?1:0;
    R('rgba(0,0,0,.22)',px-2,py+5,5,2);
    R(p[1],px-1,py,3,5);R('#3a3a3a',px-1,py+5,1,2);R('#3a3a3a',px+1,py+5,1,2);
    const dx=Math.sign(cx-px)||1,ay=py-(lift?3:1);R('#d9a37a',px-2,ay,1,3);R('#d9a37a',px+2,ay,1,3);
    if(lift){R('#d9a37a',px-2+dx,ay-1,1,1);R('#d9a37a',px+2+dx,ay-1,1,1);}
    R('#d9a37a',px-1,py-3,3,3);R(p[0],px-1,py-4,3,2);};
  for(const o of ring.filter(o=>o.py<cy))person(o);
  const sw=Math.max(4,13-h*0.45);R('rgba(0,0,0,.28)',cx-sw/2,cy+1,sw,3);
  const hy=cy-4-h,rot=Math.sin(t*5)*0.6;
  R('#8a8676',cx+2,hy+1+rot,5,2);R('#8a8676',cx+2,hy-1-rot,5,2);R('#e9eef0',cx+7,hy+1+rot,2,2);R('#e9eef0',cx+7,hy-1-rot,2,2);
  R('#2c3e5c',cx-4,hy-1,7,4);R('#d9a37a',cx-5,hy-4-(up?1:0),2,3);R('#d9a37a',cx-5,hy+3+(up?1:0),2,3);
  R('#d9a37a',cx-7,hy-1,3,4);R('#5a4030',cx-9,hy-1,2,4);R('#4a3323',cx-8,hy+2,2,1);
  for(const o of ring.filter(o=>o.py>=cy))person(o);
  // 紙ふぶき
  if(!dgConf){dgConf=[];for(let i=0;i<46;i++)dgConf.push({x:Math.random()*W,y:Math.random()*H,v:10+Math.random()*16,s:Math.random()*6,c:['#ffd84a','#ff7a9a','#7ad0ff','#b8ff9a','#fff'][i%5]});}
  for(const f of dgConf){const fy=(f.y+t*f.v)%H,fx=f.x+Math.sin(t*2+f.s)*4;R(f.c,fx,fy,Math.floor(t*4+f.s)%2?2:1,1);}
  dgRaf=requestAnimationFrame(dgDraw);
}
function douageHTML(){setTimeout(()=>{cancelAnimationFrame(dgRaf);dgRaf=requestAnimationFrame(dgDraw);},0);return `<div class="dgwrap"><canvas id="dgcv" width="160" height="100"></canvas></div>`;}
function endingHTML(){
  const ok=G.passed;
  const hist=G.history.map(h=>h.mp?`<div>${weekLabel(h.week)} ${h.name}：${h.mp}</div>`:`<div>${weekLabel(h.week)} ${h.name}：${h.score}打 `+(h.target?`（目標${h.target+1}を切る）`:`${h.field}人中${h.rank}位`)+`</div>`).join('');
  clearSave();
  if(ok&&!G.hofDone){lsSet(LAST_KEY,JSON.stringify(G));}
  const P=calcPoints(G);
  if(!G.ptsDone){G.ptsDone=true;if(P.total){const m=loadMeta();m.pts+=P.total;saveMeta(m);}}
  const ptHTML=P.total?`<div class="ptbox"><div class="pt-t">🎁 引き継ぎポイント <b>＋${P.total}</b></div>${P.lines.map(l=>`<div>${l}</div>`).join('')}<div class="pt-s">タイトル画面の「引き継ぎ特典」で使える（いま ${loadMeta().pts}ポイント）</div></div>`:'';
  return `<div class="result ${ok?'win':''}"><h1>${ok?'🏆 プロテスト合格！':G.fired?'研修生をクビになった…':'プロへの道は閉ざされた…'}</h1>
  ${ok?douageHTML():''}
  <p>${ok?`${weekLabel(G.passWeek||G.week)}、プロテストに合格。${G.cont?'その後も研修生として腕を磨き、満を持してプロの世界へ。':'ついにプロゴルファーの仲間入り。'}素振りから始めたあの日が、遠い昔のようだ。`:G.fired?`${weekLabel(G.week)}の査定ラウンドで目標に届かず、ゴルフ場を去ることになった。`:'3年間の挑戦は実らなかった。だが、この経験はきっと次に生きる。'}</p>
  ${ptHTML}
  <p>${DIFFS[G.diff].name}（${DIFFS[G.diff].level}）　最終所持金：${yen(G.money)}</p>
  ${ok?hofFormHTML():''}
  ${scoreGraph()}
  <div class="stats">${statHTML()}</div>${chipsHTML()}<div class="log">${hist||'大会出場なし'}</div>
  <button class="big" onclick="view='title';render()">タイトルへ</button></div>`;
}
function hofFormHTML(){
  if(G.hofDone)return `<div class="hofbox done">🏛 「${G.hofName}」として殿堂入りした！<br><small>タイトル画面の「殿堂入り」で見られる</small></div>`;
  return `<div class="hofbox"><div class="pt-t">🏛 殿堂入り</div><p>名前を付けて、この選手を殿堂に残そう</p><input id="hofname" maxlength="12" placeholder="名前（12文字まで）" value=""><button class="big" onclick="addHof()">殿堂入りさせる</button></div>`;
}
function addHof(){
  const el=$('hofname');const nm=(el&&el.value.trim())||'名無しの研修生';
  const gb=gearBonus(G),hist=G.history.filter(x=>x.score),best=hist.length?Math.min(...hist.map(x=>x.score)):null;
  const fin=G.history.filter(h=>h.rank&&/最終/.test(h.name)).pop();
  const l=loadHof();l.unshift({name:nm,stats:Object.fromEntries(STAT_KEYS.map(k=>[k,Math.round(G.stats[k]+(gb[k]||0))])),skills:G.skills.slice(),skillLv:G.skillLv||{},negs:(G.negs||[]).slice(),diff:G.diff,week:G.passWeek||G.week,best,rank:G.passRank||(fin?fin.rank:null),date:new Date().toLocaleDateString('ja-JP')});
  saveHof(l);G.hofDone=true;G.hofName=nm;lsDel(LAST_KEY);render();
}
let hofDel=-1;
function hofHTML(){
  const l=loadHof();
  const card=(x,i)=>{const tot=Math.round(STAT_KEYS.reduce((a,k)=>a+x.stats[k],0)/6);
    return `<div class="hofc"><div class="hh"><b>${x.name}</b><span class="rk ${rankCls(tot)}">総合 ${rankOf(tot)}</span></div>
    <div class="hm">${DIFFS[x.diff].level}・${weekLabel(x.week)}に合格${x.rank?`・最終${x.rank}位`:''}${x.best?`・ベスト${x.best}`:''}</div>
    <div class="hs">${STAT_KEYS.map(k=>`<div><small>${STAT_NAMES[k]}</small><b class="${rankCls(x.stats[k])}">${rankOf(x.stats[k])}</b><em>${x.stats[k]}</em></div>`).join('')}</div>
    ${x.skills.length||(x.negs||[]).length?skCards(x.skills,x.skillLv,x.negs,[]):''}
    <div class="hd"><small>${x.date}${x.wins?`　🏆対抗戦 ${x.wins}勝`:''}</small><button class="pickb ${cupPick.includes(i)?'on':''}" onclick="togglePick(${i})">${cupPick.includes(i)?'✓ 出場':'対抗戦に出す'}</button><button class="del" onclick="delHof(${i})">${hofDel===i?'本当に消す？':'消す'}</button></div>
    <button class="ghost tourb" onclick="tourGo(${i})">🏌️ ${tourIsOn(x)?'ツアーのつづき':'ツアーに出る'}${x.tourBest?`<small>最高賞金 ${x.tourBest.toLocaleString()}万円</small>`:''}</button></div>`;};
  return `<div class="top"><div class="wk">🏛 殿堂入り</div><div class="money">${l.length}人</div></div>
  <button class="ghost backtop" onclick="hofDel=-1;view='title';render()">‹ タイトルに戻る</button>
  ${lastHofHTML()}
  ${l.length?`<div class="cupbox"><b>⛳ 殿堂入り対抗戦</b><small>4人で18ホールを回って競う。出す選手を4人まで選べる（選ばなければ上から順に出場）。足りない分は同じくらいの強さの相手が入る。</small><button class="big" onclick="startCup()">対抗戦を始める（${cupPick.length?cupPick.length+'人を選択中':'おまかせ'}）</button></div>`:''}
  ${l.length?l.map(card).join(''):'<p class="lead">まだ誰もいない。プロテストに合格すると、エンディングで殿堂入りさせられる。</p>'}
  <button class="big" onclick="hofDel=-1;view='title';render()">タイトルに戻る</button>`;
}
function lastHofHTML(){let s=null;try{s=JSON.parse(lsGet(LAST_KEY));}catch(e){}if(!s||!s.passed||s.hofDone)return '';
  return `<div class="hofbox"><div class="pt-t">最後に合格した選手（${DIFFS[s.diff].level}・${weekLabel(s.week)}に合格）</div><p>まだ殿堂入りしていない。名前を付けて残そう</p><input id="hofname" maxlength="12" placeholder="名前（12文字まで）"><button class="big" onclick="addLastHof()">殿堂入りさせる</button></div>`;}
function addLastHof(){const g0=G;try{G=JSON.parse(lsGet(LAST_KEY));}catch(e){return;}if(!G){G=g0;return;}const v=view;addHof();G=g0;view=v;render();}
function delHof(i){if(hofDel!==i){hofDel=i;return render();}const l=loadHof();l.splice(i,1);saveHof(l);hofDel=-1;cupPick=[];render();}
// ---- 殿堂入り対抗戦 ----
let cupPick=[],cup=null;
function togglePick(i){const k=cupPick.indexOf(i);if(k>=0)cupPick.splice(k,1);else if(cupPick.length<4)cupPick.push(i);render();}
function startCup(){
  const l=loadHof();if(!l.length)return;
  const idx=(cupPick.length?cupPick:l.map((_,i)=>i).slice(0,4)).filter(i=>l[i]);
  const ps=idx.map(i=>({name:l[i].name,hof:i,p:{stats:l[i].stats,gear:{},skills:l[i].skills||[],skillLv:l[i].skillLv,negs:l[i].negs||[],fatigue:0},sc:[]}));
  const lv=ps.reduce((a,x)=>a+MAIN_KEYS.reduce((b,k)=>b+x.p.stats[k],0)/5,0)/ps.length;
  const nm=fieldNames(4);
  while(ps.length<4){const r=makeRival(lv+Math.random()*6-3);ps.push({name:nm[ps.length],npc:true,p:{stats:r.stats,gear:{},skills:[],fatigue:0},sc:[]});}
  const nA=ps.filter(x=>(x.p.negs||[]).includes('雨男')).length,nH=ps.filter(x=>(x.p.skills||[]).includes('晴れ男')).length;
  cup={ps,hole:0,done:false,wx:rollWeather({skills:nH>nA?['晴れ男']:[],negs:nA>nH?['雨男']:[]})};view='cup';render();window.scrollTo(0,0);
}
function cupHole(){const i=cup.hole,[par,y]=COURSE[i];for(const x of cup.ps){const s=playHole(x.p,par,y,'normal',{pressure:holePressure(0.5,i),hole:i,carry:x.c||0,wx:cup.wx}).strokes;x.sc.push(s);x.c=carryAfter(x.p,par,s);}cup.hole++;if(cup.hole>=18)cupEnd();}
function cupNext(){if(cup.done)return;cupHole();render();}
function cupAll(){while(!cup.done)cupHole();render();}
function cupEnd(){
  cup.done=true;const tot=x=>x.sc.reduce((a,b)=>a+b,0);const best=Math.min(...cup.ps.map(tot));
  // 同点なら最終ホールから数えて良いほうが勝ち（カウントバック）
  const top=cup.ps.filter(x=>tot(x)===best).sort((a,b)=>{for(let i=17;i>=0;i--)if(a.sc[i]!==b.sc[i])return a.sc[i]-b.sc[i];return 0;});
  cup.win=top[0];cup.tie=top.length>1;
  if(cup.win.hof!=null){const l=loadHof();if(l[cup.win.hof]){l[cup.win.hof].wins=(l[cup.win.hof].wins||0)+1;saveHof(l);}}
}
function cupHTML(){
  const n=cup.hole,par=COURSE.slice(0,n).reduce((a,c)=>a+c[0],0),tot=x=>x.sc.reduce((a,b)=>a+b,0);
  const nmOf=d=>({'-3':'アルバトロス','-2':'イーグル','-1':'バーディー','0':'パー','1':'ボギー','2':'ダボ','3':'トリプル'}[d]||'+'+d);
  const order=cup.ps.slice().sort((a,b)=>tot(a)-tot(b)||(cup.done?(a===cup.win?-1:b===cup.win?1:0):0));
  const rows=order.map((x,i)=>{const last=n?x.sc[n-1]-COURSE[n-1][0]:null;
    return `<tr class="${cup.done&&x===cup.win?'me':''}"><td>${n?(i+1)+'位':'-'}</td><td>${x.npc?'':'🏛 '}${x.name}</td><td class="${last<0?'good':last>0?'bad':''}">${n?nmOf(last):''}</td><td>${n?tot(x):'-'}</td><td>${n?toPar(tot(x)-par):''}</td></tr>`;}).join('');
  const card=cup.done?cup.ps.map(x=>`<div class="cupcard"><b>${x.npc?'':'🏛 '}${x.name}</b><div class="card">${[0,1].map(hf=>`<div class="row">${x.sc.slice(hf*9,hf*9+9).map((s,j)=>{const p=COURSE[hf*9+j][0];return `<div class="cell"><small>${hf*9+j+1}</small><span class="${s<p?'good':s>p?'bad':''}">${s}</span></div>`;}).join('')}</div>`).join('')}</div></div>`).join(''):'';
  return `<div class="top"><div class="wk">⛳ 殿堂入り対抗戦</div><div class="money">${WX[cup.wx].icon}${cup.done?'終了':n?n+'番まで':'スタート前'}</div></div>
  ${stageHTML('round',{big:true})}
  ${cup.done?`<div class="banner skill cupban">🏆 優勝：${cup.win.name}${cup.tie?'（同点・終盤の成績で決着）':''}</div>`:n?`<h2 class="rt">${n}番 パー${COURSE[n-1][0]} を終えて</h2>`:`<h2 class="rt">4人で18ホールの勝負！</h2>`}
  <div class="board cupb"><table><tr class="hd"><td>順位</td><td>名前</td><td>${n?n+'番':''}</td><td>計</td><td></td></tr>${rows}</table></div>
  ${cup.done?`${cup.win.hof!=null?'<p class="lead">優勝は殿堂の記録に残る。</p>':''}<button class="big" onclick="startCup()">もう一度</button><button class="ghost" onclick="view='hof';render();window.scrollTo(0,0)">殿堂入りに戻る</button>${card}`
    :`<button class="big" onclick="cupNext()">${n?'次のホールへ':'1番ホールへ'}</button><button class="ghost" onclick="cupAll()">最後までおまかせ</button><button class="ghost" onclick="view='hof';render()">やめる</button>`}`;
}
function metaHTML(){
  const m=loadMeta();
  return `<div class="top"><div class="wk">引き継ぎ特典</div><div class="money">${m.pts}ポイント</div></div>
  <button class="ghost backtop" onclick="resetAsk=false;view='title';render()">‹ タイトルに戻る</button>
  <p class="lead">プロテストに合格すると、合格の早さと最終予選の順位に応じてポイントがもらえる。ポイントで特典を買うと、<b>次に新しく始めるゲームから</b>ずっと効果がある。</p>
  ${META_ITEMS.map(it=>{const l=m.lv[it.id]||0,full=l>=it.max,c=metaCost(it,l);
    return `<button class="act ${l?'cur':''}" ${full||m.pts<c?'disabled':''} onclick="buyMeta('${it.id}')"><b>${it.name}　${'★'.repeat(l)}${'☆'.repeat(it.max-l)}</b><span class="cost">${full?'最大':c+'ポイント'}</span><span class="desc">${it.desc}${it.max>1?'（1段階ごと）':''}</span></button>`;}).join('')}
  ${metaSpent(m)?`<button class="ghost" onclick="resetMeta()">${resetAsk?`⚠ 本当にリセット？ もう一度押すと${metaSpent(m)}ポイント戻る`:`↺ 割り振りをリセット（${metaSpent(m)}ポイントが戻る）`}</button>`:''}
  <button class="big" onclick="view='title';render()">タイトルに戻る</button>`;
}
let resetAsk=false;
function resetMeta(){const m=loadMeta(),t=metaSpent(m);if(!t)return;if(!resetAsk){resetAsk=true;render();return;}resetAsk=false;m.pts+=t;m.lv={};saveMeta(m);render();}
function buyMeta(id){resetAsk=false;const m=loadMeta(),it=META_ITEMS.find(x=>x.id===id),l=m.lv[id]||0,c=metaCost(it,l);if(l>=it.max||m.pts<c)return;m.pts-=c;m.lv[id]=l+1;saveMeta(m);render();}
render();
cloudInit();
