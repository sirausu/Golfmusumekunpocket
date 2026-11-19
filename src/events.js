// ===== ランダムイベント =====
// 各イベント：text（本文）、choices（選択肢）。fn は結果の文章の配列を返す
// 同じ選択でも結果が少し変わる（能力・体力は±4割、もらえるお金は±3割）
const jit=(v,r)=>v*(1-r+Math.random()*2*r);
function bump(G,k,v){v=Math.round(jit(v,0.4)*10)/10||(v>0?0.1:-0.1);G.stats[k]=Math.max(0,Math.min(100,G.stats[k]+v));return `${STAT_NAMES[k]}${v>=0?'+':''}${v}`;}
function stam(G,v){v=Math.round(jit(v,0.4))||Math.sign(v);G.stamina=Math.max(0,Math.min(100,G.stamina+v));return `体力${v>=0?'+':''}${v}`;}
function cash(G,v){if(v>0)v=Math.max(100,Math.round(jit(v,0.3)/100)*100);G.money=Math.max(0,G.money+v);return `${v>=0?'＋':'−'}${Math.abs(v).toLocaleString()}円`;}
// 重み付きで出来事を1つ選ぶ：pick(G,[[重み,G=>[...]],...])
function pick(G,list){const t=list.reduce((a,x)=>a+x[0],0);let r=Math.random()*t;for(const [w,f] of list){if((r-=w)<0)return f(G);}return list[list.length-1][1](G);}
function hurt(G,w){G.injury=Math.max(G.injury||0,w*2);condUp(G,-1);return `🤕ケガをしてしまった…（治るまで約${w}週、調子も落ちた）`;}
function up(G){condUp(G,1);return '調子が上がった';}
function down(G){condUp(G,-1);return '調子が落ちた';}
const rk=()=>MAIN_KEYS[Math.floor(Math.random()*5)];
const RANDOM_EVENTS=[
  {id:'ojisan',icon:'🧓',title:'常連のおじさん',text:'練習場の常連のおじさんが、頼んでもいないのにスイングの助言を始めた。',
   choices:[{label:'素直に聞いてみる',fn:G=>pick(G,[
      [5,G=>['意外と的確だった。'+bump(G,'accuracy',1.5)]],
      [3,G=>['言われた通りにしたら余計にわからなくなった…'+bump(G,'accuracy',-0.8)]],
      [2,G=>['実は昔のトップアマだった！ 本気で教えてくれた。'+bump(G,'accuracy',2)+'、'+bump(G,'power',1)]]])},
            {label:'笑顔で聞き流す',fn:G=>pick(G,[
      [6,G=>['自分のやり方を信じることにした。'+bump(G,'mental',1)]],
      [4,G=>['「聞いてるのか！」と怒られて1時間説教された…'+stam(G,-10)+'、'+bump(G,'mental',-0.5)]]])}]},
  {id:'okozukai',icon:'💌',title:'祖母からの手紙',text:'祖母から手紙が届いた。「体に気をつけて頑張りなさい」。封筒が少し分厚い。',
   choices:[{label:'封を開ける',fn:G=>pick(G,[
      [6,G=>['お小遣いが入っていた。'+cash(G,5000)+'、'+bump(G,'mental',0.5)]],
      [3,G=>['手編みのお守りが入っていた。気持ちが温かくなった。'+up(G)]],
      [1,G=>['へそくりがどっさり入っていた！ '+cash(G,20000)]]])}]},
  {id:'saifu',icon:'👛',title:'落とし物',text:'帰り道、財布からお札が落ちたことに気づいた。',
   cond:G=>G.money>=8000,choices:[{label:'来た道を探す',fn:G=>pick(G,[
      [4,G=>['見つからなかった…'+cash(G,-5000)+'、'+stam(G,-8)]],
      [4,G=>['親切な人が交番に届けてくれていた！ 何も失わずに済んだ。'+bump(G,'mental',0.5)]],
      [2,G=>['探している途中で側溝に落ちて足をひねった…'+cash(G,-5000)+'。'+hurt(G,1)]]])},
            {label:'あきらめる',fn:G=>[cash(G,-5000)+'。切り替えも大事だ']}]},
  {id:'kaze',icon:'🤧',title:'風邪',text:'朝から体がだるい。どうやら風邪をひいたようだ。',
   choices:[{label:'「風邪は大事」を買ってしっかり治す',fn:G=>G.money<2000?['「風邪は大事」を買うお金もない…'+stam(G,-30)+'、'+down(G)]:pick(G,[
      [7,G=>[cash(G,-2000)+'。「風邪は大事」が効いた！ すぐに治った。'+stam(G,-8)]],
      [3,G=>[cash(G,-2000)+'。「風邪は大事」を飲んだが効かず、こじらせた…'+stam(G,-25)+'、'+down(G)]]])},
            {label:'気合いで治す',fn:G=>pick(G,[
      [4,G=>['一晩寝たらけろっと治った。'+stam(G,-10)]],
      [4,G=>['なかなか治らない…'+stam(G,-30)+'、'+down(G)]],
      [2,G=>['熱が出たまま素振りをしてフラついて転んだ…'+stam(G,-25)+'。'+hurt(G,1)]]])}]},
  {id:'shihainin',icon:'🏌️',title:'支配人の頼み',text:'ゴルフ場の支配人に声をかけられた。「コンペの準備、手伝ってくれないか。少しだが礼はする」',
   choices:[{label:'手伝う',fn:G=>pick(G,[
      [5,G=>['テキパキこなした。'+cash(G,5000)+'、'+stam(G,-12)]],
      [3,G=>['参加者のプロに気に入られ、少し教わった！ '+cash(G,5000)+'、'+bump(G,rk(),1.5)]],
      [2,G=>['テントの設営中に重い鉄柱が倒れてきた…'+cash(G,5000)+'。'+hurt(G,1)]]])},
            {label:'練習があるので、と断る',fn:G=>pick(G,[
      [6,G=>['練習に集中した。'+bump(G,'mental',0.5)]],
      [4,G=>['支配人が少し不機嫌そうだった…気まずい。'+bump(G,'mental',-0.8)]]])}]},
  {id:'tv',icon:'📺',title:'プロの試合',text:'テレビでプロの優勝争いを見ている。最終ホールのパットだ。',
   choices:[{label:'正座して見守る',fn:G=>pick(G,[
      [6,G=>{G.bore={};return ['入った！ 鳥肌が立った。練習の飽きが消えた、'+up(G)+'、'+bump(G,'mental',1.5)];}],
      [4,G=>['外れた…プロでも外すのか。妙に冷静になった。'+bump(G,'mental',1)+'、'+bump(G,'putt',0.5)]]])},
            {label:'見ずに練習に行く',fn:G=>pick(G,[
      [5,G=>['夜の練習場を独り占めできた。'+bump(G,rk(),1)]],
      [5,G=>['あとで劇的な結末だったと知り、ちょっと後悔した。'+bump(G,'mental',-0.5)]]])}]},
  {id:'senpai',icon:'🍜',title:'先輩のおごり',text:'先輩の研修生が「最近がんばってるな」とラーメンに連れて行ってくれた。',
   choices:[{label:'ごちそうになる',fn:G=>pick(G,[
      [6,G=>['うまい！ '+stam(G,15)]],
      [2,G=>['替え玉を5回して先輩に引かれた。でも元気いっぱいだ。'+stam(G,25)]],
      [2,G=>['食べすぎて腹を壊した…'+stam(G,-10)]]])},
            {label:'ついでにコツを聞く',fn:G=>pick(G,[
      [6,G=>[stam(G,8)+'、'+bump(G,'approach',1.2)]],
      [4,G=>['先輩の自慢話を2時間聞かされた…'+stam(G,-5)]]])}]},
  {id:'taiketsu',icon:'🆚',title:'パター対決',text:'同期の研修生が「負けたほうがグリーンの掃除な」とパター対決を挑んできた。',
   choices:[{label:'受けて立つ',fn:G=>Math.random()<0.25+G.stats.putt/100?pick(G,[
      [7,G=>['勝った！ '+bump(G,'mental',2)]],
      [3,G=>['勝った！ 悔しがった相手に再戦を挑まれ、日が暮れるまで続いた。'+bump(G,'putt',1.5)+'、'+stam(G,-10)]]]):
      pick(G,[[7,G=>['負けた…悔しくて居残り練習。'+bump(G,'putt',1)+'、'+stam(G,-8)]],
              [3,G=>['負けた上に「下手くそ」と笑われた…'+bump(G,'mental',-1)+'。'+addBad(G,'yips')]]])},
            {label:'今日はやめておく',fn:G=>pick(G,[[7,G=>['体力を温存した。'+stam(G,5)]],[3,G=>['「逃げるのか」と言われ、ムッとした。'+bump(G,'mental',-0.5)]]])}]},
  {id:'koshi',icon:'😣',title:'腰の違和感',text:'スイングのたびに腰に違和感がある。',
   choices:[{label:'今日は軽めにしておく',fn:G=>pick(G,[[8,G=>['大事を取った。'+stam(G,5)]],[2,G=>['休んでも痛みが引かない。結局ケガだった…'+hurt(G,1)]]])},
            {label:'気にせずいつも通り',fn:G=>pick(G,[
      [4,G=>['なんともなかった。']],
      [3,G=>['痛みがひどくなった…'+stam(G,-25)]],
      [3,G=>['グキッ…ぎっくり腰だ。'+hurt(G,2)]]])}]},
  {id:'kenshou',icon:'🎁',title:'雑誌の懸賞',text:'ゴルフ雑誌の懸賞の当選通知が届いた！',
   choices:[{label:'中身を確かめる',fn:G=>pick(G,[
      [5,G=>['商品券だった。'+cash(G,3000)]],
      [3,G=>['プロのレッスン動画だった。'+bump(G,rk(),1.2)]],
      [2,G=>['…よく見たら「当選者の発表は発送をもって」の広告だった。がっかり。'+bump(G,'mental',-0.5)]]])}]},
  {id:'oya',icon:'📱',title:'親からの電話',text:'親から電話がきた。「ゴルフ、いつまで続けるつもりなんだ？」',
   cond:G=>G.diff!=='rich',
   choices:[{label:'「必ずプロになる」と言い切る',fn:G=>pick(G,[
      [5,G=>['言葉にしたら覚悟が決まった。'+bump(G,'mental',2)]],
      [3,G=>['親は黙ったあと「…頑張れ」と言った。少しだけ仕送りが増えた。'+cash(G,10000)]],
      [2,G=>['口論になってしまった…'+down(G)]]])},
            {label:'「…もう少しだけ」と濁す',fn:G=>pick(G,[
      [6,G=>['少し気持ちが揺れた。'+bump(G,'mental',-1)+'、'+stam(G,5)]],
      [4,G=>['「無理はするなよ」と優しく言われ、泣きそうになった。'+up(G)]]])}]},
  {id:'oya_rich',icon:'📱',title:'親からの電話',text:'親から電話がきた。「調子はどうだ。足りないものがあれば言いなさい」',
   cond:G=>G.diff==='rich',
   choices:[{label:'素直に甘える',fn:G=>pick(G,[[7,G=>[cash(G,20000)]],[3,G=>['「甘えるな」と説教された。意外だ…'+bump(G,'mental',-0.5)]]])},
            {label:'「自分の力でやる」と断る',fn:G=>pick(G,[[6,G=>[bump(G,'mental',2)]],[4,G=>['父が感心して、こっそり道具代を送ってくれた。'+cash(G,30000)]]])}]},
  {id:'ball',icon:'⚪',title:'ロストボール',text:'コースの清掃中、林の中でボールをたくさん拾った。',
   choices:[{label:'練習に使う',fn:G=>pick(G,[
      [6,G=>[bump(G,'approach',0.8)+'、'+bump(G,'recovery',0.8)]],
      [4,G=>['ほとんど割れていて使い物にならなかった…']]])},
            {label:'中古ショップに売る',fn:G=>pick(G,[
      [6,G=>[cash(G,2000)]],
      [3,G=>['中に高級ボールが混ざっていた！ '+cash(G,6000)]],
      [1,G=>['持ち帰る途中、林でマムシにかまれた！ '+hurt(G,2)]]])}]},
  {id:'ame',icon:'🌈',title:'雨上がり',text:'雨上がりの誰もいない練習グリーン。支配人が「好きに使っていいぞ」と言ってくれた。',
   choices:[{label:'日が暮れるまで転がす',fn:G=>pick(G,[
      [6,G=>[bump(G,'putt',1.5)+'、'+stam(G,-8)]],
      [2,G=>['濡れた芝で転がりの違いがよくわかった。'+bump(G,'putt',2.2)+'、'+stam(G,-8)]],
      [2,G=>['濡れた芝で足を滑らせて転んだ…'+hurt(G,1)]]])},
            {label:'ほどほどで切り上げる',fn:G=>[bump(G,'putt',0.7)]}]},
  {id:'oni_ev',icon:'🧢',title:'鬼塚の昔話',text:'鬼塚がぽつりと言った。「俺もツアーで勝てなかった。勝負どころで逃げたんだ。お前は逃げるなよ」',
   cond:G=>(G.bond.oni||0)>=20,choices:[{label:'「逃げません」',fn:G=>{G.bond.oni=capBond(G,'oni',(G.bond.oni||0)+6);return pick(G,[
      [6,G=>[bump(G,'mental',2)+'、鬼塚との絆が深まった']],
      [4,G=>['「口だけじゃねえか見せてみろ」と300球打たされた。'+bump(G,'power',2)+'、'+stam(G,-20)+'、鬼塚との絆が深まった']]]);}}]},
  {id:'chi_ev',icon:'🎀',title:'千夏の誘い',text:'千夏が「今夜、練習グリーンで勝負しない？ 負けたらジュースおごりね」と笑っている。',
   cond:G=>(G.bond.chi||0)>=20,choices:[{label:'受けて立つ',fn:G=>{G.bond.chi=capBond(G,'chi',(G.bond.chi||0)+6);return Math.random()<0.3+G.stats.putt/120?['勝った！ '+bump(G,'putt',1.5)]:pick(G,[
      [6,G=>['完敗…ジュースをおごった。'+cash(G,-150)+'、'+bump(G,'putt',1)]],
      [4,G=>['完敗…でも帰り道に打ち方のコツを教えてくれた。'+bump(G,'putt',2)]]]);}},
            {label:'今日は休む',fn:G=>[stam(G,10)]}]},
  {id:'gen_ev',icon:'🧓',title:'源さんの一言',text:'源さんが空を見上げて言った。「明日は風が強い。こういう日はな、低く打つんだ」',
   cond:G=>(G.bond.gen||0)>=20,choices:[{label:'メモを取る',fn:G=>{G.bond.gen=capBond(G,'gen',(G.bond.gen||0)+4);return pick(G,[
      [6,G=>[bump(G,'accuracy',1.5)+'、源さんとの絆が深まった']],
      [4,G=>['翌日、本当に強風だった。教わった通りに打てた！ '+bump(G,'accuracy',2)+'、'+bump(G,'recovery',1)]]]);}}]},
  {id:'sao_ev',icon:'🎓',title:'早乙女の挑発',text:'早乙女が言った。「研修生なんて、プロテストで俺に勝てるわけないだろ」',
   cond:G=>(G.bond.sao||0)>=20,choices:[{label:'「見てろよ」と言い返す',fn:G=>{G.bond.sao=capBond(G,'sao',(G.bond.sao||0)+6);return pick(G,[
      [6,G=>['闘志に火がついた。'+up(G)+'、'+bump(G,'mental',1)]],
      [4,G=>['言い合いになり、カッとなって壁を殴ってしまった…'+hurt(G,1)]]]);}},
            {label:'相手にしない',fn:G=>[bump(G,'mental',1.5)]}]},
  {id:'nigiri',icon:'💴',title:'ニギリの誘い',text:'ラウンド帰りの常連の社長が笑って言った。「次の1ホール、1万円ニギろうか（賭けようか）」',
   cond:G=>G.money>=10000&&avgOf(G,MAIN_KEYS)>=20,
   choices:[{label:'受けて立つ',fn:G=>Math.random()<Math.min(0.75,0.15+avgOf(G,MAIN_KEYS)/100)?pick(G,[
      [7,G=>['勝った！ '+cash(G,10000)+'。社長も上機嫌だ、'+bump(G,'mental',1)]],
      [3,G=>['勝った！ 社長に気に入られて食事までごちそうになった。'+cash(G,10000)+'、'+stam(G,10)]]]):
      pick(G,[[7,G=>['負けた…'+cash(G,-10000)+'。高い授業料だ']],[3,G=>['負けたが、社長が「いい勝負だった」と半分返してくれた。'+cash(G,-5000)]]])},
            {label:'丁重に断る',fn:G=>['研修生の身なので、と断った。']}]},
  {id:'hakase',icon:'🧪',title:'ダイジョバナイ博士',text:'白衣の怪しい男が現れた。「ワタシ、ダイジョバナイ博士。アナタノ体、改造シテアゲマス。成功スレバ超人。失敗シテモ…マア、ナントカナリマス」',
   choices:[{label:'改造手術を受ける',fn:G=>{
      if(Math.random()<0.35){G.injury=0;condUp(G,2);const g=[];for(const k of MAIN_KEYS)g.push(bump(G,k,4));g.push(bump(G,'mental',3));
        let sk='';const left=(typeof skillPool==='function'?skillPool(G):[]);
        if(!G.skills.includes(DOCTOR_SKILL)){G.skills.push(DOCTOR_SKILL);sk='、特技「改造人間」を手に入れた（練習の伸び1.2倍・ケガしやすい）';}
        else if(left.length){const s=left[Math.floor(Math.random()*left.length)];G.skills.push(s);sk=`、特技「${s}」を覚えた`;}
        return ['手術は大成功！ 体の底から力がわいてくる。'+g.join('、')+sk];}
      const ks=MAIN_KEYS.slice().sort(()=>Math.random()-0.5).slice(0,2);condUp(G,-1);
      return ['手術は失敗した…「オカシイデスネ」博士は消えた。'+ks.map(k=>bump(G,k,-4)).join('、')+'、調子が落ちた'];}},
            {label:'逃げる',fn:G=>['全力で逃げた。'+stam(G,-5)]}]},
  {id:'kaminari',icon:'⚡',title:'雷注意報',text:'練習中に遠くで雷が鳴り始めた。周りの人はみんな引き上げていく。',
   choices:[{label:'すぐに引き上げる',fn:G=>['命あっての物種だ。'+stam(G,8)]},
            {label:'ギリギリまで粘る',fn:G=>pick(G,[
      [34,G=>['なんとか打ち切った。'+bump(G,'mental',1.5)]],
      [66,G=>{const m=['⚡ 雷が落ちてきた！ 体に電気が走った…'+hurt(G,2)];G.negs=G.negs||[];if(!G.negs.includes('雨男')){const was=G.skills.includes('晴れ男');if(was)G.skills=G.skills.filter(x=>x!=='晴れ男');G.negs.push('雨男');m.push((was?'雷で体質が変わってしまった…特技「晴れ男」が消え、':'それ以来、なぜか試合のたびに雨が降るようになった…')+'💀デメリット特性「雨男」がついた（'+NEGS['雨男']+'）');}return m;}]])}]},
  {id:'hole_in_one',icon:'🎯',title:'まさかの一打',text:'ショートコースで打った球が、ピンに向かってまっすぐ転がっていく…',
   choices:[{label:'見守る',fn:G=>pick(G,[
      [15,G=>{condUp(G,2);return ['カップイン！ ホールインワンだ！ 調子が大きく上がった、'+bump(G,'mental',3)+'。ただし記念の祝儀で'+cash(G,-5000)];}],
      [60,G=>['カップの縁で止まった…惜しい！ '+bump(G,'accuracy',1)]],
      [25,G=>['ピンに当たって池まで転がっていった…'+bump(G,'mental',-1)]]])}]},
  {id:'club_break',icon:'💥',title:'クラブが折れた',text:'練習中、使い古したアイアンのシャフトがぽっきり折れた。',
   cond:G=>G.money>=6000,
   choices:[{label:'中古で買い直す',fn:G=>pick(G,[[6,G=>[cash(G,-6000)]],[4,G=>['掘り出し物を見つけた！ 前より手になじむ。'+cash(G,-6000)+'、'+bump(G,'accuracy',1)]]])},
            {label:'テープで直して使う',fn:G=>pick(G,[
      [5,G=>['なんとかなった…が、気になって集中できない。'+bump(G,'accuracy',-0.5)]],
      [3,G=>['意外と問題なかった。']],
      [2,G=>['振った瞬間にまた折れ、ヘッドが手に当たった…'+hurt(G,1)]]])}]},
  {id:'youtube',icon:'📹',title:'動画で研究',text:'夜、プロのスイング動画を何本も見比べた。気づけば深夜2時だ。',
   choices:[{label:'もう1本だけ',fn:G=>pick(G,[
      [5,G=>[bump(G,'accuracy',1.2)+'、'+stam(G,-12)]],
      [3,G=>['自分と同じクセを直す動画を見つけた！ '+bump(G,'accuracy',2)+'、'+stam(G,-12)]],
      [2,G=>['気づけば猫の動画を見ていた…'+stam(G,-15)+'。'+addBad(G,'yofukashi')]]])},
            {label:'寝る',fn:G=>['ちゃんと寝た。'+stam(G,5)]}]},
  {id:'kodomo',icon:'👦',title:'ゴルフ教室の子ども',text:'ジュニア教室の子どもに「お兄さん、ゴルフ教えて！」とせがまれた。',
   choices:[{label:'教えてあげる',fn:G=>pick(G,[
      [5,G=>['うまく教えられた！ 教えるうちに自分の理解も深まった。'+bump(G,'approach',1.2)+'、'+bump(G,'mental',1)]],
      [3,G=>['お手本で空振りして「へたくそー！」と大笑いされた…'+bump(G,'mental',-1.5)]],
      [2,G=>['その子の親がお礼に商品券をくれた。'+cash(G,3000)+'、'+stam(G,-6)]]])},
            {label:'「また今度な」',fn:G=>pick(G,[[7,G=>['少し罪悪感…']],[3,G=>['「ケチ！」とボールを投げられ、頭に当たった。'+stam(G,-5)]]])}]},
  {id:'kyuuryou',icon:'💴',title:'支配人の呼び出し',text:'支配人に事務所へ呼ばれた。「ちょっと話がある」',
   choices:[{label:'恐る恐る行く',fn:G=>pick(G,[
      [6,G=>['「最近よく働いてくれるから」と臨時ボーナスをもらった！ '+cash(G,8000)]],
      [3,G=>['「練習場の打席、汚れてたぞ」と叱られた…'+bump(G,'mental',-1)]],
      [1,G=>['「次の大会、ゴルフ場の代表として出てみるか」と励まされた。'+up(G)+'、'+bump(G,'mental',1.5)]]])}]},
  {id:'zeikin',icon:'🧾',title:'税金の通知',text:'住民税の通知が届いた。研修生でも払うものは払わなければならない。',
   cond:G=>G.money>=15000,
   choices:[{label:'封を開ける',fn:G=>pick(G,[
      [6,G=>[cash(G,-12000)+'。世の中は厳しい']],
      [3,G=>['収入が少ないので安かった。'+cash(G,-4000)]],
      [1,G=>['払いすぎていた分が戻ってきた！ '+cash(G,5000)]]])}]},
  {id:'yanushi',icon:'🏠',title:'大家さん',text:'大家さんが「練習がんばってるね」と声をかけてきた。',
   choices:[{label:'話をする',fn:G=>pick(G,[
      [6,G=>['畑の野菜をたくさんもらった。今月の食費が浮いた。'+cash(G,3000)+'、'+stam(G,8)]],
      [3,G=>['屋根の修理を手伝わされた…'+stam(G,-15)]],
      [1,G=>['実は大家さん、昔の県アマ王者だった！ 寄せのコツを教わった。'+bump(G,'approach',2)]]])}]},
  {id:'reizouko',icon:'🧊',title:'冷蔵庫が壊れた',text:'家の冷蔵庫が動かなくなった。中の食材が全滅だ。',
   cond:G=>G.money>=10000,
   choices:[{label:'中古を買う',fn:G=>pick(G,[[7,G=>[cash(G,-9000)]],[3,G=>['運ぶ途中で腰を痛めた…'+cash(G,-9000)+'。'+hurt(G,1)]]])},
            {label:'冷蔵庫なしで暮らす',fn:G=>pick(G,[[6,G=>['生活がつらい…'+down(G)]],[4,G=>['意外となんとかなった。']]])}]},
  {id:'seminar',icon:'🎤',title:'無料講習会',text:'メーカー主催の無料講習会があるらしい。プロが直接教えてくれる。',
   choices:[{label:'参加する',fn:G=>pick(G,[
      [6,G=>['プロの話はためになった。'+bump(G,rk(),2)+'、'+stam(G,-8)]],
      [3,G=>['ほとんど新製品の宣伝だった…'+stam(G,-8)]],
      [1,G=>['模範ショットの相手に選ばれ、直接見てもらえた！ '+bump(G,rk(),2.5)+'、'+bump(G,'mental',1)]]])},
            {label:'練習を優先する',fn:G=>[bump(G,'mental',0.5)]}]},
  {id:'shisha',icon:'🏷️',title:'試打会',text:'ゴルフ場で最新ドライバーの試打会が開かれている。',
   choices:[{label:'打たせてもらう',fn:G=>pick(G,[
      [5,G=>['いい感覚をつかんだ。'+bump(G,'power',1.5)]],
      [3,G=>['飛びすぎて今のクラブに戻れない…'+bump(G,'accuracy',-0.5)]],
      [2,G=>['力みすぎて手首を痛めた…'+hurt(G,1)]]])},
            {label:'営業されそうなので避ける',fn:G=>['賢明な判断だ。']}]},
  {id:'karasu',icon:'🐦',title:'カラスの襲撃',text:'カートに置いていたおにぎりを、カラスに持っていかれた。',
   choices:[{label:'おにぎりを取り返す（ミニゲーム）',fn:G=>karasuResult(G,[2,1,1,0,0][Math.floor(Math.random()*5)])},
            {label:'あきらめる',fn:G=>['腹が減った…'+stam(G,-5)]}]},
  {id:'mizou',icon:'💧',title:'池ポチャ地獄',text:'ラウンド中、同じ池に3球連続で打ち込んだ。同伴者の視線が痛い。',
   choices:[{label:'笑ってごまかす',fn:G=>pick(G,[[6,G=>[bump(G,'mental',1)]],[3,G=>['同伴者に「プロ目指してるんでしょ？」と言われ、心が折れかけた…'+bump(G,'mental',-1)]],[1,G=>['同伴者に「プロ目指してるんでしょ？」と言われ、頭が真っ白になった…'+addBad(G,'chance')]]])},
            {label:'居残りで池越えを特訓',fn:G=>pick(G,[
      [6,G=>[bump(G,'accuracy',1.2)+'、'+bump(G,'recovery',0.8)+'、'+stam(G,-12)]],
      [4,G=>['さらにボールを10個池に沈めた…'+cash(G,-2000)+'、'+stam(G,-12)]]])}]},
  {id:'kanemochi',icon:'🎩',title:'お金持ちの紳士',text:'ラウンドで一緒になった紳士が「君、筋がいいね。これで道具でも買いなさい」と封筒を差し出した。',
   choices:[{label:'受け取る',fn:G=>pick(G,[[7,G=>[cash(G,15000)]],[3,G=>['中身は名刺とクーポンだった…']]])},
            {label:'「お気持ちだけで」と断る',fn:G=>pick(G,[
      [6,G=>['紳士は「気に入った」と笑った。'+bump(G,'mental',2)+'、'+up(G)]],
      [4,G=>['紳士は「そうか」と去っていった。少しもったいなかったかも。']]])}]},
  {id:'sagi',icon:'📞',title:'怪しい電話',text:'「プロテスト合格保証コース、今なら5万円！」という電話がかかってきた。',
   choices:[{label:'すぐ切る',fn:G=>['そんなうまい話はない。'+bump(G,'mental',0.5)]},
            {label:'話を聞いてみる',fn:G=>G.money<30000?['お金がなくて申し込めなかった。助かった。']:pick(G,[
      [7,G=>['気づけば申し込んでいた…詐欺だった。'+cash(G,-30000)+'。'+addBad(G,'slump')]],
      [3,G=>['途中で怪しいと気づいて切った。危なかった。'+bump(G,'mental',1)]]])}]},
  {id:'natsubate',icon:'🥵',title:'猛暑日',text:'気温38度。練習場のマットから熱気が立ちのぼる。',
   choices:[{label:'水をこまめに飲んで続ける',fn:G=>pick(G,[
      [6,G=>[stam(G,-10)+'、'+bump(G,'mental',1)]],
      [4,G=>['熱中症で倒れた…'+stam(G,-30)+'、'+down(G)]]])},
            {label:'日陰で休む',fn:G=>[stam(G,5)]}]},
  {id:'yuki',icon:'❄️',title:'雪のゴルフ場',text:'朝起きたら一面の銀世界。コースはクローズだ。',
   choices:[{label:'家で筋トレ',fn:G=>pick(G,[[7,G=>[bump(G,'power',1)+'、'+stam(G,-8)]],[3,G=>['張り切りすぎて肩を痛めた…'+hurt(G,1)]]])},
            {label:'雪かきを手伝う',fn:G=>pick(G,[[6,G=>['支配人が喜んでお礼をくれた。'+cash(G,4000)+'、'+stam(G,-12)]],[4,G=>['凍った道で滑って転んだ…'+hurt(G,1)]]])},
            {label:'こたつで寝る',fn:G=>[stam(G,15)]}]},
  {id:'mental_book',icon:'📖',title:'古本屋の一冊',text:'古本屋で「勝負に勝つ心」という本を見つけた。100円だ。',
   choices:[{label:'買って読む',fn:G=>pick(G,[
      [6,G=>[cash(G,-100)+'、'+bump(G,'mental',2)]],
      [4,G=>[cash(G,-100)+'。中身はほとんど占いの話だった…']]])},
            {label:'立ち読みで済ます',fn:G=>[bump(G,'mental',0.8)]}]},
  {id:'bunker_rake',icon:'🧹',title:'バンカーならし',text:'支配人に一日中バンカーをならすよう頼まれた。',
   choices:[{label:'黙々とやる',fn:G=>pick(G,[
      [6,G=>['砂の感触がわかってきた。'+bump(G,'recovery',1.5)+'、'+cash(G,3000)+'、'+stam(G,-12)]],
      [4,G=>['打ち込まれたボールが背中に当たった…'+cash(G,3000)+'、'+stam(G,-20)]]])},
            {label:'こっそりサボる',fn:G=>pick(G,[[5,G=>['ばれなかった。'+stam(G,5)]],[5,G=>['ばれた…怒られた。'+bump(G,'mental',-1)]]])}]},
  {id:'green_keeper',icon:'🌱',title:'グリーンキーパー',text:'グリーンキーパーが芝の読み方を教えてくれると言う。',
   choices:[{label:'教わる',fn:G=>pick(G,[
      [6,G=>['芝目が見えるようになってきた。'+bump(G,'putt',1.8)]],
      [4,G=>['話が専門的すぎて半分もわからなかった…'+bump(G,'putt',0.5)]]])}]},
  {id:'koi',icon:'💗',title:'気になる人',text:'クラブハウスの受付の人に「いつも頑張ってますね」と声をかけられた。',
   choices:[{label:'照れながらお礼を言う',fn:G=>pick(G,[
      [6,G=>['なんだか元気が出た。'+up(G)]],
      [4,G=>['緊張して噛みまくり、自己嫌悪に陥った…'+bump(G,'mental',-1)]]])},
            {label:'練習に集中する',fn:G=>[bump(G,'mental',1)]}]},
  {id:'tomodachi',icon:'🍻',title:'地元の友達',text:'地元の友達から「久しぶりに飲みに行こうぜ」と連絡がきた。',
   choices:[{label:'行く',fn:G=>G.money<4000?['お金がなくて断った…']:pick(G,[
      [6,G=>[cash(G,-4000)+'。楽しかった。'+up(G)+'、'+stam(G,-5)]],
      [3,G=>[cash(G,-4000)+'。飲みすぎて次の日は二日酔いだ…'+stam(G,-25)]],[1,G=>[cash(G,-4000)+'。楽しすぎて、それから毎晩飲み歩くように…'+addBad(G,'rouhi')]]])},
            {label:'断る',fn:G=>['今はゴルフに集中する。'+bump(G,'mental',0.5)]}]},
  {id:'kenkoushindan',icon:'🩺',title:'健康診断',text:'ゴルフ場の健康診断を受けた。',
   choices:[{label:'結果を聞く',fn:G=>pick(G,[
      [6,G=>['「健康そのものです」安心した。'+bump(G,'mental',0.5)]],
      [3,G=>['「疲れがたまっていますね。休みなさい」'+stam(G,15)]],
      [1,G=>['「疲労骨折しかけています」…しばらく安静だ。'+hurt(G,2)]]])}]},
  {id:'kaze_tsuyoi',icon:'🌪️',title:'強風の日',text:'台風が近づき、練習場は強風。球がまっすぐ飛ばない。',
   choices:[{label:'低い球を練習する',fn:G=>pick(G,[
      [6,G=>[bump(G,'accuracy',1)+'、'+bump(G,'recovery',1)+'、'+stam(G,-8)]],
      [4,G=>['飛んできた看板が当たりそうになり、肝を冷やした…'+bump(G,'mental',-0.5)]]])},
            {label:'今日はやめる',fn:G=>[stam(G,8)]}]},
  {id:'urashi',icon:'🔮',title:'占い師',text:'駅前の占い師に呼び止められた。「あなた、近いうちに運命が動きますよ」',
   choices:[{label:'占ってもらう（2000円）',fn:G=>G.money<2000?['お金が足りなかった。']:pick(G,[
      [5,G=>[cash(G,-2000)+'。「大吉です」'+up(G)]],
      [5,G=>[cash(G,-2000)+'。「…気をつけて」なんだか不安だ、'+bump(G,'mental',-0.5)]]])},
            {label:'無視する',fn:G=>['気にしないことにした。']}]},
  {id:'rival_kenshu',icon:'😤',title:'同期の脱落',text:'同期の研修生が「俺、ゴルフやめるわ」と荷物をまとめていた。',
   choices:[{label:'「お前の分まで頑張る」',fn:G=>pick(G,[
      [6,G=>['決意を新たにした。'+bump(G,'mental',2)]],
      [2,G=>['「上から目線かよ！」と殴られた…'+hurt(G,1)]],
      [2,G=>['「頼んだぞ」と使っていたウェッジを譲ってくれた。'+bump(G,'approach',1.5)]]])},
            {label:'引き止める',fn:G=>pick(G,[
      [4,G=>['思いとどまってくれた！ 練習仲間が残った。'+bump(G,'mental',1)+'、'+stam(G,5)]],
      [4,G=>['決意は固かった…'+bump(G,'mental',-0.5)]],
      [2,G=>['しつこいと突き飛ばされ、手をついて痛めた…'+hurt(G,1)]]])}]},
  {id:'caddie_tip',icon:'💰',title:'気前のいいお客',text:'キャディーをしたお客さんがベストスコアを出して上機嫌だ。',
   choices:[{label:'一緒に喜ぶ',fn:G=>pick(G,[
      [6,G=>['チップをはずんでくれた。'+cash(G,6000)]],
      [3,G=>['お礼に高級ボールを1ダースくれた。'+bump(G,'putt',0.8)+'、'+bump(G,'approach',0.8)]],
      [1,G=>['胴上げされて落とされた…'+hurt(G,1)]]])}]},
  {id:'mushi',icon:'🐝',title:'ハチに追われる',text:'林の中にボールを探しに行ったら、ハチの巣があった！',
   choices:[{label:'全力で逃げる',fn:G=>pick(G,[
      [7,G=>['逃げ切った。'+stam(G,-8)+'、'+bump(G,'power',0.5)]],
      [3,G=>['刺された…腕がパンパンに腫れた。'+hurt(G,1)]]])},
            {label:'ボールはあきらめる',fn:G=>['賢明だ。']}]}
];
const EVENT_RATE=0.22;
// 博士は年に1回は必ず現れる（ケガ中は特に現れやすい）
function rollRandomEvent(G){
  const y=Math.floor((G.week-1)/48)+1,wy=G.week-(y-1)*48;G.drMet=G.drMet||{};
  const dr=()=>{G.drMet[y]=1;G.lastEvent='hakase';return 'hakase';};
  if(G.lastEvent!=='hakase'){
    if(G.injury>0&&Math.random()<0.3)return dr();
    if(!G.drMet[y]&&(Math.random()<0.03||wy>=40))return dr();
  }
  if(Math.random()>EVENT_RATE)return null;
  const pool=RANDOM_EVENTS.filter(e=>(!e.cond||e.cond(G))&&e.id!==G.lastEvent&&e.id!=='hakase');
  const e=pool[Math.floor(Math.random()*pool.length)];G.lastEvent=e.id;return e.id;
}
// 思わぬおまけ・とばっちり（どの選択でも起こりうる）
const TWISTS_GOOD=[
  G=>'帰り道、なぜか体が軽い。'+stam(G,8),
  G=>{condUp(G,1);return '思いがけず気分が晴れた。調子が上がった';},
  G=>'ふと、いいイメージが浮かんだ。'+bump(G,MAIN_KEYS[Math.floor(Math.random()*5)],1),
  G=>'自販機の下で小銭を拾った。'+cash(G,500),
  G=>'今日のことで少し肝がすわった。'+bump(G,'mental',0.8)];
const TWISTS_BAD=[
  G=>'…なのに、なぜかどっと疲れた。'+stam(G,-8),
  G=>{condUp(G,-1);return '…だが、その後もやもやが残った。調子が落ちた';},
  G=>'帰りに財布を見たら、思ったより減っていた。'+cash(G,-1000),
  G=>'考えすぎて、スイングが少しぎこちない。'+bump(G,MAIN_KEYS[Math.floor(Math.random()*5)],-0.6)];
function eventTwist(G){const r=Math.random();
  if(r<0.18)return '✨ '+TWISTS_GOOD[Math.floor(Math.random()*TWISTS_GOOD.length)](G);
  if(r<0.30)return '💦 '+TWISTS_BAD[Math.floor(Math.random()*TWISTS_BAD.length)](G);
  return null;}
// カラスの襲撃の結果（2=逃げ切った、1=半分以上、0=半分未満）
function karasuResult(G,grade){
  if(grade>=2)return ['おにぎりはカラスの群れをよけ切って、無事に手元へ戻ってきた！ '+stam(G,10)+'、'+bump(G,'mental',1.5)];
  if(grade===1)return ['カラスは追い払えたが、おにぎりは戻らなかった…'+bump(G,'mental',0.5)];
  return ['おにぎりはあっさり落とされ、カラスに笑われた…'+stam(G,-8)+'、'+bump(G,'mental',-0.5)];
}
function resolveEvent(G,ci){
  const e=RANDOM_EVENTS.find(x=>x.id===G.pending);if(!e)return [];
  const msgs=e.choices[ci].fn(G).map(m=>`${e.icon} ${e.title}：${m}`);G.pending=null;
  return msgs;
}
if(typeof module!=='undefined') module.exports={RANDOM_EVENTS,rollRandomEvent,resolveEvent};
