// ===== 試合エンジン（1打の結果を決める部分を独立させてある） =====
const COURSE=[[4,380],[4,410],[3,175],[5,520],[4,360],[4,430],[3,195],[5,545],[4,400],
              [4,390],[3,165],[4,420],[5,530],[4,370],[4,440],[3,200],[5,510],[4,415]];
const STRAT={
  attack:{name:'攻める',dist:12,acc:-0.10,pen:1.8,green:-0.04,prox:0.8,putt:1.12,leave:0.32,chip:2},
  normal:{name:'普通',dist:0,acc:0,pen:1,green:0,prox:1,putt:1,leave:0.15,chip:1},
  safe:{name:'刻む',dist:-30,acc:0.12,pen:0.4,green:0.03,prox:1.15,putt:0.9,leave:0.07,chip:0.5}
};
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function rnd(a,b){return a+Math.random()*(b-a);}
// 仲間の特技は小・中・大の3段階（段階の記録がない古いデータは大として扱う）
function skLv(p,s){if(!(p.skills&&p.skills.includes(s)))return 0;return (p.skillLv&&p.skillLv[s])||3;}
function effStat(p,key,ctx){
  let v=p.stats[key]+((p.gear&&p.gear[key])||0);
  const bad=p.bad||[],hs=s=>p.skills&&p.skills.includes(s),ng=s=>p.negs&&p.negs.includes(s);
  v*=1-ctx.pressure*(100-p.stats.mental)/100*0.25*[1,0.6,0.3,0][skLv(p,'ここ一番')]*(bad.includes('chance')?1.6:1)*(ng('ノミの心臓')?1.4:1)*(hs('勝負師')?0.8:1);
  if(p.fatigue) v-=p.fatigue;
  if(key==='putt'&&bad.includes('yips')) v-=8;
  if(ctx.carry&&key!=='mental'&&key!=='recovery') v+=ctx.carry;
  if(ctx.wx) v+=wxMod(p,key,ctx.wx);
  if(ctx.hole!=null){if(hs('一気通貫'))v+=3;if(ctx.hole>=15&&hs('勝負師'))v+=3;if(ctx.hole<3&&hs('立ち上がり◎'))v+=5;if(ctx.hole>=15&&hs('上がり3ホール◎'))v+=5;if(ctx.hole<3&&ng('スロースターター'))v-=5;if(ctx.hole>=15&&ng('終盤に弱い'))v-=5;}
  return Math.max(0,v);
}
// 100から先は伸びがゆるやかになり、130で世界一の飛ばし屋（平均331ヤード）と同じ
function driveDist(pw){return pw<30?120+pw*3.4:pw<=100?180+pw*1.4:320+(pw-100)*11/30;}
function reachDist(pw){return pw<30?80+pw*3.43:150+pw*1.1;}
function duffP(a,b){return clamp(0.40-Math.min(a,b)*0.014,0,0.4);}
function playHole(p,par,yards,sk,ctx){
  const S=STRAT[sk], E=k=>effStat(p,k,ctx), has=s=>p.skills&&p.skills.includes(s);
  let d=yards, lie='tee', strokes=0, log=[], onGreen=false, putt=0, holed=false;
  const cap=par*2, Y=x=>Math.round(x);
  if(par>=4){
    strokes++;
    let drive=driveDist(E('power'))+S.dist+rnd(-12,12)+[0,5,10,16][skLv(p,'飛ばし屋')]+(par===5&&has('パー5◎')?15:0);
    const fw=clamp(0.30+E('accuracy')*0.0065+S.acc,0.1,0.95);
    if(Math.random()<duffP(E('power'),E('accuracy'))){
      if(Math.random()<0.25){log.push('ティーショットは空振り…');}
      else{const dd=rnd(10,50);d-=dd;lie='rough';log.push(`ティーショットはチョロ…${Y(dd)}ヤードしか飛ばない（残り${Y(d)}）`);}
    }
    else if(Math.random()<fw){lie='fairway';d=Math.max(d-drive,10);log.push(`ティーショット${Y(drive)}ヤード、フェアウェイキープ（残り${Y(d)}）`);}
    else{
      drive-=10;d=Math.max(d-drive,15);
      const pen=(0.10+Math.max(0,30-E('accuracy'))*0.004)*S.pen*(1-E('accuracy')/150)*(has('OBなし')?0.5:1)*(has('精密機械')?0.3:1)*(p.negs&&p.negs.includes('OB癖')?1.4:1), r=Math.random();
      if(r<pen){strokes++;lie='rough';log.push(`ティーショットは大きく曲がってOB…（1打罰）`);}
      else if(r<pen+0.2){lie='bunker';log.push(`フェアウェイバンカーにつかまった（残り${Y(d)}）`);}
      else{lie='rough';log.push(`ティーショットはラフへ（残り${Y(d)}）`);}
    }
  }
  while(!onGreen&&!holed&&strokes<cap){
    if(d>40){
      strokes++;
      if(Math.random()<duffP(E('power'),E('accuracy'))*0.8){
        if(Math.random()<0.2){log.push('空振り…');}
        else{const dd=Math.min(rnd(5,40),d-10);d-=dd;log.push(`ダフってしまった…${Y(dd)}ヤードしか進まない（残り${Y(d)}）`);}
        continue;
      }
      const reach=reachDist(E('power'))*(lie==='rough'?0.85:lie==='bunker'?0.6:1);
      if(d>reach+(sk==='attack'?25:0)){
        let carry=Math.max(30,Math.min(reach,d-(sk==='safe'?100:60)));
        carry*=rnd(0.95,1.05); d=Math.max(d-carry,20);
        const fw=clamp(0.45+E('accuracy')*0.006+S.acc,0.1,0.97);
        lie=Math.random()<fw?'fairway':'rough';
        log.push(`刻んで${lie==='fairway'?'フェアウェイ':'ラフ'}へ（残り${Y(d)}）`);
        continue;
      }
      const skill=d>100?E('accuracy'):(E('accuracy')+E('approach'))/2;
      let lieMod=lie==='rough'?-0.15:lie==='bunker'?(-0.25+E('recovery')*0.002):0;
      if(d>reach) lieMod-=0.15;
      const p=clamp(0.25+skill*0.009-d*0.0018+lieMod+S.green+(has('アイアン巧者')?0.05:0)+(has('精密機械')?0.08:0),0.05,0.95);
      if(Math.random()<p){
        onGreen=true; putt=2+Math.random()*(d/12)*clamp(1.4-skill/100,0.4,1.4)*S.prox;
        log.push(`${Y(d)}ヤードからグリーンオン！ ピンまで${putt.toFixed(1)}メートル`);
      }else{
        const pen=0.06*S.pen, r=Math.random();
        if(r<pen){strokes++;d=rnd(15,30);lie='rough';log.push(`${Y(d)}ヤードのショットは池へ…（1打罰）`);}
        else if(r<pen+0.3){lie='bunker';d=rnd(8,25);log.push(`グリーン手前のバンカーにつかまった`);}
        else{lie='rough';d=rnd(8,30);log.push(`グリーンを外した（残り${Y(d)}ヤード）`);}
      }
    }else{
      strokes++;
      const skill=lie==='bunker'?(E('recovery')+E('approach'))/2:E('approach')-(lie==='rough'?5:0);
      const chip=(0.02+Math.max(skill,0)*0.0004)*S.chip*(d<20?1.5:1);
      if(Math.random()<chip){holed=true;log.push(lie==='bunker'?'バンカーから直接カップイン！！':'チップイン！！');break;}
      const fail=clamp(0.25-skill*0.003,0.02,0.3)+Math.max(0,20-skill)*0.012+(lie==='bunker'?[0.1,0.06,0.03,0][skLv(p,'バンカー巧者')]:0);
      if(Math.random()<fail){d=rnd(5,15);log.push(lie==='bunker'?'バンカーから出ない…':'アプローチをミス…');continue;}
      onGreen=true; putt=(0.5+Math.random()*(d/6)*clamp(1.5-skill/100,0.4,1.5)*S.prox)*(has('寄せワン')?0.8:1)*(has('小技の鬼')?0.7:1);
      log.push(`${lie==='bunker'?'バンカーから':'アプローチで'}寄せて${putt.toFixed(1)}メートル`);
    }
  }
  while(onGreen&&!holed&&strokes<cap){
    strokes++;
    const Pt=E('putt'); let k=2+Math.max(Pt,0)*0.025; if(putt>5) k+=[0,0.5,1,1.6][skLv(p,'ロングパット名人')];
    const pm=clamp(1/(1+Math.pow(putt/k,1.6))*S.putt+(putt<=2&&has('ショートパット◎')?0.08:0)+(putt<=2&&has('小技の鬼')?0.15:0)-(putt<=2&&p.negs&&p.negs.includes('ショートパット×')?0.08:0),0.01,0.99);
    if(Math.random()<pm){holed=true;log.push(`${putt.toFixed(1)}メートルのパットを沈めた`);break;}
    const prev=putt; putt=0.2+Math.random()*putt*(S.leave*clamp(1.5-Pt/100,0.5,1.5)+Math.max(0,20-Pt)*0.02);
    log.push(`${prev.toFixed(1)}メートルのパットは外れ（残り${putt.toFixed(1)}メートル）`);
  }
  if(!holed){strokes=cap;log.push('（大たたきでホールアウト）');}
  return {strokes,log};
}
// 試合の天気：下がるのは能力に対する割合。リカバリーで減らせる（100で無効。プラスには反転しない）
const WX={sun:{name:'晴れ',icon:'☀️'},cloud:{name:'くもり',icon:'☁️'},rain:{name:'雨',icon:'☔',pen:{power:0.22,putt:0.18,approach:0.12}},wind:{name:'強風',icon:'🌪️',pen:{accuracy:0.40,approach:0.20,power:0.10}}};
function wxMod(p,key,wx){
  const W=WX[wx];if(!W||!W.pen)return 0;const hs=s=>p.skills&&p.skills.includes(s),ng=s=>p.negs&&p.negs.includes(s);
  // リカバリーで天気のマイナスを減らす（50で75%、75で44%、100で無効。プラスには反転しない）
  const rc=Math.min(100,p.stats.recovery+((p.gear&&p.gear.recovery)||0)),base=p.stats[key]+((p.gear&&p.gear[key])||0);
  let v=-(W.pen[key]||0)*base*Math.max(0,1-Math.pow(rc/100,2));
  // デメリット特性はリカバリーに関係なく効く
  if(wx==='wind'&&ng('風に弱い')&&(key==='accuracy'||key==='approach'))v-=4;
  if(wx==='rain'&&ng('雨の日×')&&key!=='recovery')v-=5;
  // 風読み：強風のマイナスを受けず、強風の日は正確性+4
  if(wx==='wind'&&hs('風読み')){if(v<0)v=0;if(key==='accuracy')v+=4;}
  if(wx==='rain'&&hs('河童の末裔')&&key!=='recovery')v+=5;
  // 天気の申し子：雨でも強風でもマイナスを一切受けず、全能力+5
  if(hs('天気の申し子')){if(v<0)v=0;if(key!=='recovery')v+=5;}
  return v;
}
// メンタル：いつもの自分より崩れたホールの次だけ、打球の能力に補正（55より低いと引きずり、高いと取り返す。ダブルボギー以上は2倍）
function carryAfter(p,par,strokes){const av=['power','accuracy','approach','putt'].reduce((a,k)=>a+p.stats[k],0)/4;const exp=av>=60?0:av>=45?0.5:av>=30?1:av>=15?2:3;const d=strokes-par-exp;if(d<1)return 0;const mt=p.stats.mental+((p.gear&&p.gear.mental)||0);return Math.round((mt-55)*0.16*(d>=2?2:1)*10)/10;}
function holePressure(base,i){return base+(i>=15?0.3:0);}
function makeRival(level){
  const s={};for(const k of ['power','accuracy','approach','putt','recovery'])s[k]=level+rnd(-8,8);
  s.mental=level+rnd(-10,10);return {stats:s,skills:[]};
}
function playRoundAuto(p,base,wx){let t=0,c=0;for(let i=0;i<18;i++){const [par,y]=COURSE[i];const s=playHole(p,par,y,'normal',{pressure:holePressure(base,i),hole:i,carry:c,wx}).strokes;t+=s;c=carryAfter(p,par,s);}return t;}
if(typeof module!=='undefined') module.exports={holePressure,WX,wxMod,carryAfter,COURSE,STRAT,playHole,playRoundAuto,makeRival};
