// ===== 育成パート（お金・体力・練習・コーチ・飽き・大会日程） =====
const STAT_KEYS=['power','accuracy','approach','putt','recovery','mental'];
const MAIN_KEYS=['power','accuracy','approach','putt','recovery'];
const STAT_NAMES={power:'飛距離',accuracy:'正確性',approach:'アプローチ',putt:'パター',recovery:'リカバリー',mental:'メンタル'};
const HALF_NAMES=['平日','週末'];
const DIFFS={
  rich:{name:'裕福な家庭',level:'やさしい',desc:'毎月の仕送り10万円。一流コーチも雇える',start:200000,monthly:100000},
  normal:{name:'普通の家庭',level:'ノーマル',desc:'毎月の仕送り2万円。コーチ代はバイトで補う',start:50000,monthly:20000},
  poor:{name:'仕送りなし',level:'むずかしい',desc:'仕送りゼロ。すべて自分で稼ぐ',start:10000,monthly:0}
};
const COACHES=[
  {name:'なし（自己流）',fee:0,desc:'球を打つ練習がほとんど身につかない'},
  {name:'レッスンプロ',fee:20000,ball:1.0,solo:1.0,desc:'球を打つ練習がちゃんと身につく'},
  {name:'一流コーチ',fee:60000,ball:1.3,solo:1.15,desc:'すべての練習の伸びが大きくなる'}
];
const BOOKS=[
  {id:'swing',name:'教本「スイングの基本」',price:8000,stats:['power','accuracy']},
  {id:'short',name:'教本「寄せとバンカーの教科書」',price:8000,stats:['approach','recovery']},
  {id:'putt',name:'教本「パッティングの極意」',price:8000,stats:['putt']},
  {id:'mental',name:'教本「勝負に強くなる心の作り方」',price:8000,stats:['mental']}
];
const BOOK_MULT=1.25;
const avgOf=(G,ks)=>ks.reduce((s,k)=>s+G.stats[k],0)/ks.length;
// cost:[平日,週末] null=その日はできない / out=屋外（雨だとできない）/ solo=コーチなしでも身につく
// fall=[a,b] 能力がaを超えると効果半減、bを超えるとほぼ無し（初心者向けの練習）
// req=基礎が足りないと効果が激減する条件
const ACTIONS=[
  {id:'swing',name:'素振り',cost:[0,0],st:-6,gain:{power:2.1,accuracy:1.1},cat:'練習',solo:true,desc:'タダ。地味だがいつでも効果がある'},
  {id:'mat',name:'家でパターマット',cost:[0,0],st:-4,gain:{putt:2.4},cat:'練習',solo:true,desc:'タダ。パターは自己流でも伸ばしやすい'},
  {id:'range',name:'打ちっぱなし',cost:[2000,3000],st:-10,gain:{power:2.8,accuracy:1.6},cat:'練習',
    req:G=>G.stats.power>=12,reqMult:0.3,reqMsg:'まだ球に当たらない（素振りで飛距離12まで）'},
  {id:'approach',name:'アプローチ練習場',cost:[2500,3500],st:-10,gain:{approach:2.8,putt:0.7},cat:'練習',out:true,
    req:G=>G.stats.accuracy>=10,reqMult:0.4,reqMsg:'まだ狙って打てない（正確性10まで）'},
  {id:'bunker',name:'バンカー練習',cost:[2500,3500],st:-10,gain:{recovery:3,mental:0.7},cat:'練習',out:true,
    req:G=>G.stats.approach>=12,reqMult:0.4,reqMsg:'寄せの基礎が先（アプローチ12まで）'},
  {id:'short',name:'ショートコース',cost:[4000,7000],st:-12,gain:{accuracy:2.4,approach:1.5,putt:0.8,mental:0.5},cat:'練習',out:true,
    req:G=>avgOf(G,['power','accuracy','approach','putt'])>=18,reqMult:0.3,reqMsg:'コースに出るにはまだ早い'},
  {id:'round',name:'実戦ラウンド',cost:[12000,22000],st:-22,gain:{power:1.5,accuracy:1.5,approach:1.5,putt:1.5,recovery:1.5,mental:2},skill:0.04,cat:'練習',out:true,
    req:G=>avgOf(G,MAIN_KEYS)>=30,reqMult:0.3,reqMsg:'実戦で学ぶにはまだ早い（平均30から）',desc:'全部伸びる。特技を覚えることも'},
  {id:'lesson',name:'ラウンドレッスン',cost:[25000,35000],st:-22,gain:{power:2,accuracy:2,approach:2,putt:2,recovery:2,mental:1.5},cat:'練習',out:true,lesson:true,desc:'プロに付いてもらって回る。初心者でも全部が大きく伸びる'},
  {id:'komaza',name:'小技練習',cost:[2500,3500],st:-10,gain:{approach:2,recovery:2,putt:0.4,mental:0.4},cat:'練習',out:true,simple:true,
    req:G=>G.stats.accuracy>=10,reqMult:0.4,reqMsg:'まだ狙って打てない（正確性10まで）',desc:'アプローチとバンカーをまとめて練習'},
  {id:'job_conv',name:'コンビニのバイト',cost:[-9000,-8000],st:-10,gain:{},cat:'バイト',desc:'稼げるがゴルフは伸びない'},
  {id:'job_range',name:'練習場のバイト',cost:[-6000,null],st:-10,gain:{power:1.1,accuracy:0.7},cat:'バイト',desc:'平日だけ。閉店後にタダで打てる'},
  {id:'job_caddie',name:'キャディのバイト',cost:[null,-14000],st:-15,gain:{mental:1.2,approach:0.6,putt:0.6},skill:0.04,cat:'バイト',out:true,desc:'週末だけ。上手い人のプレーから学ぶ'},
  {id:'job_lesson',name:'レッスン補助のバイト',cost:[-11000,null],st:-12,gain:{approach:0.8,putt:0.6,mental:0.6},cat:'バイト',need:G=>avgOf(G,MAIN_KEYS)>=35,needMsg:'腕前が足りない（平均35から）',desc:'平日だけ。初心者に教えながら自分も学ぶ'},
  {id:'rest',name:'休養',cost:[0,0],st:35,gain:{},cat:'休む',desc:'体力が回復'},
  {id:'onsen',name:'温泉旅行',cost:[30000,38000],st:100,gain:{mental:1.5},skill:0.15,cat:'休む',turns:2,desc:'2日分使う。体力全回復、飽きも解消。たまに特技'},
  {id:'clinic',name:'通院・リハビリ',cost:[5000,6000],st:10,gain:{},cat:'休む',desc:'ケガを早く治す（ケガのときだけ）'},
  {id:'play',name:'遊びに行く',cost:[3000,5000],st:15,gain:{},cat:'おでかけ',desc:'気晴らし。調子が必ず1段階上がる'},
  {id:'shrine',name:'神社でお参り',cost:[0,0],st:0,gain:{},cat:'おでかけ',desc:'無料。おみくじ次第で調子が上がる'},
  {id:'shop',name:'買い物・コーチ探し',cost:[0,0],st:0,gain:{},cat:'おでかけ',desc:'1日使う。道具・教本・コーチ契約'}
];
const MODS=[
  {id:'rain',name:'☔ 雨',desc:'屋外の練習とキャディのバイトはできない',p:0.13},
  {id:'sale',name:'🏷 練習場の割引デー',desc:'打ちっぱなしが半額',p:0.07},
  {id:'shift',name:'📞 バイト先から急なシフトの頼み',desc:'コンビニのバイト代が1.5倍',p:0.06},
  {id:'invite',name:'⛳ 先輩からラウンドのお誘い',desc:'実戦ラウンドが半額',p:0.05},
  {id:'closed',name:'🚧 ショートコースが定休日',desc:'ショートコースは使えない',p:0.05}
];
const FRIENDS=[
  {id:'oni',name:'鬼塚',icon:'🧢',role:'元ツアープロの先輩研修生',acts:['swing','range','short','round'],skill:'飛ばし屋',bonus:'power',line:'振り切れ！',
   pal:{H:'#1c1a17',h:'#3a3a3a',T:'#2f4f38',t:'#3f6b42',P:'#2b2b2b',p:'#1c1a17'}},
  {id:'chi',name:'千夏',icon:'🎀',role:'パターの天才と呼ばれる同期',acts:['mat','komaza','approach','short'],skill:'ロングパット名人',bonus:'putt',line:'いい感じ！',bare:true,
   pal:{K:'#7a4a2a',g:'#9a6a4a',B:'#d9a37a',M:'#b05050',T:'#c46a7a',t:'#d88a98',P:'#e4dfd0',p:'#cfcabb'}},
  {id:'gen',name:'源さん',icon:'🧓',role:'この道40年のベテランキャディ',acts:['short','round','job_caddie'],skill:'ここ一番',bonus:'mental',line:'焦るな',
   pal:{H:'#d8d3c4',h:'#f4f1e6',B:'#cfcfcf',M:'#cfcfcf',T:'#6b5a3a',t:'#8a7650',P:'#4a4a3a',p:'#3a3a2e'}},
  {id:'sao',name:'早乙女',icon:'🎓',role:'名門大学ゴルフ部のライバル',acts:['approach','bunker','komaza','range','round'],skill:'バンカー巧者',bonus:'recovery',line:'負けない',
   pal:{H:'#2b3a6b',h:'#3e5294',B:'#d9a37a',M:'#b07d58',T:'#e8e4d6',t:'#cfcabb',P:'#2b3a6b',p:'#1f2a4f'}}
];
const COND=['絶不調','不調','普通','好調','絶好調'],COND_MULT=[0.7,0.85,1,1.15,1.3];
const CRIT_RATE=0.08;
const DOCTOR_SKILL='改造人間';
const SKILLS={'改造人間':'練習の伸びが1.2倍。そのかわりケガをしやすい（博士の手術でしか手に入らない）',
  'ここ一番':'プレッシャーで能力が下がりにくい','飛ばし屋':'ティーショットが伸びる','ロングパット名人':'5メートル以上のパットが入りやすい','バンカー巧者':'バンカーからのミスが減る',
  'タフ':'練習やバイトの体力消費が2割減る','早起き':'平日の練習の伸びが1割増える','節約上手':'練習にかかるお金が1割安くなる','集中力':'練習の大成功が2倍出やすい',
  '回復体質':'休養での体力回復が10増える','柔らかい体':'ケガをする確率が半分になる','人気者':'仲間との絆が1.5倍上がりやすい','飽きない心':'同じ練習を続けても飽きにくい',
  '立ち上がり◎':'試合の1〜3番ホールで全能力+5','上がり3ホール◎':'試合の16〜18番ホールで全能力+5','アイアン巧者':'グリーンに乗る確率が上がる','寄せワン':'アプローチがピンに寄りやすい',
  'OBなし':'ティーショットのOBが半分に減る','ショートパット◎':'2メートル以内のパットを外しにくい','パー5◎':'パー5のティーショットが15ヤード伸びる',
  '一気通貫':'【金特】試合の全ホールで全能力+3','小技の鬼':'【金特】寄せがもっと近くなり、2メートル以内のパットはほぼ外さない','精密機械':'【金特】グリーンに乗る確率がさらに上がり、OBは3割に減る',
  '鉄人':'【金特】練習やバイトの体力消費が3割減り、休養の回復が15増える','修練鬼':'【金特】練習の大成功が2.5倍出やすく、毎日の練習の伸びが1割増える','天気の申し子':'【金特】雨でも強風でも、天気のマイナスを一切受けず、試合で全能力+5',
  '勝負師':'早乙女とのマッチプレーで勝ち取った。試合でプレッシャーの影響が2割減り、16〜18番で全能力+3',
  '河童の末裔':'雨の試合で全能力+5','風読み':'強風の試合で能力が下がらず、正確性+4','晴れ男':'試合の日に雨と強風が半分しか出ない'};
// 仲間から教わる特技は絆に応じて小→中→大と強くなる
const SKILL_LV={'飛ばし屋':['ティーショット+5ヤード','ティーショット+10ヤード','ティーショット+16ヤード'],
  'ロングパット名人':['長いパットが少し入りやすい','長いパットが入りやすい','長いパットがかなり入りやすい'],
  'ここ一番':['プレッシャーの影響が4割減る','プレッシャーの影響が7割減る','プレッシャーで能力が下がらない'],
  'バンカー巧者':['バンカーのミスが少し減る','バンカーのミスが減る','バンカーのミスがほぼなくなる']};
const LV_NAME=['','小','中','大'];
function skillLabel(s,lv){const l=SKILL_LV[s]?((lv&&lv[s])||3):0;return l?`${s}（${LV_NAME[l]}）`:s;}
function skillDesc(s,lv){return SKILL_LV[s]?SKILL_LV[s][((lv&&lv[s])||3)-1]:SKILLS[s]||'';}
const hasSk=(G,s)=>G.skills.includes(s);
// 長く続く弱点（約12週で消える。温泉や大吉で早く消えることも）
const BADS={chance:{name:'チャンス×',desc:'試合でプレッシャーの影響が1.6倍になる'},slump:{name:'スランプ',desc:'練習の伸びが2割減る'},kega:{name:'ケガぐせ',desc:'ケガをする確率が1.5倍になる'},
  rouhi:{name:'浪費ぐせ',desc:'お金のかかる行動が15%高くなる'},yips:{name:'パットイップス',desc:'試合でパターが8下がる'},yofukashi:{name:'夜ふかし',desc:'体力の回復が3割減る'}};
const BAD_TURNS=24;
function hasBad(G,id){return !!(G.bad&&G.bad[id]>0);}
function addBad(G,id){G.bad=G.bad||{};const had=G.bad[id]>0;G.bad[id]=BAD_TURNS;return `💀 弱点「${BADS[id].name}」が${had?'長引いてしまった':'ついてしまった'}…（${BADS[id].desc}。約12週で消える）`;}
function cureBad(G){const ks=Object.keys(G.bad||{}).filter(k=>G.bad[k]>0);if(!ks.length)return '';const k=ks[Math.floor(Math.random()*ks.length)];delete G.bad[k];return `✨ 弱点「${BADS[k].name}」が消えた！`;}
const GEAR={
  driver:{slot:'ドライバー',items:[{name:'中古ドライバー',price:30000,bonus:{power:2}},{name:'最新ドライバー',price:80000,bonus:{power:4}}]},
  irons:{slot:'アイアン',items:[{name:'中古アイアンセット',price:40000,bonus:{accuracy:2}},{name:'新品アイアンセット',price:120000,bonus:{accuracy:4}}]},
  wedge:{slot:'ウェッジ',items:[{name:'中古ウェッジ',price:15000,bonus:{approach:2,recovery:1}},{name:'新品ウェッジ',price:35000,bonus:{approach:4,recovery:2}}]},
  putter:{slot:'パター',items:[{name:'中古パター',price:10000,bonus:{putt:2}},{name:'新品パター',price:30000,bonus:{putt:4}}]}
};
// トレーニング用品（一度買えばずっと効く）と消耗品
const ITEMS=[
  {id:'dumbbell',name:'ダンベル',price:12000,desc:'飛距離の伸びがずっと1.2倍'},
  {id:'stretch',name:'柔軟マット',price:9000,desc:'ケガをする確率がずっと4割減る'},
  {id:'net',name:'自宅用の練習ネット',price:25000,desc:'素振りの伸びがずっと1.3倍（家で球を打てる）'},
  {id:'pmat',name:'高級パターマット',price:15000,desc:'パターマット・パター練習の伸びがずっと1.3倍'},
  {id:'balance',name:'バランスボード',price:10000,desc:'正確性の伸びがずっと1.15倍'},
  {id:'sandbox',name:'バンカー練習用の砂袋',price:7000,desc:'リカバリーの伸びがずっと1.15倍'},
  {id:'range',name:'距離計',price:35000,desc:'正確性+2、アプローチ+2'},
  {id:'shoes',name:'ゴルフシューズ',price:18000,desc:'リカバリー+2、飛距離+1'},
  {id:'omamori',name:'必勝守り',price:5000,desc:'メンタル+3'},
  {id:'drink',name:'栄養ドリンク',price:1500,desc:'すぐに体力+15（何本でも買える）',use:true},
  {id:'shippu',name:'湿布と包帯',price:3000,desc:'ケガの治りが早まる（ケガのときだけ）',use:true}
];
const ITEM_MATCH={range:{accuracy:2,approach:2},shoes:{recovery:2,power:1},omamori:{mental:3}};
function hasItem(G,id){return !!(G.items&&G.items[id]);}
function itemMult(G,a,k){let m=1;
  if(k==='power'&&hasItem(G,'dumbbell'))m*=1.2;
  if(k==='accuracy'&&hasItem(G,'balance'))m*=1.15;
  if(k==='recovery'&&hasItem(G,'sandbox'))m*=1.15;
  if(a.id==='swing'&&hasItem(G,'net'))m*=1.3;
  if(a.id==='mat'&&hasItem(G,'pmat'))m*=1.3;
  return m;}
// ---- 日程（1年=48週、3年で144週）大会は週末、査定ラウンドは平日 ----
const TOTAL_WEEKS=144;
const Y1_EVENTS={
  19:{name:'早乙女とのマッチプレー',type:'mp',cost:0,pressure:0.3},
  10:{name:'ゴルフ場のビギナー杯',type:'amateur',cost:5000,pressure:0.1,field:30,level:15,prize:[8000,4000,2000]},
  16:{name:'初心者コンペ',type:'amateur',cost:8000,pressure:0.1,field:30,level:20,prize:[10000,5000,3000]},
  22:{name:'月例オープンコンペ',type:'amateur',cost:5000,pressure:0.15,field:40,level:26,prize:[30000,15000,8000]},
  28:{name:'研修生対抗戦',type:'amateur',cost:10000,pressure:0.2,field:30,level:29,prize:[20000,10000,5000]},
  40:{name:'市民ゴルフ大会',type:'amateur',cost:15000,pressure:0.2,field:40,level:37,prize:[30000,15000,8000]},
  47:{name:'年末チャリティーコンペ',type:'amateur',cost:10000,pressure:0.15,field:40,level:36,prize:[20000,10000,5000]}
};
// プロテストは1年目から毎年受けられる
for(const k of [34,39,44])if(!Y1_EVENTS[k])Y1_EVENTS[k]=null;
const BASE_EVENTS={
  19:{name:'早乙女とのマッチプレー',type:'mp',cost:0,pressure:0.3},
  4:{name:'春の研修生オープン',type:'amateur',cost:12000,pressure:0.25,field:50,level:47,prize:[30000,15000,8000]},
  10:{name:'市民ゴルフ大会',type:'amateur',cost:15000,pressure:0.2,field:40,level:45,prize:[30000,15000,8000]},
  22:{name:'県アマチュア選手権',type:'amateur',cost:30000,pressure:0.3,field:60,level:53,prize:[60000,30000,15000]},
  16:{name:'クラブ選手権',type:'amateur',cost:15000,pressure:0.3,field:50,level:52,prize:[40000,20000,10000]},
  28:{name:'月例オープンコンペ',type:'amateur',cost:8000,pressure:0.2,field:40,level:48,prize:[30000,15000,8000]},
  34:{name:'プロテスト 1次予選',type:'test',stage:1,cost:60000,pressure:0.4,field:120,level:48,pass:36},
  39:{name:'プロテスト 2次予選',type:'test',stage:2,cost:70000,pressure:0.6,field:90,level:60,pass:24},
  44:{name:'プロテスト 最終',type:'test',stage:3,cost:100000,pressure:0.8,field:100,level:70,pass:20}
};
const CHECK_TARGETS=[134,121,109,101,95,90,86,83,81,79,78]; // 12週ごと（これ以内でクリア）
function checkTarget(w){return w%12===0?CHECK_TARGETS[w/12-1]:undefined;}
function eventAt(w,half){
  if(half===0){const t=checkTarget(w);if(t)return {week:w,half:0,name:'研修生の査定ラウンド',type:'check',cost:0,pressure:0.4,target:t};return null;}
  const y=Math.floor((w-1)/48),ww=w-y*48;const e=(y===0?(Y1_EVENTS[ww]||(BASE_EVENTS[ww]&&BASE_EVENTS[ww].type==='test'?BASE_EVENTS[ww]:null)):BASE_EVENTS[ww]);
  return e?Object.assign({week:w,half:1,year:y+1},e):null;
}
// 1年目、後援会がいる状態で予選を通過すると、次の段階の費用を後援会が半分出してくれる
function evAt(G,w,h){const e=eventAt(w,h);if(e&&e.type==='check'&&G&&G.diff==='poor')e.target+=5; // 仕送りなしは査定の目標を5打ゆるめる
if(e&&e.type==='test'&&G&&G.passed)return null;if(e&&e.type==='test'&&e.year===1&&G&&G.testDisc&&G.testDisc[e.stage]){e.cost=G.testDisc[e.stage];e.disc=true;}return e;}
function curEvent(G){return evAt(G,G.week,G.half);}
function nextSlot(G){return G.half===0?[G.week,1]:[G.week+1,0];}
// 表示用のクラス名（S+とSSは記号が使えないので別名）
function rankCls(v){const r=rankOf(v);return r==='S+'?'rSP':r==='SS'?'rSS':'r'+r;}
function rankOf(v){return v>=120?'SS':v>=100?'S+':v>=80?'S':v>=70?'A':v>=60?'B':v>=50?'C':v>=40?'D':v>=30?'E':v>=20?'F':'G';}
function rollMod(){const r=Math.random();let acc=0;for(const m of MODS){acc+=m.p;if(r<acc)return m.id;}return null;}

function newGame(diff){
  const D=DIFFS[diff];
  return {diff,week:1,half:0,mod:null,money:D.start,stamina:100,
    stats:{power:5,accuracy:3,approach:3,putt:8,recovery:2,mental:15},
    gift1:true,gift2:true,gift3:true,gift4:true,gift5:true,gift6:true,gift7:true,gift8:true,gift9:true,owned:{},books:{},coach:0,bore:{},cond:2,bond:{},friendAt:{},skills:[],testStage:{1:0,2:0},pending:null,
    passed:false,fired:false,over:false,history:[]};
}
function gearBonus(G){const b={};for(const s in G.owned){const it=GEAR[s].items[G.owned[s]];for(const k in it.bonus)b[k]=(b[k]||0)+it.bonus[k];}for(const id in ITEM_MATCH)if(hasItem(G,id))for(const k in ITEM_MATCH[id])b[k]=(b[k]||0)+ITEM_MATCH[id][k];return b;}
const GROW=0.6;
function growMult(v){return GROW*(v<20?1:v<30?0.7:v<40?0.5:v<50?0.36:v<60?0.27:v<70?0.2:0.14);}
function coachMult(G,a,v){
  if(a.lesson)return G.coach===0?1:Math.max(1,COACHES[G.coach].ball);
  if(G.coach===0)return a.solo?1:(v<25?0.35:v<45?0.55:0.75);
  const c=COACHES[G.coach];return a.solo?c.solo:c.ball;
}
function boreMult(G,id){return Math.max(0.4,1-0.12*(G.bore[id]||0));}
function hasBook(G,k){return BOOKS.some(b=>G.books[b.id]&&b.stats.includes(k));}
// 練習1回あたりの倍率（能力ごと）
function practiceMult(G,a,k){
  const v=G.stats[k];let m=1;
  if(a.fall)m*=v<a.fall[0]?1:v<a.fall[1]?0.5:0.2;
  if(a.req&&!a.req(G))m*=a.reqMult;
  m*=coachMult(G,a,v);
  if(hasBook(G,k))m*=BOOK_MULT;
  m*=itemMult(G,a,k);
  m*=boreMult(G,a.id);
  return m;
}
// 画面に出す「効果」の目安と、低いときの理由
function effectOf(G,a){
  const k=Object.keys(a.gain)[0];if(!k||a.cat!=='練習')return null;
  const m=practiceMult(G,a,k);const v=G.stats[k];
  let why='';
  if(a.req&&!a.req(G))why=a.reqMsg;
  else if(a.fall&&v>=a.fall[0])why='もう物足りない練習になってきた';
  else if(!a.solo&&!a.lesson&&G.coach===0)why='自己流では身につきにくい';
  else if((G.bore[a.id]||0)>=2)why='同じ練習で飽きてきた';
  return {m,mark:m>=1.15?'◎':m>=0.75?'○':m>=0.4?'△':'×',why};
}
function addStats(G,gain,multFn){
  const out=[];
  for(const k in gain){const m=typeof multFn==='function'?multFn(k):multFn;const g=gain[k]*m*growMult(G.stats[k])*(0.8+Math.random()*0.4);G.stats[k]=Math.min(100,G.stats[k]+g);if(g>=0.25)out.push(`${STAT_NAMES[k]}+${g.toFixed(1)}`);}
  return out;
}
function costOf(G,a){
  let c=a.cost[G.half];if(c==null)return null;
  const m=G.mod;
  if(m==='rain'&&a.out)return null;
  if(m==='closed'&&a.id==='short')return null;
  if(a.turns===2){const [w,h]=nextSlot(G);if(w>TOTAL_WEEKS||eventAt(w,h))return null;}
  if(c<0&&a.cat==='バイト')c=Math.round(c*jobMult(G,a.id));
  if(c>0){let m2=1;if(a.cat==='練習'&&G.skills.includes('節約上手'))m2*=0.9;if(hasBad(G,'rouhi'))m2*=1.15;if(hasNeg(G,'浪費家'))m2*=1.1;if(m2!==1)c=Math.round(c*m2/100)*100;}
  if(m==='sale'&&a.id==='range')c=Math.round(c/2);
  if(m==='invite'&&a.id==='round')c=Math.round(c/2);
  if(m==='shift'&&a.id==='job_conv')c=Math.round(c*1.5);
  return c;
}
// バイトは続けると昇給（10回ごとに5%、最大15%増し）
function jobLv(G,id){return Math.min(3,Math.floor(((G.jobCnt||{})[id]||0)/10));}
function jobMult(G,id){return 1+0.05*jobLv(G,id);}
function unavailableReason(G,a){
  if(a.need&&!a.need(G))return a.needMsg;
  if(blockedByInjury(G,a))return 'ケガで今はできない';
  if(a.id==='clinic'&&!(G.injury>0))return 'ケガをしていない';
  if(a.cost[G.half]==null)return HALF_NAMES[G.half]+'はできない';
  if(G.mod==='rain'&&a.out)return '雨でできない';
  if(G.mod==='closed'&&a.id==='short')return '定休日';
  if(a.turns===2&&costOf(G,a)==null)return '明日は予定があって行けない';
  return '';
}
// 体力の消費量（特技「タフ」で2割減）。体力が足りない行動は選べない
function staminaCost(G,a){return a.st<0?Math.round(-a.st*(G.skills.includes('タフ')?0.8:1)*(G.skills.includes('鉄人')?0.7:1)*(hasNeg(G,'スタミナ不足')?1.1:1)):0;}
function restGain(G,a){let v=a.st+(a.id==='rest'&&hasSk(G,'回復体質')?10:0)+(a.id==='rest'&&hasSk(G,'鉄人')?15:0);if(hasBad(G,'yofukashi'))v=Math.round(v*0.7);return v;}
function tooTired(G,a){return G.stamina<staminaCost(G,a);}
// ケガ：体力が少ないときに無理をするとケガをする（パワプロ式）
function injuryRisk(G,a){if(a.st>=0||a.cat==='おでかけ'||a.id==='job_conv')return 0;const base=staminaCost(G,a)>=10?0.01:0;return Math.max(base,Math.min(0.7,(base+Math.max(0,60-G.stamina)*0.009*(staminaCost(G,a)/12))*(G.skills.includes(DOCTOR_SKILL)?1.6:1)*(hasItem(G,'stretch')?0.6:1)*(hasSk(G,'柔らかい体')?0.5:1)*(hasBad(G,'kega')?1.5:1)*(hasNeg(G,'ガラスの体')?1.3:1)));}
function blockedByInjury(G,a){return (G.injury||0)>0&&(a.cat==='練習'||a.id==='job_range'||a.id==='job_caddie');}
function canDo(G,a){if(a.need&&!a.need(G))return false;const c=costOf(G,a);if(a.id==='clinic'&&!(G.injury>0))return false;return c!=null&&(c<=0||G.money>=c)&&!tooTired(G,a)&&!blockedByInjury(G,a);}
// ずっと残るデメリット特性（温泉以外で特技を覚えるときにセットで付いてくる）
const NEGS={'ノミの心臓':'試合でプレッシャーの影響が1.4倍','寝坊ぐせ':'平日の練習の伸びが1割減る','浪費家':'お金のかかる行動が1割高い','ガラスの体':'ケガをする確率が1.3倍',
  '飽きっぽい':'同じ練習ですぐ飽きる','スタミナ不足':'練習やバイトの体力消費が1割増える','スロースターター':'試合の1〜3番ホールで全能力-5','終盤に弱い':'試合の16〜18番ホールで全能力-5',
  'OB癖':'ティーショットのOBが1.4倍','ショートパット×':'2メートル以内のパットを外しやすい','人見知り':'仲間との絆が上がりにくい（0.7倍）','短気':'調子が落ちやすい','雨男':'試合の日に66%で雨が降る','雨の日×':'雨の試合で全能力-5','風に弱い':'強風の試合で正確性とアプローチ-4'};
const hasNeg=(G,n)=>!!(G.negs&&G.negs.includes(n));
// 金特：青の特技2つがそろうと1つの金特に進化する
const GOLD={'一気通貫':['立ち上がり◎','上がり3ホール◎'],'小技の鬼':['寄せワン','ショートパット◎'],'精密機械':['アイアン巧者','OBなし'],'鉄人':['タフ','回復体質'],'修練鬼':['集中力','早起き'],'天気の申し子':['河童の末裔','風読み']};
function goldOf(s){for(const g in GOLD)if(GOLD[g].includes(s))return g;return null;}
function goldPair(s){const g=goldOf(s);return g?GOLD[g].find(x=>x!==s):null;}
function checkGold(G){const out=[];for(const g in GOLD){const [a,b]=GOLD[g];if(G.skills.includes(a)&&G.skills.includes(b)){G.skills=G.skills.filter(x=>x!==a&&x!==b);if(!G.skills.includes(g))G.skills.push(g);out.push(`🌟 金特に進化！「${a}」と「${b}」がそろって、金特「${g}」になった！（${SKILLS[g].replace('【金特】','')}）`);}}return out;}
function skillPool(G){const fs=FRIENDS.map(f=>f.skill);return Object.keys(SKILLS).filter(x=>x!==DOCTOR_SKILL&&x!=='勝負師'&&!GOLD[x]&&!fs.includes(x)&&!G.skills.includes(x)&&!(goldOf(x)&&G.skills.includes(goldOf(x)))&&!(x==='晴れ男'&&hasNeg(G,'雨男')));}
// 特技はランダムな3つの中から1つ選ぶ。温泉以外では、それぞれにデメリット特性が1つ付いてくる
function learnSkill(G,msgs,plain){
  if(G.skillOffer)return;const left=skillPool(G).sort(()=>Math.random()-0.5).slice(0,3);if(!left.length)return;
  const negs=Object.keys(NEGS).filter(n=>!hasNeg(G,n)&&!(n==='雨男'&&hasSk(G,'晴れ男'))).sort(()=>Math.random()-0.5);
  G.skillOffer=left.map((s,i)=>({s,n:plain?null:(negs[i]||null)}));
  msgs.push(plain?'★特技を覚えるチャンス！ 3つの中から1つ選べる（デメリットなし）':'★特技を覚えるチャンス！ ただし、どれにもデメリットが付いてくる…');
}
function pickSkill(G,i){const o=G.skillOffer;if(!o)return '';let x=o[i]||o[0];if(typeof x==='string')x={s:x,n:null};G.skillOffer=null;
  if(!G.skills.includes(x.s))G.skills.push(x.s);let m=`★特技「${x.s}」を覚えた！（${SKILLS[x.s]}）`;
  if(x.n){G.negs=G.negs||[];if(!G.negs.includes(x.n))G.negs.push(x.n);m+=`。そのかわり💀「${x.n}」がついた（${NEGS[x.n]}）`;}const gm=checkGold(G);if(gm.length)m+='\n'+gm.join('\n');return m;}
// 親友（絆100）は2人まで。3人目からは99で止まる
const BEST_MAX=2;
function bestCount(G){return FRIENDS.filter(f=>(G.bond[f.id]||0)>=100).length;}
function capBond(G,fid,v){const cur=G.bond[fid]||0;if(cur<100&&bestCount(G)>=BEST_MAX)v=Math.min(v,99);return Math.max(0,Math.min(100,v));}
function bondFloor(b){return b>=100?100:b>=65?65:b>=30?30:0;}
function fixSave(G){if(G.cond==null)G.cond=2;G.bond=G.bond||{};G.friendAt=G.friendAt||{};G.bad=G.bad||{};G.negs=G.negs||[];if(G.skills.includes('雨男')){G.skills=G.skills.filter(s=>s!=='雨男');if(!G.negs.includes('雨男'))G.negs.push('雨男');}if(!G.skillLv){G.skillLv={};for(const f of FRIENDS)if(G.skills.includes(f.skill))G.skillLv[f.skill]=3;}}
function condUp(G,n){G.cond=Math.max(0,Math.min(4,G.cond+n));}
// その日、仲間がどの練習に来ているか（ウマ娘のサポートカードのように毎ターン変わる）
function visibleActs(G){
  if(G.mode==='simple')return [G.stats.power>=12?'range':'swing','mat','komaza','short','round','lesson','job_caddie'];
  return ACTIONS.filter(a=>!a.simple&&(a.cat==='練習'||a.cat==='バイト')).map(a=>a.id);
}
function placeFriends(G){
  const at={};if(curEvent(G))return at;const vis=visibleActs(G);
  for(const f of FRIENDS){
    if(Math.random()>0.55)continue;
    const opts=f.acts.filter(id=>vis.includes(id)&&costOf(G,ACTIONS.find(a=>a.id===id))!=null);
    if(!opts.length)continue;const id=opts[Math.floor(Math.random()*opts.length)];(at[id]=at[id]||[]).push(f.id);
  }
  return at;
}
function friendsAt(G,id){return (G.friendAt&&G.friendAt[id])||[];}
function doAction(G,id){
  fixSave(G);
  const a=ACTIONS.find(x=>x.id===id);const msgs=[];
  if(!canDo(G,a))return ['今はできない…'];
  const c=costOf(G,a);G.money-=c;const risk=injuryRisk(G,a);const inj0=G.injury||0;const fr0=friendsAt(G,id);
  const money=c>0?`（−${c.toLocaleString()}円）`:c<0?`（＋${(-c).toLocaleString()}円）`:'';
  {
    const fr=friendsAt(G,id),frM=1+0.4*fr.length,pr=a.cat==='練習';
    const crit=pr&&Math.random()<CRIT_RATE*(hasSk(G,'集中力')?2:hasSk(G,'修練鬼')?2.5:1);
    const cm=pr?COND_MULT[G.cond]*(G.skills.includes(DOCTOR_SKILL)?1.2:1)*(G.growBonus||1)*(G.half===0&&hasSk(G,'早起き')?1.1:1)*(hasSk(G,'修練鬼')?1.1:1)*(hasBad(G,'slump')?0.8:1)*(G.half===0&&hasNeg(G,'寝坊ぐせ')?0.9:1)*(G.miniBonus||1):1;G.miniBonus=null;
    const g=addStats(G,a.gain,pr?(k=>practiceMult(G,a,k)*cm*frM*(crit?2:1)):frM);
    const with_=fr.length?`（${fr.map(f=>FRIENDS.find(x=>x.id===f).name).join('・')}と一緒）`:'';
    if(crit)msgs.push('★大成功！ 手ごたえが違う！');
    msgs.push(`${a.name}${with_}${money}`+(g.length?'：'+g.join('、'):pr?'：ほとんど身にならなかった…':''));
    for(const fid of fr){
      const f=FRIENDS.find(x=>x.id===fid),b0=G.bond[fid]||0,b1=capBond(G,fid,b0+Math.round((5+Math.floor(Math.random()*4))*(hasSk(G,'人気者')?1.5:1)*(hasNeg(G,'人見知り')?0.7:1)*(fid==='gen'?0.6:1)));G.bond[fid]=b1;G.metWith=G.metWith||{};G.metWith[fid]=G.week;G.decayMsg=G.decayMsg||{};G.decayMsg[fid]=0;
      if(b0<100&&b1>=100)msgs.push(`💞 ${f.name}と親友になった！${bestCount(G)>=BEST_MAX?'（親友はもう増やせない。ほかの仲間の絆は99で止まる）':'（親友はあと1人まで）'}`);
      const need=b1>=100?3:b1>=65?2:b1>=30?1:0,cur=G.skills.includes(f.skill)?(G.skillLv[f.skill]||3):0;
      if(need>cur){
        G.skillLv[f.skill]=need;if(!G.skills.includes(f.skill))G.skills.push(f.skill);
        const gg=addStats(G,{[f.bonus]:1+need,mental:0.5+need*0.5},1);
        msgs.push(`★★ ${f.name}との絆が深まった（${need}段階目）！ 特技「${f.skill}（${LV_NAME[need]}）」${cur?'に強くなった':'を教わった'}（${SKILL_LV[f.skill][need-1]}）。${gg.join('、')}`);
      }
    }
    if(a.cat==='練習'){const e=effectOf(G,a);if(e&&e.why&&e.m<0.75)msgs.push(`（${e.why}）`);}
    if(a.skill&&Math.random()<a.skill)learnSkill(G,msgs,id==='onsen');
  }
  if(a.cat==='練習')G.bore[id]=Math.min(6,(G.bore[id]||0)+(hasSk(G,'飽きない心')?2:3)+(hasNeg(G,'飽きっぽい')?1:0));
  if(a.cat==='バイト'){G.jobCnt=G.jobCnt||{};const l0=jobLv(G,id);G.jobCnt[id]=(G.jobCnt[id]||0)+1;const l1=jobLv(G,id);if(l1>l0)msgs.push(`💴 仕事ぶりが認められて昇給！（${a.name}のバイト代 ${l1*5}%アップ）`);}
  if(risk>0&&Math.random()<risk){G.injury=4+Math.floor(Math.random()*5);condUp(G,-1);msgs.push(`🤕 痛っ！ 無理がたたってケガをしてしまった…（治るまで約${Math.ceil(G.injury/2)}週。調子も落ちた）`);if(Math.random()<0.3)msgs.push(addBad(G,'kega'));}
  if(id==='clinic'){G.injury=Math.max(0,G.injury-3);msgs.push(G.injury?`通院した。だいぶ良くなってきた（あと約${Math.ceil(G.injury/2)}週）`:'通院した。ケガが治った！');}
  if(id==='rest'&&G.injury>0)G.injury=Math.max(0,G.injury-1);
  if(id==='play'){condUp(G,1);G.bore={};msgs.push(`${['カラオケで熱唱した','先輩と焼き肉に行った','映画を観て泣いた','ボウリングで盛り上がった'][Math.floor(Math.random()*4)]}。調子：${COND[G.cond]}、練習の飽きも消えた`);}
  if(id==='shrine'){const r=Math.random();const k=r<0.15?'大吉':r<0.55?'吉':r<0.85?'末吉':'凶';if(k==='大吉'){condUp(G,2);const c=cureBad(G);if(c)msgs.push(c);}else if(k!=='凶'&&k!=='末吉')condUp(G,1);else if(k==='末吉'&&Math.random()<0.5)condUp(G,1);
    msgs.push(`おみくじは「${k}」。${k==='凶'?'…気にしないことにした':''}調子：${COND[G.cond]}`);}
  if(id==='rest'&&Math.random()<0.35&&G.cond<2){condUp(G,1);msgs.push(`ぐっすり眠って気分が晴れた（調子：${COND[G.cond]}）`);}
  if(fr0.length&&Math.random()<0.2){condUp(G,1);msgs.push(`仲間と練習して気分が上がった（調子：${COND[G.cond]}）`);}
  if(id==='onsen'&&inj0>0){
    if(Math.random()<({rich:0.7,normal:0.45,poor:0.2}[G.diff]||0.45)){G.injury=0;msgs.push('♨ 湯治が効いた！ ケガがすっかり治った！');learnSkill(G,msgs,true);}
    else msgs.push('♨ 湯につかって痛みは和らいだが、ケガは治りきらなかった…');
  }
  if(id==='onsen'){G.bore={};condUp(G,1);msgs.push(`心も体もすっかりリフレッシュした（調子：${COND[G.cond]}）`);if(Math.random()<0.6){const c=cureBad(G);if(c)msgs.push(c);}}
  const st=a.st<0?-staminaCost(G,a):restGain(G,a);
  G.stamina=Math.max(0,Math.min(100,G.stamina+st));
  return msgs;
}
function signCoach(G,i){
  const c=COACHES[i];if(i===G.coach)return null;
  if(i===0){const old=COACHES[G.coach].name;G.coach=0;return `${old}との契約をやめた`;}
  if(G.money<c.fee)return null;
  G.money-=c.fee;G.coach=i;return `${c.name}と契約した（今月分 −${c.fee.toLocaleString()}円、以降は毎月初めに支払い）`;
}
function advanceTurn(G){
  const msgs=[];
  for(const k in G.bore){G.bore[k]=Math.max(0,G.bore[k]-1);}
  if(G.injury>0){G.injury--;if(G.injury===0)msgs.push('ケガが治った！ また練習できる');}
  msgs.push(...checkGold(G));
  for(const k in (G.bad||{})){if(G.bad[k]>0){G.bad[k]--;if(G.bad[k]<=0){delete G.bad[k];msgs.push(`✨ 弱点「${BADS[k].name}」を克服した！`);}}}
  if(G.cond===0&&!hasBad(G,'slump')&&Math.random()<0.12)msgs.push('絶不調が続いて…'+addBad(G,'slump'));
  if(G.half===0){G.half=1;}
  else{
    G.half=0;G.week++;
    if(G.week>(G.endWeek||TOTAL_WEEKS)){G.over=true;return msgs;}
    if(G.week%4===1){
      const mo=DIFFS[G.diff].monthly;
      if(mo>0){G.money+=mo;msgs.push(`仕送り＋${mo.toLocaleString()}円が届いた`);}
      if(G.patron){G.money+=10000;msgs.push('地元の後援会から支援金＋10,000円');}
      if(G.coach>0){const c=COACHES[G.coach];
        if(G.money>=c.fee){G.money-=c.fee;msgs.push(`${c.name}に今月の月謝 −${c.fee.toLocaleString()}円`);}
        else{G.coach=0;msgs.push(`月謝が払えず、${c.name}との契約が切れてしまった…`);}
      }
    }
    G.metWith=G.metWith||{};G.decayMsg=G.decayMsg||{};
    for(const f of FRIENDS){const b=G.bond[f.id]||0;if(!b||b>=100)continue;if(G.metWith[f.id]==null)G.metWith[f.id]=G.week;
      if(G.week-G.metWith[f.id]>4){const fl=bondFloor(b),nb=Math.max(fl,b-2);if(nb<b){G.bond[f.id]=nb;if(!G.decayMsg[f.id]){G.decayMsg[f.id]=1;msgs.push(`${f.icon} ${f.name}としばらく一緒に練習していない…絆が少しずつ下がり始めた`);}}}}
    if(G.week===49)msgs.push('— 2年目が始まった —');
    if(G.week===97){msgs.push('— 3年目。最後の年だ —');}
    if(G.week===49||G.week===97)G.testStage={1:0,2:0};
    const r=Math.random(),c0=G.cond;
    if(G.stamina<20&&Math.random()<0.4)condUp(G,-1);
    else if(r<(hasNeg(G,'短気')?0.2:0.12))condUp(G,-1);else if(r<0.24)condUp(G,1);
    if(G.cond!==c0)msgs.push(G.cond>c0?`↗ 調子が上がってきた（${COND[G.cond]}）`:`↘ 調子が落ちてきた…（${COND[G.cond]}）`);
  }
  const ev=curEvent(G);
  G.evWx=ev?rollWeather(G,ev):null;
  G.mod=ev?null:rollMod();
  fixSave(G);G.friendAt=placeFriends(G);
  G.pending=(!ev&&typeof rollRandomEvent==='function')?rollRandomEvent(G):null;
  return msgs;
}
function eligible(G,e){if(e.type!=='test'||e.stage===1)return true;return G.testStage[e.stage-1]===1;}
function playerForMatch(G){fixSave(G);if(curEvent(G)&&!G.evWx)G.evWx=rollWeather(G,curEvent(G));return {stats:G.stats,gear:gearBonus(G),skills:G.skills,skillLv:G.skillLv,negs:G.negs,bad:Object.keys(G.bad).filter(k=>G.bad[k]>0),fatigue:(G.stamina<30?(30-G.stamina)*0.3:0)-(G.cond-2)*2+(G.injury>0?8:0)};}
const SEI=['佐藤','鈴木','高橋','田中','伊藤','渡辺','山本','中村','小林','加藤','吉田','山田','佐々木','山口','松本','井上','木村','林','斎藤','清水','山崎','森','池田','橋本','阿部','石川','山下','中島','石井','小川','前田','岡田','長谷川','藤田','後藤','近藤','村上','遠藤','青木','坂本','福田','西村','太田','三浦','藤原','岡本','松田','中川','中野','原田'];
const MEI=['翔太','大輝','健太','拓也','亮','直樹','悠斗','蓮','颯太','大和','陸','翼','誠','剛','隼人','達也','和也','勇気','雄大','航','優斗','匠','慎吾','浩二','龍之介','一馬','光','賢治','聡','涼'];
function fieldNames(n){const used={},out=[];while(out.length<n){const nm=SEI[Math.floor(Math.random()*SEI.length)]+' '+MEI[Math.floor(Math.random()*MEI.length)];if(!used[nm]||out.length>SEI.length*MEI.length/2){used[nm]=1;out.push(nm);}}return out;}
// プロテストに毎年出てくる名前付きの選手（1次予選に全員出場し、勝ち残った人だけが次の段階へ進む）
const NAMED=[
  {name:'ミスターY',off:9},{name:'雉子谷犬丸',off:9},{name:'オーイ・トンボ',off:9},{name:'ロボビーム',off:9},{name:'プレデター',off:9},{name:'気天日明',off:9},{name:'沖田総介',off:9},
  {name:'芝目読男',off:9},{name:'信天翁一打',off:6},{name:'鷲尾イーグル',off:3},{name:'刻見守',off:1,steady:true},{name:'大林曲太郎',off:0,wild:true},{name:'池谷ポチャ子',off:-3,lucky:true},{name:'空振三振',off:-10}];
function namedScore(n,e,wx){
  const r=()=>playRoundAuto(makeRival(e.level+n.off+(Math.random()*4-2)),e.pressure,wx);
  if(n.steady)return Math.round((r()+r())/2);
  if(n.wild)return r()+Math.round(Math.random()*12-6);
  if(n.lucky&&Math.random()<0.15)return playRoundAuto(makeRival(e.level+12),e.pressure,wx);
  return r();
}
function namedEntrants(G,e){
  if(!G||e.type!=='test')return [];
  if(e.stage===1)return NAMED.filter(n=>!(G.namedPro||[]).includes(n.name));
  const alive=(G.namedAlive&&G.namedAlive.stage===e.stage-1&&G.namedAlive.week>=e.week-10)?G.namedAlive.names:[];
  return NAMED.filter(n=>alive.includes(n.name));
}
function makeField(e,wx,G){if(e.type==='check')return [];const nm=namedEntrants(G,e).slice(0,e.field-1);const rs=[];
  for(let i=0;i<e.field-1-nm.length;i++)rs.push(playRoundAuto(makeRival(e.level+(Math.random()*16-8)),e.pressure,wx));
  if(G)G._named=nm.map(n=>{const s=namedScore(n,e,wx);rs.push(s);return {name:n.name,score:s};});
  return rs.sort((a,b)=>a-b);}
function rivalLevel(G,e){const lv=Math.min(70,14+G.week*0.42);if(!G.mk2)return lv;if(e&&e.type==='test')return e.level+18;if(e&&e.level)return e.level+16;return Math.min(92,lv+18);}
function rivalName(G){return G.mk2?'🤖 早乙女markⅡ':'🎓 ライバル早乙女';}
function rivalScore(G,e){return playRoundAuto(makeRival(rivalLevel(G,e)),e.pressure,G.evWx);}
// 早乙女とのマッチプレー：1ホールごとに少ない打数のほうが勝ち
function mpFinish(G,up,played){
  const msgs=[],nm=G.mk2?'早乙女markⅡ':'早乙女';G.stamina=Math.max(0,G.stamina-15);
  if(up>0){msgs.push(`⛳ ${nm}とのマッチプレー：${up}アップで<b>勝った！</b>（${played}ホールで決着）`);
    if(!G.skills.includes('勝負師')){G.skills.push('勝負師');msgs.push(`★特技「勝負師」を勝ち取った！（${SKILLS['勝負師']}）`);}
    else{const up2=[];for(const k of STAT_KEYS){G.stats[k]=Math.min(100,G.stats[k]+1);up2.push(STAT_NAMES[k]+'+1');}msgs.push('勝負の経験で全ての能力が伸びた：'+up2.join('、'));}
    G.bond.sao=capBond(G,'sao',(G.bond.sao||0)+10);msgs.push(`${nm}との絆が深まった`);}
  else if(up<0){msgs.push(`⛳ ${nm}とのマッチプレー：${-up}ダウンで負けた…（${played}ホールで決着）`);msgs.push('負けた悔しさが頭から離れない…'+addBad(G,'chance'));G.bond.sao=capBond(G,'sao',(G.bond.sao||0)+5);}
  else{msgs.push(`⛳ ${nm}とのマッチプレー：18ホールを終えて引き分け`);G.bond.sao=capBond(G,'sao',(G.bond.sao||0)+5);}
  G.history.push({week:G.week,name:'早乙女とのマッチプレー',mp:up>0?'勝ち':up<0?'負け':'引き分け'});
  return msgs;
}
function mpAuto(G){const p=playerForMatch(G),o=makeRival(rivalLevel(G,null));let up=0,c1=0,c2=0,i=0;
  for(;i<18;i++){const [par,y]=COURSE[i];const a=playHole(p,par,y,'normal',{pressure:holePressure(0.3,i),hole:i,carry:c1,wx:G.evWx}).strokes,b=playHole(o,par,y,'normal',{pressure:holePressure(0.3,i),hole:i,carry:c2,wx:G.evWx}).strokes;c1=carryAfter(p,par,a);c2=carryAfter(o,par,b);up+=a<b?1:a>b?-1:0;if(Math.abs(up)>17-i){i++;break;}}
  return mpFinish(G,up,Math.min(18,i));}
// 試合の日の天気（晴れ55%・くもり20%・雨15%・強風10%。特性で変わる）
function rollWeather(G,ev){
  const ame=!!(G&&hasNeg(G,'雨男')),hare=!!(G&&hasSk(G,'晴れ男')),r=Math.random();
  // 研修生の査定：ふつうは晴れかくもり。雨男なら66%で雨。晴れ男なら必ず晴れ
  if(G&&ev&&ev.type==='check'){if(hare&&!ame)return 'sun';if(ame&&!hare)return r<0.66?'rain':(Math.random()<0.75?'sun':'cloud');return r<0.75?'sun':'cloud';}
  // そのほかの試合：ふつうは晴れ55%・くもり20%・雨15%・強風10%。雨男は雨66%、晴れ男は雨と強風が半分
  let rain=0.15,wind=0.10,cloud=0.20;
  if(ame&&!hare){rain=0.66;wind=0.04;cloud=0.08;}
  else if(hare&&!ame){rain*=0.5;wind*=0.5;}
  return r<rain?'rain':r<rain+wind?'wind':r<rain+wind+cloud?'cloud':'sun';
}
function rivalResult(G,e,score,msgs,field){
  const rs=rivalScore(G,e);
  if(G.mk2&&e.type!=='check'){const k=field.length-1;if(k>=0){field[k]=rs;field.sort((a,b)=>a-b);G.lastMk2=rs;}}
  if(score<rs){condUp(G,1);G.bond.sao=capBond(G,'sao',(G.bond.sao||0)+5);const g=addStats(G,{mental:1.5},1);msgs.push(`${rivalName(G)}は${rs}打。<b>勝った！</b> 調子が上がった、${g.join('')}`);G.rivalWin=(G.rivalWin||0)+1;}
  else if(score===rs)msgs.push(`${rivalName(G)}も${rs}打。引き分けだ`);
  else{const g=addStats(G,{mental:0.8},1);msgs.push(`${rivalName(G)}は${rs}打。負けた…悔しさが力になる（${g.join('')}）`);}
}
function finishEvent(G,e,score,field){
  fixSave(G);const msgs=[];
  G.stamina=Math.max(0,G.stamina-20);
  if(e.type==='check'){
    msgs.push(`査定ラウンド：スコア${score}（目標は${e.target+1}を切ること）`);
    if(score<=e.target){msgs.push('★査定クリア。研修生を続けられる');condUp(G,1);const g=addStats(G,{mental:2,accuracy:0.5,approach:0.5,putt:0.5},1);msgs.push(`本番の経験：${g.join('、')}`);}
    else if(G.cont)msgs.push('目標には届かなかった…が、もうプロテストには合格している。気を引き締めよう');
    else{G.fired=true;G.over=true;msgs.push('目標に届かなかった…研修生をクビになった');}
    G.history.push({week:G.week,name:e.name,score,target:e.target});
    return msgs;
  }
  G.lastMk2=null;const rmsg=[];rivalResult(G,e,score,rmsg,field);
  const rank=1+field.filter(s=>s<score).length;
  msgs.push(`${e.name}：スコア${score}、${e.field}人中${rank}位`);
  msgs.push(...rmsg);
  if(e.type==='amateur'){
    const mult=rank<=3?2:rank<=10?1.5:1;
    const g=addStats(G,{power:1,accuracy:1,approach:1,putt:1,recovery:1,mental:3},mult);
    msgs.push(`大会の経験：${g.join('、')}`);
    if(rank<=3)condUp(G,1);
    if(rank<=3&&!G.patron){G.patron=true;msgs.push('🤝 活躍が地元の新聞に載った！ 後援会ができ、毎月1万円の支援が届くことに');}
    if(rank===1)msgs.push('★優勝！ 大きな自信になった');
    if(rank===1){const up=[];for(const k of STAT_KEYS){const v=Math.round((0.8+Math.random()*0.6)*10)/10;G.stats[k]=Math.min(100,G.stats[k]+v);up.push(`${STAT_NAMES[k]}+${v}`);}msgs.push(`🏆 優勝の経験で全ての能力が伸びた：${up.join('、')}`);}
    if(e.prize&&rank<=3){const pz=e.prize[rank-1];G.money+=pz;msgs.push(`💰 ${rank}位の賞金（商品券）＋${pz.toLocaleString()}円`);}
    if(rank===1&&Math.random()<0.3)learnSkill(G,msgs);
    if(rank>e.field*0.75&&Math.random()<0.25)msgs.push('大たたきの記憶がこびりついて…'+addBad(G,'yips'));
  }else{
    const line=field[e.pass-1];
    if(G._named){const alive=G._named.filter(x=>x.score<=line).map(x=>x.name);G.namedAlive={stage:e.stage,week:e.week,names:alive};if(e.stage===3)G.namedPro=(G.namedPro||[]).concat(alive);}
    const allUp=(lo,w,txt)=>{const up=[];for(const k of STAT_KEYS){const v=Math.round((lo+Math.random()*w)*10)/10;G.stats[k]=Math.min(100,G.stats[k]+v);up.push(`${STAT_NAMES[k]}+${v}`);}msgs.push(`${txt}：${up.join('、')}`);};
    if(score<=line)allUp(rank===1?1.2:0.6,rank===1?0.6:0.5,rank===1?'🏆 トップ通過の自信で全ての能力が伸びた':'予選を勝ち抜いた経験で全ての能力が伸びた');
    msgs.push(`合格ライン：${line}（上位${e.pass}人）`);
    if(score<=line){
      if(e.stage===3){G.passed=true;G.over=true;G.passWeek=G.week;G.passRank=rank;msgs.push('★★★ プロテスト合格！！ ★★★');}
      else{G.testStage[e.stage]=1;msgs.push('★通過！ 次の段階に進める');
        if(G.patron&&e.year===1){const nx=eventAt(e.week+(e.stage===1?5:5),1);if(nx&&nx.type==='test'){const c=Math.round(nx.cost/2);G.testDisc=G.testDisc||{};G.testDisc[nx.stage]=c;
          msgs.push(`🎉 地元の後援会が大騒ぎ！「1年目で予選通過なんて天才だ！」と持て囃された。${nx.name}の費用${nx.cost.toLocaleString()}円のうち半分を後援会が出してくれることに（<b>${c.toLocaleString()}円</b>で受けられる）`);}}}
    }else{msgs.push('不合格…今年のプロテストはここまで');condUp(G,-1);if(Math.random()<0.35)msgs.push('大事な場面で崩れた悔しさが残り…'+addBad(G,'chance'));}
    addStats(G,{mental:2},1);
  }
  G.history.push({week:G.week,name:e.name,score,rank,field:e.field});
  return msgs;
}
// ===== 引き継ぎ特典（クリアでポイント → 次のゲームの初期状態を強化） =====
const META_ITEMS=[
  {id:'shot',name:'ショットの素質',desc:'最初の飛距離・正確性 +3',max:5,base:40,fn:(G,l)=>{G.stats.power+=3*l;G.stats.accuracy+=3*l;}},
  {id:'short',name:'小技の素質',desc:'最初のアプローチ・リカバリー +3',max:5,base:40,fn:(G,l)=>{G.stats.approach+=3*l;G.stats.recovery+=3*l;}},
  {id:'putt',name:'パターの素質',desc:'最初のパター +4',max:5,base:30,fn:(G,l)=>{G.stats.putt+=4*l;}},
  {id:'mental',name:'強い心',desc:'最初のメンタル +4',max:5,base:30,fn:(G,l)=>{G.stats.mental+=4*l;}},
  {id:'money',name:'へそくり',desc:'最初の所持金 +3万円',max:5,base:40,fn:(G,l)=>{G.money+=30000*l;}},
  {id:'grow',name:'練習の才能',desc:'練習の伸び +5%',max:4,base:100,fn:(G,l)=>{G.growBonus=1+0.05*l;}},
  {id:'bond',name:'顔なじみ',desc:'仲間全員との絆 +10 から始まる',max:3,base:50,fn:(G,l)=>{for(const f of FRIENDS)G.bond[f.id]=10*l;}},
  {id:'cond',name:'好調スタート',desc:'調子「好調」から始まる',max:1,base:60,fn:G=>{G.cond=3;}},
  {id:'tough',name:'特技「タフ」',desc:'特技「タフ」を持って始める（体力消費2割減）',max:1,base:250,fn:G=>{if(!G.skills.includes('タフ'))G.skills.push('タフ');}},
  {id:'mk2',name:'早乙女markⅡ',desc:'ライバル早乙女が、プロテストで上位3人に入るほどの強敵に生まれ変わる（0ポイント）',max:1,base:0,fn:G=>{G.mk2=true;}},
  {id:'book',name:'教本の引き継ぎ',desc:'教本「スイングの基本」を持って始める',max:1,base:60,fn:G=>{G.books.swing=1;}}
];
function metaCost(it,lv){return it.base*(lv+1);}
function metaSpent(meta){let t=0;for(const it of META_ITEMS){const l=meta.lv[it.id]||0;for(let i=0;i<l;i++)t+=metaCost(it,i);}return t;}
function applyMeta(G,meta){if(!meta||!meta.lv)return;for(const it of META_ITEMS){const l=meta.lv[it.id]||0;if(l)it.fn(G,l);}}
const DIFF_PT={rich:0.5,normal:1,poor:2};
function calcPoints(G){
  if(!G.passed)return {total:0,lines:[]};
  const last=G.history.filter(h=>h.rank&&/最終/.test(h.name)).pop();const r=G.passRank||(last?last.rank:20);const wk=G.passWeek||G.week;
  const base=100,speed=Math.max(0,TOTAL_WEEKS-wk)*2,rk=Math.max(0,21-r)*10,m=DIFF_PT[G.diff]||1;
  const total=Math.round((base+speed+rk)*m/2);
  return {total,lines:[`合格ボーナス ${base}`,`早さ（残り${Math.max(0,TOTAL_WEEKS-wk)}週） ${speed}`,`最終予選 ${r}位 ${rk}`,`難易度（${DIFFS[G.diff].level}）×${m}`,'合計を半分にして受け取り']};
}
if(typeof module!=='undefined') module.exports={mpAuto,checkGold,GOLD,capBond,rollWeather,NEGS,pickSkill,addBad,hasBad,SKILLS,FRIENDS,COND,STAT_NAMES,STAT_KEYS,MAIN_KEYS,DIFFS,ACTIONS,GEAR,BOOKS,COACHES,newGame,doAction,advanceTurn,curEvent,eventAt,eligible,playerForMatch,makeField,finishEvent,gearBonus,canDo,costOf,practiceMult,growMult,signCoach,avgOf,checkTarget};
