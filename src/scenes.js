// ===== 場面のドット絵（1マス＝2単位、横160×縦75マス。地面は縦64マス目から） =====
const R=(x,y,w,h,c,extra)=>`<rect x="${x*2}" y="${y*2}" width="${w*2}" height="${h*2}" fill="${c}" ${extra||''}/>`;
const PAL={K:'#1c1a17',H:'#4a3b2a',h:'#6b5640',S:'#d9a37a',s:'#b07d58',B:'#9c7559',M:'#3b2c22',E:'#1c1a17',T:'#26374d',t:'#3a5273',C:'#e4dfd0',P:'#77715f',p:'#5c574a',W:'#e4dfd0',g:'#8d8d8d',w:'#f4f1e6'};
// ハンチング帽に無精ひげの渋い男（右向き）
const HEAD=[
'....HHHHHH....',
'...HHhhhHHH...',
'..HHHHHHHHHH..',
'..HHHHHHHHHHHH',
'..KKSSSSSSS...',
'..KSSSSSEES...',
'..KSsSSSSSSS..',
'...SsSSSMMM...',
'...BBBBSSS....',
'....BBBBB.....',
'.....sSS......'];
const HEAD_BARE=[
'....KKKKKK....',
'...KKKKKKKK...',
'..KKgKKKKKKK..',
'..KgKKKKKKK...',
'..KKSSSSSSS...',
'..KSSSSSEES...',
'..KSsSSSSSSS..',
'...SsSSSMMM...',
'...BBBBSSS....',
'....BBBBB.....',
'.....sSS......'];
const TORSO=[
'...CTTTTTC....',
'..TTTTTTTTT...',
'..TTtTTTTTT...',
'..TTtTTTTTT...',
'..TTtTTTTTT...',
'..TTTTTTTTT...',
'..TTTTTTTTT...',
'..TTTTTTTTT...',
'..KKKKKgKKK...'];
const LEGS1=[
'..PPPPPPPPP...',
'..PPPPPPPPP...',
'..PPPP.PPPP...',
'..PPPP.PPPP...',
'..PPP...PPP...',
'..PPP...PPP...',
'.PPP....PPP...',
'.PPP....PPP...',
'.PPP.....PPP..',
'.PPP.....PPP..',
'.PPP.....PPP..',
'.PPP.....PPP..',
'.PPP.....PPP..',
'.WWW.....WWW..',
'WWWW.....WWWW.',
'KKKK.....KKKK.'];
const LEGS2=[
'..PPPPPPPPP...',
'..PPPPPPPPP...',
'...PPPPPPP....',
'...PPPpPPP....',
'...PPPpPPP....',
'....PPpPP.....',
'....PPpPP.....',
'....PPpPP.....',
'....PPpPP.....',
'....PPpPP.....',
'....PPpPP.....',
'....PPpPP.....',
'....PPpPP.....',
'....WWWWW.....',
'....WWWWWW....',
'....KKKKKK....'];
function drawMap(rows,ox,oy,pal){
  pal=pal||PAL;let h='';
  rows.forEach((row,y)=>{let x=0;while(x<row.length){const ch=row[x];if(ch==='.'){x++;continue;}let n=1;while(x+n<row.length&&row[x+n]===ch)n++;h+=R(ox+x,oy+y,n,1,pal[ch]);x+=n;}});
  return h;
}
function pxLine(x0,y0,x1,y1,c,th){
  let h='';const dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let err=dx-dy,x=x0,y=y0;
  for(let i=0;i<200;i++){h+=R(x,y,th,th,c);if(x===x1&&y===y1)break;const e2=2*err;if(e2>-dy){err-=dy;x+=sx;}if(e2<dx){err+=dx;y+=sy;}}
  return h;
}
// 腕とクラブの形（h=手の位置、c=クラブの先）
const POSES={
  A:{h:[8,21],c:[12,34]},B:{h:[2,18],c:[-7,13]},C:{h:[3,9],c:[12,1]},D:{h:[12,18],c:[21,13]},E:{h:[11,9],c:[3,1]},
  P0:{h:[8,21],c:[10,34]},Pb:{h:[7,21],c:[7,34]},Pt:{h:[9,21],c:[13,33]},
  I:{h:[11,20],c:[12,34]},N:{h:[7,22]},W1:{h:[9,21],legs:2},W2:{h:[5,21]},K1:{h:[12,16]},K2:{h:[12,19]}
};
const SY=28; // 立ち姿の上端（足元が64マス目）
function sprite(ox,pose,o){
  o=o||{};const p=POSES[pose];const legs=p.legs===2?LEGS2:LEGS1;const pal=o.pal?Object.assign({},PAL,o.pal):PAL;
  let h=drawMap(legs,ox,SY+20,pal)+drawMap(TORSO,ox,SY+11,pal)+drawMap(o.bare?HEAD_BARE:HEAD,ox,SY,pal);
  if(p.c){h+=pxLine(ox+p.h[0],SY+p.h[1],ox+p.c[0],SY+p.c[1],'#b9bcc0',1);h+=R(ox+p.c[0]-(p.c[0]>p.h[0]?0:1),SY+p.c[1]-1,2,2,'#3c4146');}
  h+=pxLine(ox+7,SY+13,ox+p.h[0],SY+p.h[1],pal.S,2)+R(ox+7,SY+13,2,3,pal.T)+R(ox+p.h[0],SY+p.h[1],2,2,pal.w);
  return h;
}
// コマ送り。同じ長さのボールの動きと合わせるため、切り替えの時刻は場面ごとに決め打ち
const SEQ={
  full:{dur:1.3,f:[['A',14],['B',14],['C',18],['B',4],['A',6],['D',8],['E',36]]},
  chip:{dur:1.3,f:[['A',20],['B',26],['A',10],['D',44]]},
  putt:{dur:1.3,f:[['P0',20],['Pb',26],['P0',10],['Pt',44]]},
  walk:{dur:0.5,f:[['W1',50],['W2',50]]},
  clerk:{dur:0.7,f:[['K1',50],['K2',50]]}
};
function seqCSS(){
  let css='';
  for(const n in SEQ){const s=SEQ[n];const poses=[...new Set(s.f.map(x=>x[0]))];
    for(const p of poses){let t=0,k='';for(const [id,d] of s.f){k+=`${t}%{opacity:${id===p?1:0}}`;t+=d;}k+=`100%{opacity:${s.f[0][0]===p?1:0}}`;
      css+=`@keyframes sq_${n}_${p}{${k}}.sq_${n}_${p}{animation:sq_${n}_${p} ${s.dur}s step-end infinite}`;}}
  return css;
}
function animSprite(ox,seq,o){const poses=[...new Set(SEQ[seq].f.map(x=>x[0]))];return poses.map(p=>`<g class="sq_${seq}_${p}">${sprite(ox,p,o)}</g>`).join('');}
// ---- 背景の部品 ----
const SKYP=()=>R(0,0,160,20,'#34506e')+R(0,20,160,16,'#587892')+R(0,36,160,14,'#8fa6ab')+R(0,50,160,14,'#cfc39c')+R(74,21,10,12,'#e9c46a')+R(72,23,14,8,'#e9c46a');
const GRAY=()=>R(0,0,160,24,'#4a5563')+R(0,24,160,22,'#667280')+R(0,46,160,18,'#8a939b');
const GND=c=>R(0,64,160,11,c||'#4f7a45')+R(0,64,160,1,'#ffffff22');
const HILLS=(base,amp,c,ph)=>{let h='';for(let x=0;x<160;x+=4){const y=Math.round(base+amp*Math.sin((x+ph)/26));h+=R(x,y,4,64-y,c);}return h;};
const TREEP=(x,s)=>{const t=s>0.8?8:5;return R(x,64-t,2,t,'#4b3621')+R(x-4,64-t-7,10,8,'#2f5233')+R(x-3,64-t-10,8,3,'#2f5233')+R(x-2,64-t-9,3,3,'#3f6b42');};
const FLAGP=(x,y)=>R(x,y-16,1,16,'#d8d3c4')+R(x+1,y-16,6,2,'#b23a3a')+R(x+1,y-14,4,2,'#b23a3a')+R(x-2,y,5,1,'#1c1a17');
const ROOM=(wall,floor)=>R(0,0,160,64,wall)+R(0,62,160,2,'#00000022')+R(0,64,160,11,floor);
const WINDOW=(x,y)=>R(x,y,36,28,'#4b3621')+R(x+2,y+2,15,24,'#7f9cb0')+R(x+19,y+2,15,24,'#7f9cb0')+R(x+4,y+4,4,8,'#a9c0cc');
const BALL=(x,y,cls)=>R(x,y,2,2,'#f4f1e6',`class="ball ${cls||''}"`);
const TXT=(x,y,t,cls,d,size)=>`<text class="ptxt ${cls||''}" x="${x*2}" y="${y*2}" ${size?`font-size="${size}"`:''} style="animation-delay:${d||0}s">${t}</text>`;
const BUBBLE=(x,y,w,t)=>`<g class="bubble">${R(x,y,w,12,'#f4f1e6')+R(x+1,y-1,w-2,14,'#f4f1e6')+R(x+6,y+12,3,3,'#f4f1e6')}<text class="ptxt" x="${(x+w/2)*2}" y="${(y+9)*2}" text-anchor="middle" fill="#1c1a17" font-size="13">${t}</text></g>`;
const RAINP=()=>{let h='<g class="rain">';for(let i=0;i<18;i++)h+=R((i*23)%160,-10+(i*17)%40,1,4,'#cfd9e6',`style="animation-delay:${(i*0.11)%0.6}s"`);return h+'</g>';};
const MOUNT=(cx,top,c)=>{let h='';for(let i=0;i<10;i++)h+=R(cx-3-i*4,top+i*3,6+i*8,3,c);return h;};
const SCENES={
  swing:()=>ROOM('#b9ad8f','#6e5235')+WINDOW(104,10)+animSprite(53,'full')+TXT(84,26,'ブンッ','whoosh-t',0,18)+R(74,40,6,1,'#fff','class="whoosh"')+R(77,44,8,1,'#fff','class="whoosh"')+R(76,48,5,1,'#fff','class="whoosh"'),
  mat:()=>ROOM('#b9ad8f','#6e5235')+R(8,14,24,36,'#5a4230')+R(10,16,20,12,'#8c7b62')+R(10,32,20,14,'#6b563f')+R(30,62,104,3,'#4f7a45')+R(122,63,3,1,'#1c1a17')+animSprite(39,'putt')+BALL(51,61,'b-putt'),
  green:()=>SKYP()+GND('#6b9a55')+TREEP(14,1)+TREEP(150,0.7)+FLAGP(123,64)+animSprite(39,'putt')+BALL(51,62,'b-putt'),
  range:()=>SKYP()+GND('#3f6639')+[0,1,2,3,4,5].map(i=>R(100+i*11,6,1,58,'#ffffff30')).join('')+[0,1,2,3,4].map(i=>R(100,8+i*12,60,1,'#ffffff30')).join('')
    +R(84,56,12,7,'#e4dfd0')+TXT(90,62,'50','sign')+R(117,54,15,7,'#e4dfd0')+TXT(124.5,60,'100','sign')+R(34,63,42,2,'#2b4a2e')+animSprite(43,'full')+BALL(56,62,'b-fly'),
  approach:()=>SKYP()+GND()+R(92,64,60,3,'#6b9a55')+FLAGP(124,64)+TREEP(10,1)+animSprite(38,'chip')+BALL(51,62,'b-chip'),
  bunker:()=>SKYP()+GND()+R(14,64,78,6,'#c9b27c')+R(20,70,66,2,'#c9b27c')+R(14,64,78,1,'#ddc893')+R(108,64,46,3,'#6b9a55')+FLAGP(133,64)
    +animSprite(39,'chip')+`<g class="sand">${[[18,-26],[30,-14],[8,-34],[36,-24],[24,-38],[14,-18]].map(d=>R(53,62,1,1,'#ddc893',`style="--dx:${d[0]}px;--dy:${d[1]}px"`)).join('')}</g>`+BALL(52,62,'b-bunk'),
  short:()=>SKYP()+HILLS(54,5,'#5f8a50',10)+GND()+TREEP(20,1)+TREEP(100,0.7)+R(128,56,28,8,'#6b9a55')+FLAGP(141,56)+animSprite(43,'chip')+BALL(56,62,'b-chip far'),
  round:()=>SKYP()+HILLS(50,7,'#5f8a50',40)+GND()+TREEP(14,1)+TREEP(104,0.7)+TREEP(118,0.6)+R(134,50,24,14,'#6b9a55')+FLAGP(146,50)+animSprite(43,'full')+BALL(56,62,'b-fly'),
  lesson:()=>SKYP()+HILLS(50,7,'#5f8a50',40)+GND()+TREEP(118,0.7)+R(134,50,24,14,'#6b9a55')+FLAGP(146,50)
    +sprite(14,'K1',{pal:{T:'#7a2e22',t:'#9a4a3a',H:'#d8d3c4',h:'#f4f1e6',P:'#2b2b2b',p:'#1c1a17',M:'#8d8d8d',B:'#b9a48f',K:'#5a5a5a'}})+BUBBLE(4,8,46,'腰を回して！')+animSprite(52,'full')+BALL(65,62,'b-fly'),
  shrine:()=>SKYP()+GND('#8a7a5a')+TREEP(10,1.1)+TREEP(150,1)+R(70,22,64,4,'#a8302a')+R(66,19,72,3,'#1c1a17')+R(74,30,56,3,'#a8302a')+R(80,26,4,38,'#a8302a')+R(120,26,4,38,'#a8302a')+R(96,26,12,4,'#1c1a17')
    +R(92,52,20,12,'#6b4a2a')+R(90,50,24,3,'#4b3621')+`<g class="bob">${sprite(56,'N')}</g>`+BUBBLE(26,8,40,'頼みます'),
  play:()=>R(0,0,160,64,'#1b1830')+[[10,10],[40,6],[120,8],[146,14],[70,4]].map(p=>R(p[0],p[1],1,1,'#e9d9a0')).join('')+R(0,64,160,11,'#2a2633')
    +R(84,14,70,50,'#3a2f4a')+R(88,18,62,10,'#c4467a')+TXT(119,25.5,'カラオケ','sign w',0,11)+[0,1,2].map(i=>R(92+i*20,34,14,10,'#e9c46a')).join('')+R(110,50,14,14,'#2a2633')
    +`<g class="bob">${sprite(40,'N')}</g>`+R(50,SY+18,2,8,'#9a9da1')+R(49,SY+16,4,3,'#2b2b2b')+TXT(64,22,'♪','coin',0,18)+TXT(72,30,'♪','coin',0.5,15),
  job_conv:()=>ROOM('#c9c4b4','#8e8a7c')+R(5,10,56,52,'#77715f')+R(6,11,54,50,'#e8e4d6')+[0,1,2].map(r=>R(6,24+r*13,54,1,'#77715f')+[0,1,2,3,4].map(c=>R(9+c*10,15+r*13,7,9,['#a8502f','#3e6a8a','#c9a23a','#4f7a45','#7a4a6a'][(c+r)%5])).join('')).join('')
    +animSprite(88,'clerk')+R(74,50,78,15,'#2f5d8a')+R(74,50,78,2,'#4a7aaa')+R(118,41,17,9,'#2b2b2b')+R(120,43,8,4,'#6fa9b5')+BUBBLE(96,6,58,'いらっしゃいませ')+TXT(70,36,'￥','coin')+TXT(64,44,'￥','coin',0.6),
  job_range:()=>SKYP()+GND('#3f6639')+[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i=>R(i*10+5,6,1,58,'#ffffff26')).join('')+[18,37,75,96,118,136,151].map(x=>R(x,63,2,2,'#f4f1e6')).join('')
    +`<g class="walk">${animSprite(20,'walk')}${R(30,SY+21,8,6,'#a8502f')+R(31,SY+20,2,2,'#f4f1e6')+R(34,SY+20,2,2,'#f4f1e6')}</g>`+TXT(80,28,'￥','coin')+TXT(105,36,'￥','coin',0.6),
  job_caddie:()=>SKYP()+HILLS(52,6,'#5f8a50',70)+GND()+FLAGP(150,58)+animSprite(118,'chip')
    +`<g class="walk">${R(17,SY+12,5,19,'#4b3621')+R(18,SY+7,1,5,'#b9bcc0')+R(20,SY+6,1,6,'#b9bcc0')+R(17,SY+5,2,2,'#3c4146')+R(20,SY+4,2,2,'#3c4146')}${animSprite(20,'walk')}</g>`+TXT(72,26,'￥','coin'),
  rest:()=>R(0,0,160,64,'#232a3d')+R(0,64,160,11,'#3d2f22')+R(111,9,31,25,'#4b3621')+R(113,11,27,21,'#0f1728')+R(126,15,7,7,'#e9d9a0')+R(124,14,6,6,'#0f1728')
    +R(24,58,102,7,'#d8d3c4')+R(26,54,24,5,'#f4f1e6')+`<g transform="rotate(-90 78 103)">${drawMap(HEAD_BARE,32,46)}</g>`+R(45,51,79,12,'#3e5a80')+R(45,51,79,2,'#5a7aa3')
    +TXT(56,40,'Z','zzz',0,20)+TXT(64,32,'z','zzz',0.4,16)+TXT(70,25,'z','zzz',0.8,13),
  onsen:()=>R(0,0,160,22,'#2b3556')+R(0,22,160,14,'#5a4a6a')+R(0,36,160,12,'#b8735a')+R(0,48,160,16,'#e0a060')+MOUNT(40,22,'#3b4563')+MOUNT(112,16,'#333c58')+R(0,52,160,23,'#4a433a')
    +R(22,56,116,13,'#6fa9b5')+R(28,54,104,2,'#6fa9b5')+R(28,69,104,2,'#6fa9b5')+R(22,56,116,1,'#9ccbd4')
    +[[14,54,12,6],[30,50,10,5],[126,52,14,6],[112,49,9,5],[18,68,14,5],[124,69,16,5]].map(r=>R(r[0],r[1],r[2],r[3],'#6b6257')+R(r[0],r[1],r[2],1,'#857b6e')).join('')
    +drawMap(HEAD_BARE,73,46)+R(74,44,12,3,'#f4f1e6')+R(66,57,28,2,'#6fa9b5')+R(68,57,24,1,'#cfe6ea')
    +`<g class="steam">${[52,64,96,108].map((x,i)=>R(x,40,2,4,'#ffffff',`style="animation-delay:${i*0.35}s"`)+R(x+2,34,2,4,'#ffffff',`style="animation-delay:${i*0.35+0.2}s"`)).join('')}</g>`
    +R(8,8,14,14,'#7a3b2e')+TXT(15,19,'湯','sign w',0,16)+BUBBLE(98,26,34,'極楽…'),
  shop:()=>ROOM('#b9ad8f','#6e5235')+R(74,8,78,56,'#5a4230')+R(76,10,74,54,'#e8e4d6')+[0,1,2,3,4,5].map(i=>R(84+i*11,15,1,40,'#9a9da1')+R(83+i*11,54,4,3,i<2?'#2b2b2b':'#6b6e72')).join('')
    +R(5,9,46,12,'#2f4f38')+TXT(28,18,'ゴルフショップ','sign w',0,11)+`<g class="bob">${sprite(49,'N')}${R(57,SY+23,8,9,'#c9a23a')+R(59,SY+21,4,2,'#8a6d1f')}</g>`,
  idle:(o)=>(o.rain?GRAY():SKYP())+GND(o.rain?'#3f6639':'#4f7a45')+R(88,36,62,28,'#d8d0b8')+[0,1,2,3,4,5].map(i=>R(84+i*5,33-i*3,70-i*10,3,'#7a3b2e')).join('')+R(113,48,12,16,'#4b3621')+R(94,42,11,8,'#7f9cb0')+R(132,42,11,8,'#7f9cb0')
    +TREEP(12,1)+FLAGP(72,64)+`<g class="bob">${sprite(33,'I')}</g>`+(o.rain?RAINP():'')
};
function stageHTML(kind,opt){
  opt=opt||{};const f=SCENES[kind]||SCENES.idle;
  let fr='';
  if(opt.friends&&opt.friends.length&&typeof FRIENDS!=='undefined'&&!['job_conv','job_range','rest','onsen','shop','idle'].includes(kind)){
    opt.friends.slice(0,2).forEach((id,i)=>{const F=FRIENDS.find(x=>x.id===id);const x=kind==='job_caddie'?88+i*16:4+i*16;
      fr+=`<g class="bob">${sprite(x,'N',{pal:F.pal,bare:F.bare})}</g>`+(i===0?BUBBLE(Math.max(1,x-4),6,F.line.length*7+8,F.line):'');});
  }
  return `<div class="stage ${opt.big?'tall':''} ${opt.wide?'wide':''}">${opt.label?`<div class="slabel">${opt.label}</div>`:''}${opt.label2?`<div class="slabel l2">${opt.label2}</div>`:''}<svg viewBox="${opt.wide?'0 46 320 92':'0 0 320 150'}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">${f(opt)}${fr}</svg></div>`;
}
if(typeof document!=='undefined'){const st=document.createElement('style');st.textContent=seqCSS();document.head.appendChild(st);}
