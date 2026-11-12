/* TRML 個人分析：學生頁（me.html）與老師頁共用的計算與畫面
 * TRMLProfile.render(el, data, opts)
 *   data = { me:{name,team,year,id}, subs:[…], resps:[…], qinfo:{qid:{topic,img}}, cls:{year,topics:{題型:{n,ok,sec}},speedSec} }
 *   opts = { imgBase:'img/', teacher:false }
 * 停損點：TRMLProfile.stopLoss(data) 回傳競速的停損時間與個人賽回合統計（老師頁全班一覽也用它）。
 * 只用每份卷子的第一次作答來算題型（重寫的分數會偏高）；團體賽是全隊的成績，只列在紀錄裡，不算進個人題型。 */
(function(root){
'use strict';
var CSS='.pf{display:flex;flex-direction:column;gap:16px}'+
'.pf .sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}'+
'.pf .sum div{border:1px solid var(--line);border-radius:6px;padding:12px 14px;background:var(--card)}'+
'.pf .sum b{display:block;font-family:var(--f-display);font-size:1.6rem;font-weight:900;color:var(--indigo);line-height:1.15}'+
'.pf .sum span{font-size:.8rem;color:var(--muted)}'+
'.pf .call{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}'+
'.pf .call>div{border-radius:6px;padding:12px 14px}'+
'.pf .call .good{background:var(--moss-soft)} .pf .call .bad{background:var(--ochre-soft)}'+
'.pf .call h3{margin:0 0 6px;font-size:.95rem} .pf .call .good h3{color:var(--moss)} .pf .call .bad h3{color:var(--ochre)}'+
'.pf .call ul{margin:0;padding-left:1.1em} .pf .call li{margin:2px 0}'+
'.pf .tp{display:grid;grid-template-columns:minmax(5.5em,auto) minmax(0,1fr) auto;gap:6px 12px;align-items:center;font-size:.92rem}'+
'.pf .tp .lab{white-space:nowrap}'+
'.pf .track{position:relative;height:14px;border-radius:3px;background:var(--line)}'+
'.pf .fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--indigo)}'+
'.pf .fill.lo{background:var(--ochre)} .pf .fill.hi{background:var(--moss)}'+
'.pf .mark{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--ink);opacity:.7}'+
'.pf .num{font-family:var(--f-mono);font-size:.82rem;color:var(--muted);white-space:nowrap;font-variant-numeric:tabular-nums}'+
'.pf .legend{display:flex;gap:16px;flex-wrap:wrap;font-size:.8rem;color:var(--muted);align-items:center}'+
'.pf .legend i{display:inline-block;vertical-align:middle;margin-right:5px}'+
'.pf .wq{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}'+
'.pf .wq figure{margin:0;border:1px solid var(--line);border-radius:6px;padding:10px;background:var(--card);display:flex;flex-direction:column;gap:6px}'+
'.pf .wq img{max-width:100%;height:auto;background:#fff;border-radius:2px}'+
'.pf .wq figcaption{font-size:.82rem;color:var(--muted)}'+
'.pf svg text{font-family:var(--f-mono);font-size:10px;fill:var(--muted)}'+
'.pf .tbl-wrap{overflow-x:auto} .pf table{border-collapse:collapse;width:100%;font-size:.88rem}'+
'.pf th,.pf td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}'+
'.pf th{font-weight:500;color:var(--muted);font-size:.76rem}'+
'.pf td.n{font-family:var(--f-mono);text-align:right;font-variant-numeric:tabular-nums}'+
'.pf th.n{text-align:right}'+
'.pf .sl .rule{background:var(--indigo-soft);border-left:4px solid var(--indigo);border-radius:3px;padding:10px 12px;display:flex;flex-direction:column;gap:4px}'+
'.pf .sl .sub-h{font-weight:700;font-size:.92rem;margin-top:4px}'+
'.pf .sl .bins{display:grid;grid-template-columns:auto minmax(0,1fr) auto minmax(40px,.35fr);gap:6px 12px;align-items:center;font-size:.9rem}'+
'.pf .sl .bins .lab{white-space:nowrap} .pf .sl .bins .lab.past{color:var(--ochre);font-weight:700}'+
'.pf .sl .cnt{height:6px;border-radius:3px;background:var(--blank,var(--line))} .pf .sl .cnt i{display:block;height:100%;border-radius:3px;background:var(--muted);opacity:.55}'+
'.pf .sl .legend .past{color:var(--ochre)}'+
'.pf .sl .strip-h{font-size:.88rem}'+
'.pf .sl .strip{display:flex;gap:2px;height:26px;border-radius:3px;overflow:hidden}'+
'.pf .sl .strip span{min-width:3px;display:flex;align-items:center;justify-content:center;font-family:var(--f-mono);font-size:.7rem;overflow:hidden;box-sizing:border-box}'+
'.pf .sl .ok{background:var(--moss-soft);color:var(--moss)} .pf .sl .no{background:var(--ochre-soft);color:var(--ochre);font-weight:700} .pf .sl .bl{background:var(--line);color:var(--muted)}'+
'.pf .sl .over{box-shadow:inset 0 0 0 2px var(--ochre)}'+
'.pf .sl .sw{display:inline-block;width:16px;height:10px;border-radius:2px;vertical-align:middle;margin-right:4px}'+
'.pf details.sol{border-top:1px solid var(--line);padding-top:6px}.pf details.sol summary{cursor:pointer;color:var(--indigo);font-size:.88rem}'+
'.pf details.sol img{display:block;max-width:100%;height:auto;margin-top:6px;background:#fff}';
function injectCss(){ if(document.getElementById('pf-css')) return; var s=document.createElement('style'); s.id='pf-css'; s.textContent=CSS; document.head.appendChild(s); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function pct(x){ return isFinite(x)?Math.round(x*100)+'%':'–'; }
function fmt(sec){ sec=Math.max(0,Math.round(sec||0)); var m=Math.floor(sec/60),s=sec%60; return m+':'+(s<10?'0':'')+s; }
function tnum(t){ var d=new Date(String(t).replace(/ 上午 /,' ').replace(/ 下午 (\d+)/,function(_,h){return ' '+(Number(h)%12+12);})); return isNaN(d)?0:d.getTime(); }

function compute(data){
  var subs=data.subs.slice(), resps=data.resps, qinfo=data.qinfo||{};
  // 每份卷子（同一年度）只取第一次
  var firstOf={};
  subs.forEach(function(s){ var k=s.year+'|'+s.setId; if(!firstOf[k]||s.attemptNo<firstOf[k].attemptNo) firstOf[k]=s; });
  var firstIds={}; Object.keys(firstOf).forEach(function(k){ firstIds[firstOf[k].attemptId]=firstOf[k]; });
  var R=resps.filter(function(r){ return firstIds[r.attemptId] && r.kind!=='團體'; });

  var topics={};
  R.forEach(function(r){
    var t=(qinfo[r.qid]||{}).topic||'未分類';
    var x=topics[t]||(topics[t]={t:t,n:0,ok:0,sec:0});
    x.n++; if(r.correct) x.ok++; x.sec+=r.seconds||0;
  });
  var cls=(data.cls&&data.cls.topics)||{};
  var tl=Object.keys(topics).map(function(k){ var x=topics[k], c=cls[k];
    x.rate=x.ok/x.n; x.avg=x.sec/x.n; x.crate=c&&c.n?c.ok/c.n:NaN; x.cavg=c&&c.n?c.sec/c.n:NaN; return x; });
  tl.sort(function(a,b){ return a.rate-b.rate||b.n-a.n; });
  var enough=tl.filter(function(x){return x.n>=3;});
  var strong=enough.filter(function(x){ return x.rate>=0.7||(isFinite(x.crate)&&x.rate-x.crate>=0.1); }).sort(function(a,b){return b.rate-a.rate;}).slice(0,3);
  var weak=enough.filter(function(x){ return strong.indexOf(x)<0&&(x.rate<0.5||(isFinite(x.crate)&&x.rate-x.crate<=-0.1)); }).slice(0,3);
  var slow=enough.filter(function(x){ return isFinite(x.cavg)&&x.avg>x.cavg*1.5&&x.avg>=45; });

  var sp=R.filter(function(r){return r.kind==='競速';});
  var speedSec=sp.length?sp.reduce(function(a,r){return a+(r.seconds||0);},0)/sp.length:NaN;
  var spOk=sp.filter(function(r){return r.correct;}).length;
  var indSubs=Object.keys(firstOf).map(function(k){return firstOf[k];}).filter(function(s){return s.kind==='個人';});
  var indAvg=indSubs.length?indSubs.reduce(function(a,s){return a+s.score;},0)/indSubs.length:NaN;
  var indMax=indSubs.length?indSubs[0].max:12;

  // 答錯的題（第一次作答），依題型弱的排前面
  var seen={}, wrong=[];
  R.forEach(function(r){ if(r.correct||seen[r.qid]) return; seen[r.qid]=1; wrong.push(r); });
  var order={}; tl.forEach(function(x,i){order[x.t]=i;});
  wrong.sort(function(a,b){ return (order[(qinfo[a.qid]||{}).topic||'未分類']||0)-(order[(qinfo[b.qid]||{}).topic||'未分類']||0)||(a.qid<b.qid?-1:1); });

  var trend=Object.keys(firstOf).map(function(k){return firstOf[k];}).filter(function(s){return s.kind!=='團體'&&s.max;})
    .sort(function(a,b){return tnum(a.time)-tnum(b.time);});
  var years={}; R.forEach(function(r){ var y=years[r.year]||(years[r.year]={n:0,ok:0}); y.n++; if(r.correct) y.ok++; });
  subs.sort(function(a,b){return tnum(b.time)-tnum(a.time);});
  return {topics:tl,strong:strong,weak:weak,slow:slow,speedSec:speedSec,spN:sp.length,spOk:spOk,indAvg:indAvg,indMax:indMax,indN:indSubs.length,
    wrong:wrong,trend:trend,years:years,subs:subs,nQ:R.length};
}

/* ---------- 停損點：一題寫多久還沒出來，就該先放下 ----------
 * 只看各卷第一次作答。競速：找「寫超過 T 秒的題目，大多寫不出來」的最小 T。
 * 個人賽：兩題一回合（全對 3、對一題 1），看「一題用掉大半回合、兩題都沒拿到」的回合。 */
var SL_CAND=[90,120,150,180,240], SL_BINS=[[0,60,'1 分內'],[60,90,'1～1.5 分'],[90,120,'1.5～2 分'],[120,180,'2～3 分'],[180,Infinity,'3 分以上']];
var SL_DEFAULT=120, SL_ROUND_HOG=240;
function firstResps(data){
  var firstOf={};
  (data.subs||[]).forEach(function(s){ var k=s.year+'|'+s.setId; if(!firstOf[k]||s.attemptNo<firstOf[k].attemptNo) firstOf[k]=s; });
  var ids={}; Object.keys(firstOf).forEach(function(k){ ids[firstOf[k].attemptId]=firstOf[k]; });
  return {subOf:ids,R:(data.resps||[]).filter(function(r){ return ids[r.attemptId]&&r.kind!=='團體'; })};
}
function rate(a){ return a.length?a.filter(function(r){return r.correct;}).length/a.length:NaN; }
function stopLoss(data){
  var F=firstResps(data), sp=F.R.filter(function(r){return r.kind==='競速';});
  var timed=sp.filter(function(r){return (r.seconds||0)>0;});
  var bins=SL_BINS.map(function(b){ var a=timed.filter(function(r){return r.seconds>=b[0]&&r.seconds<b[1];}); return {lo:b[0],hi:b[1],label:b[2],n:a.length,ok:a.filter(function(r){return r.correct;}).length}; });
  var found=null;
  SL_CAND.some(function(T){
    var tail=timed.filter(function(r){return r.seconds>=T;}), head=timed.filter(function(r){return r.seconds<T;});
    if(tail.length<3||head.length<3) return false;
    var tr=rate(tail), hr=rate(head);
    if(tr<=0.35&&hr-tr>=0.25){ found={T:T,tail:tail,head:head,tr:tr,hr:hr}; return true; }
    return false;
  });
  var longN=timed.filter(function(r){return r.seconds>=120;}).length;
  var status=found?'found':(timed.length>=15&&longN>=3?'persist':'few');
  var T=found?found.T:(status==='persist'?180:SL_DEFAULT);
  var tail=timed.filter(function(r){return r.seconds>=T;}), tailWrong=tail.filter(function(r){return !r.correct;});
  var sunk=tailWrong.reduce(function(a,r){return a+(r.seconds-T);},0);
  var quickOk=timed.filter(function(r){return r.correct&&r.seconds<T;});
  var okAvg=quickOk.length?quickOk.reduce(function(a,r){return a+r.seconds;},0)/quickOk.length:NaN;
  var blank=sp.filter(function(r){return !String(r.answer||'').trim();}).length;
  // 每份競速卷（第一次）一條：依題號排，寬度＝用時
  var papers={};
  sp.forEach(function(r){ (papers[r.attemptId]||(papers[r.attemptId]={sub:F.subOf[r.attemptId],qs:[]})).qs.push(r); });
  var strips=Object.keys(papers).map(function(k){ var p=papers[k]; p.qs.sort(function(a,b){return a.qid<b.qid?-1:1;}); return p; })
    .sort(function(a,b){return tnum(b.sub.time)-tnum(a.sub.time);});
  // 個人賽：每份卷依題號兩題一回合
  var rounds={n:0,full:0,one:0,zero:0,hog:0,hogList:[]};
  var ind={};
  F.R.forEach(function(r){ if(r.kind==='個人') (ind[r.attemptId]||(ind[r.attemptId]=[])).push(r); });
  Object.keys(ind).forEach(function(k){
    var qs=ind[k].sort(function(a,b){return a.qid<b.qid?-1:1;});
    for(var i=0;i+1<qs.length;i+=2){
      var a=qs[i], b=qs[i+1], c=(a.correct?1:0)+(b.correct?1:0);
      rounds.n++; if(c===2) rounds.full++; else if(c===1) rounds.one++; else rounds.zero++;
      var big=(a.seconds||0)>=(b.seconds||0)?a:b;
      if(c===0&&(big.seconds||0)>=SL_ROUND_HOG){ rounds.hog++; rounds.hogList.push({sub:F.subOf[k],q:big,round:i/2+1}); }
    }
  });
  return {status:status,T:T,found:found,bins:bins,nTimed:timed.length,nSp:sp.length,tailN:tail.length,tailOk:tail.length-tailWrong.length,
    tailWrong:tailWrong.length,sunk:sunk,okAvg:okAvg,extra:isFinite(okAvg)&&okAvg>0?Math.floor(sunk/okAvg):0,blank:blank,strips:strips,rounds:rounds};
}
function slMin(T){ return T%60?(T/60).toFixed(1).replace(/\.0$/,'')+' 分鐘':(T/60)+' 分鐘'; }
function stopLossHtml(S,opts){
  var who=opts.teacher?'他':'我', h='<div class="sheet stack sl"><h2>停損點</h2>';
  if(!S.nSp&&!S.rounds.n) return h+'<div class="muted">還沒有競速或個人賽的紀錄。</div></div>';
  if(S.nSp){
    var rule;
    if(S.status==='found') rule='<b>競速一題寫到 '+slMin(S.T)+'還沒有方向，就先標記、往下寫。</b>'+
      '<div>'+who+'寫超過 '+fmt(S.T)+' 的題目共 '+S.tailN+' 題，答對 '+S.tailOk+' 題（'+pct(S.found.tr)+'）；'+fmt(S.T)+' 內寫完的題目答對 '+pct(S.found.hr)+'。</div>'+
      (S.sunk>=30?'<div>超過 '+fmt(S.T)+' 之後還繼續寫、最後仍然錯的題，'+(S.strips.length>1?S.strips.length+' 份卷子合計':'一共')+'多花了 <b>'+fmt(S.sunk)+'</b>'+(S.extra>=1?'，大約夠再寫 <b>'+S.extra+'</b> 題（以'+who+'答對的題平均 '+fmt(S.okAvg)+' 一題算）':'')+'。</div>':'')+
      (S.blank?'<div>同一批卷子空白 '+S.blank+' 題。</div>':'');
    else if(S.status==='persist') rule='<b>目前看不出停損點：'+who+'寫得久的題目，多半還是寫得出來。</b>'+
      '<div>寫超過 2 分鐘的題目答對 '+pct(rate([].concat.apply([],S.strips.map(function(p){return p.qs;})).filter(function(r){return r.seconds>=120;})))+'。可以先用 3 分鐘當上限，避免一題拖垮後面。</div>'+
      (S.blank?'<div>空白 '+S.blank+' 題。</div>':'');
    else rule='<b>題目還不夠多，先用 2 分鐘當停損點。</b><div>正式比賽 40 分鐘 26 題，一題平均不到 1.5 分鐘；一題超過 2 分鐘，等於拿兩題的時間去換一題。競速寫滿 15 題以上，這裡會換成'+who+'自己的停損點。</div>';
    h+='<div class="rule">'+rule+'</div>';
    var mx=Math.max.apply(null,S.bins.map(function(b){return b.n;}).concat([1]));
    h+='<div class="sub-h">競速：寫多久，答對多少</div><div class="bins">'+S.bins.map(function(b){
      var past=b.lo>=S.T;
      return '<div class="lab'+(past?' past':'')+'">'+b.label+'</div><div class="track"><div class="fill'+(b.n&&b.ok/b.n<0.4?' lo':b.n&&b.ok/b.n>=0.7?' hi':'')+'" style="width:'+(b.n?b.ok/b.n*100:0).toFixed(1)+'%"></div></div>'+
        '<div class="num">'+(b.n?b.ok+'/'+b.n+'（'+pct(b.ok/b.n)+'）':'沒有')+'</div><div class="cnt"><i style="width:'+(b.n/mx*100).toFixed(1)+'%"></i></div>';
    }).join('')+'</div><div class="legend"><span>長條：答對率</span><span>右邊細條：題數</span><span class="past">標色的時段在停損點之後</span></div>';
    var show=S.strips.slice(0,opts.teacher?8:4);
    if(show.length){
      h+='<div class="sub-h">最近的競速卷：每一格是一題，寬度是用時</div>'+show.map(function(p){
        var tot=p.qs.reduce(function(a,r){return a+(r.seconds||0);},0)||1, over=p.qs.filter(function(r){return r.seconds>=S.T;}), overW=over.filter(function(r){return !r.correct;}).length;
        var none=p.qs.filter(function(r){return !(r.seconds>0);}).length, s=p.sub||{};
        return '<div class="strip-h"><b>'+esc(s.title||s.setId||'')+'</b><span class="muted">　'+(s.score!=null?s.score+'/'+s.max+'・':'')+fmt(tot)+(over.length?'・超過停損點 '+over.length+' 題（錯 '+overW+' 題）':'')+(none?'・沒寫到 '+none+' 題':'')+'</span></div>'+
          '<div class="strip">'+p.qs.filter(function(r){return r.seconds>0;}).map(function(r){
            var st=r.correct?'ok':String(r.answer||'').trim()?'no':'bl', n=Number((String(r.qid).match(/(\d+)$/)||[])[1]);
            return '<span class="'+st+(r.seconds>=S.T?' over':'')+'" style="flex:'+r.seconds+' 0 0" title="第 '+n+' 題・'+fmt(r.seconds)+'・'+(st==='ok'?'對':st==='no'?'錯':'空白')+'">'+(r.seconds/tot>0.045?n:'')+'</span>';
          }).join('')+'</div>';
      }).join('')+'<div class="legend"><span><i class="sw ok"></i>對</span><span><i class="sw no"></i>錯</span><span><i class="sw bl"></i>空白</span><span><i class="sw over"></i>寫超過 '+fmt(S.T)+'</span></div>';
    }
  }
  var R=S.rounds;
  if(R.n){
    h+='<div class="sub-h">個人賽：一回合兩題（全對 3 分、對一題 1 分）</div>'+
      '<div>'+R.n+' 個回合：全對 '+R.full+'、對一題 '+R.one+'、全錯 '+R.zero+'。'+
      (R.hog?'其中 <b>'+R.hog+'</b> 回合是一題用掉 '+fmt(SL_ROUND_HOG)+' 以上、兩題都沒拿到：'+R.hogList.slice(0,4).map(function(x){return esc((x.sub&&(x.sub.title||x.sub.setId))||'')+' 第 '+x.round+' 回合';}).join('、')+(R.hog>4?' 等':'')+'。先把比較有把握的那題寫完，至少先拿 1 分，再回頭啃另一題。':'沒有「一題卡住、兩題都沒拿到」的回合。')+'</div>';
  }
  return h+'</div>';
}


/* 各屆試卷累計：同一屆的競速（26）＋個人（12）＝個人小計 38；團體賽 48 是全隊的。
 * 正式比賽總分 200＝四人的（競速＋個人）加總 152＋團體 48。每份卷子只算第一次作答。 */
function paperTotals(subs){
  var first={};
  (subs||[]).forEach(function(s){ if(!/^\d{4}$/.test(String(s.year))) return; var k=s.year+'|'+s.setId; if(s.attemptNo===1||!first[k]) if(!first[k]||s.attemptNo<first[k].attemptNo) first[k]=s; });
  var P={};
  Object.keys(first).forEach(function(k){ var s=first[k], m=String(s.setId).match(/^(\d{4})(.*)$/); if(!m) return;
    var key=s.year+'|'+m[1], x=P[key]||(P[key]={train:s.year,paper:m[1],a:null,b:null,full:null,ind:null,team:null});
    var t=m[2]; if(t==='a') x.a=s; else if(t==='b') x.b=s; else if(t==='full') x.full=s; else if(t==='ind') x.ind=s; else if(t==='team') x.team=s; });
  return Object.keys(P).map(function(k){ var x=P[k], sp=null, spNote='', spPart=null;
    var halves=x.a&&x.b?{score:Number(x.a.score)+Number(x.b.score),t:Math.max(tnum(x.a.time),tnum(x.b.time))}:null;
    if(x.full&&(!halves||tnum(x.full.time)<=halves.t)){ sp=Number(x.full.score); spNote='全卷'; }
    else if(halves){ sp=halves.score; spNote='前半 '+x.a.score+'＋後半 '+x.b.score; }
    else if(x.a||x.b){ var h=x.a||x.b; spPart=Number(h.score); spNote=(x.a?'只寫了前半 ':'只寫了後半 ')+h.score+'/13'; }
    var ind=x.ind?Number(x.ind.score):null, team=x.team?Number(x.team.score):null;
    var done=(sp!=null)+(ind!=null)+(team!=null);
    return {train:x.train,paper:x.paper,sp:sp,spPart:spPart,spNote:spNote,ind:ind,team:team,teamPending:x.team?Number(x.team.pending)||0:0,teamName:x.team?x.team.team:'',
      mine:(sp!=null&&ind!=null)?sp+ind:null,done:done};
  }).sort(function(a,b){return (b.train-a.train)||(b.paper-a.paper);});
}
function trendSvg(tr){
  if(tr.length<2) return '';
  var W=640,H=150,pl=34,pr=10,pt=12,pb=24, n=tr.length;
  var x=function(i){return pl+(W-pl-pr)*(n===1?0.5:i/(n-1));}, y=function(v){return pt+(H-pt-pb)*(1-v);};
  var grid=[0,.5,1].map(function(v){return '<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--line)"/><text x="'+(pl-6)+'" y="'+(y(v)+3)+'" text-anchor="end">'+Math.round(v*100)+'%</text>';}).join('');
  var line=function(kind,color){
    var pts=[]; tr.forEach(function(s,i){ if(s.kind===kind) pts.push([x(i),y(s.score/s.max),s]); });
    if(!pts.length) return '';
    return (pts.length>1?'<polyline fill="none" stroke="'+color+'" stroke-width="2" points="'+pts.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}).join(' ')+'"/>':'')+
      pts.map(function(p){return '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="4" fill="'+color+'"><title>'+esc(p[2].title+'：'+p[2].score+'/'+p[2].max)+'</title></circle>';}).join('');
  };
  return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="每份卷子第一次作答的得分率">'+grid+line('競速','var(--indigo)')+line('個人','var(--ochre)')+
    '<text x="'+pl+'" y="'+(H-6)+'">早</text><text x="'+(W-pr)+'" y="'+(H-6)+'" text-anchor="end">近</text></svg>';
}

function render(el,data,opts){
  injectCss(); opts=opts||{};
  var IMG=opts.imgBase||'img/', P=compute(data), me=data.me||{};
  var h='<div class="pf">';
  h+='<div class="sum">'+
    '<div><b>'+P.nQ+'</b><span>算進分析的題數（各卷第一次）</span></div>'+
    '<div><b>'+(P.spN?pct(P.spOk/P.spN):'–')+'</b><span>競速答對率'+(P.spN?'（'+P.spOk+'/'+P.spN+'）':'')+'</span></div>'+
    '<div><b>'+(isFinite(P.speedSec)?fmt(P.speedSec):'–')+'</b><span>競速每題平均用時'+(data.cls&&data.cls.speedSec?'，同年度平均 '+fmt(data.cls.speedSec):'')+'</span></div>'+
    '<div><b>'+(P.indN?P.indAvg.toFixed(1)+'<small style="font-size:1rem;color:var(--muted)"> / '+P.indMax+'</small>':'–')+'</b><span>個人賽平均得分'+(P.indN?'（'+P.indN+' 份）':'')+'</span></div>'+
  '</div>';

  var PT=paperTotals(data.subs);
  if(PT.length){
    var multi=PT.some(function(r){return r.train!==PT[0].train;});
    h+='<div class="sheet stack"><h2>各屆試卷累計</h2>'+
      '<div class="muted" style="font-size:.85rem">同一屆的三種卷子都寫完，就能看到那一屆的總成績。正式比賽：每人「競速 26＋個人 12＝38 分」，四人加起來 152 分，再加團體賽 48 分，全隊滿分 200。每份卷子只算第一次作答。</div>'+
      '<div class="tbl-wrap"><table><tr><th>試卷</th><th class="n">競速 /26</th><th class="n">個人 /12</th><th class="n">'+esc(opts.teacher?'個人小計':'我的小計')+' /38</th><th class="n">團體（全隊）/48</th><th>完成</th></tr>'+
      PT.map(function(r){
        var cell=function(v,mx){return v==null?'<span class="muted">–</span>':'<b>'+v+'</b>';};
        return '<tr><td>'+esc(r.paper)+' 年'+(multi?'<span class="muted">（'+esc(r.train)+' 練習）</span>':'')+'</td>'+
          '<td class="n">'+cell(r.sp)+(r.spNote&&r.spNote!=='全卷'?'<div class="muted" style="font-size:.75rem">'+esc(r.spNote)+'</div>':'')+'</td>'+
          '<td class="n">'+cell(r.ind)+'</td>'+
          '<td class="n">'+(r.mine==null?'<span class="muted">–</span>':'<b style="color:var(--indigo)">'+r.mine+'</b> <span class="muted">（'+pct(r.mine/38)+'）</span>')+'</td>'+
          '<td class="n">'+cell(r.team)+(r.teamPending?'<div class="muted" style="font-size:.75rem">證明題待批改 '+r.teamPending+'</div>':'')+'</td>'+
          '<td>'+(r.done===3?'<span style="color:var(--moss);font-weight:700">三份都寫完</span>':'<span class="muted">'+r.done+'/3'+(r.sp==null?(/前半/.test(r.spNote)?'・競速缺後半':/後半/.test(r.spNote)?'・競速缺前半':'・缺競速'):'')+(r.ind==null?'・缺個人':'')+(r.team==null?'・缺團體':'')+'</span>')+'</td></tr>';
      }).join('')+'</table></div></div>';
  }

  if(P.nQ){
    var li=function(x){ return '<li><b>'+esc(x.t)+'</b>　'+x.ok+'/'+x.n+'（'+pct(x.rate)+'）'+(isFinite(x.crate)?'，同年度平均 '+pct(x.crate):'')+'</li>'; };
    h+='<div class="call">'+
      '<div class="good"><h3>強項</h3>'+(P.strong.length?'<ul>'+P.strong.map(li).join('')+'</ul>':'<div class="muted">還看不出來。同一題型寫滿 3 題以上才會列出。</div>')+'</div>'+
      '<div class="bad"><h3>要加強</h3>'+(P.weak.length?'<ul>'+P.weak.map(li).join('')+'</ul>':'<div class="muted">目前沒有明顯落後的題型。</div>')+
        (P.slow.length?'<div style="margin-top:6px;font-size:.88rem">寫得比較慢：'+P.slow.map(function(x){return esc(x.t)+'（每題 '+fmt(x.avg)+'，平均 '+fmt(x.cavg)+'）';}).join('、')+'</div>':'')+'</div>'+
    '</div>';

    h+='<div class="sheet stack"><h2>各題型答對率</h2>'+
      '<div class="legend"><span><i style="width:18px;height:10px;border-radius:2px;background:var(--indigo)"></i>'+esc(opts.teacher?me.name:'我')+'</span><span><i style="width:2px;height:14px;background:var(--ink);opacity:.7"></i>同年度所有人的平均</span><span>右邊是答對題數與每題平均用時</span></div>'+
      '<div class="tp">'+P.topics.slice().sort(function(a,b){return b.rate-a.rate||b.n-a.n;}).map(function(x){
        var cls=x.n>=3?(x.rate<0.5?' lo':x.rate>=0.7?' hi':''):'';
        return '<div class="lab">'+esc(x.t)+'</div><div class="track" title="'+esc(x.t+'：'+x.ok+'/'+x.n)+'"><div class="fill'+cls+'" style="width:'+(x.rate*100).toFixed(1)+'%"></div>'+
          (isFinite(x.crate)?'<div class="mark" style="left:calc('+(x.crate*100).toFixed(1)+'% - 1px)"></div>':'')+'</div>'+
          '<div class="num">'+x.ok+'/'+x.n+'・'+fmt(x.avg)+'</div>';
      }).join('')+'</div>'+
      (Object.keys(P.years).length>1?'<div class="muted" style="font-size:.85rem">各年度：'+Object.keys(P.years).sort().map(function(y){var v=P.years[y];return esc(y)+' 年 '+pct(v.ok/v.n)+'（'+v.n+' 題）';}).join('、')+'</div>':'')+
    '</div>';
  }

  h+=stopLossHtml(stopLoss(data),opts);

  if(P.trend.length>=2) h+='<div class="sheet stack"><h2>得分率的變化</h2><div class="legend"><span><i style="width:10px;height:10px;border-radius:50%;background:var(--indigo)"></i>競速</span><span><i style="width:10px;height:10px;border-radius:50%;background:var(--ochre)"></i>個人賽</span><span>每份卷子只畫第一次</span></div>'+trendSvg(P.trend)+'</div>';

  if(P.wrong.length){
    var shown=P.wrong.slice(0,opts.teacher?40:12);
    h+='<div class="sheet stack"><h2>答錯的題目</h2><div class="muted" style="font-size:.85rem">弱的題型排前面'+(P.wrong.length>shown.length?'，先列 '+shown.length+' 題（共 '+P.wrong.length+' 題）':'')+'。可以挑幾題重算一次，算不出來再問老師。</div><div class="wq">'+
      shown.map(function(r){ var q=data.qinfo[r.qid]||{}, src=q.img?(/^(https?:|\/)/.test(q.img)?q.img:IMG+q.img):IMG+r.qid+'.png';
        return '<figure><img loading="lazy" src="'+esc(src)+'" alt="'+esc(r.qid)+' 題目"><figcaption>'+esc(r.qid)+'・'+esc(q.topic||'')+'・'+(r.kind==='個人'?'個人賽':'競速')+
          '・當時寫 '+(r.answer?'<b>'+esc(r.answer)+'</b>':'空白')+'・'+fmt(r.seconds)+'</figcaption>'+
          (q.sol?'<details class="sol" data-q="'+esc(r.qid)+'" data-src="'+esc(IMG.replace(/img\/$/,'')+q.sol)+'"><summary>看詳解</summary><div class="solbody"></div></details>':'')+'</figure>'; }).join('')+'</div></div>';
  }

  h+='<div class="sheet stack"><h2>作答紀錄</h2>'+(P.subs.length?'<div class="tbl-wrap"><table><tr><th>交卷時間</th><th>年度</th><th>賽別</th><th>卷子</th><th class="n">第幾次</th><th class="n">得分</th><th class="n">用時</th></tr>'+
    P.subs.map(function(s){ return '<tr><td>'+esc(s.time)+'</td><td>'+esc(s.year)+'</td><td>'+esc(s.kind)+(s.kind==='團體'?'（'+esc(s.team)+'）':'')+'</td><td>'+esc(s.title||s.setId)+'</td><td class="n">'+s.attemptNo+'</td>'+
      '<td class="n"><b>'+s.score+'</b>/'+s.max+(s.pending?' <span class="muted">待批改 '+s.pending+'</span>':'')+'</td><td class="n">'+fmt(s.usedSec)+'</td></tr>'; }).join('')+'</table></div>':'<div class="muted">還沒有交卷紀錄。</div>')+'</div>';
  h+='</div>';
  el.innerHTML=h;
  Array.prototype.forEach.call(el.querySelectorAll('details.sol'),function(dt){
    dt.addEventListener('toggle',function(){
      if(!dt.open||dt._loaded) return; dt._loaded=true;
      var b=dt.querySelector('.solbody'), im=new Image(); im.alt='詳解';
      im.onerror=function(){ b.innerHTML='<span style="color:var(--muted)">這題的詳解還沒放上來。</span>'; };
      im.src=dt.getAttribute('data-src'); b.appendChild(im);
      var qid=dt.getAttribute('data-q');
      if(window.TRMLNote&&qid){ var nb=document.createElement('div'); b.appendChild(nb);
        TRMLNote.mount(nb,{api:opts.api,auth:opts.auth,readonly:!opts.auth,qid:qid,note:(data.notes||{})[qid],shared:(data.shared||{})[qid]}); }
    });
  });
}
root.TRMLProfile={render:render,compute:compute,paperTotals:paperTotals,stopLoss:stopLoss};
})(typeof window!=='undefined'?window:this);
