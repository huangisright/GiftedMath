/* TRML 個人分析：學生頁（me.html）與老師頁共用的計算與畫面
 * TRMLProfile.render(el, data, opts)
 *   data = { me:{name,team,year,id}, subs:[…], resps:[…], qinfo:{qid:{topic,img}}, cls:{year,topics:{題型:{n,ok,sec}},speedSec} }
 *   opts = { imgBase:'img/', teacher:false }
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

  if(P.trend.length>=2) h+='<div class="sheet stack"><h2>得分率的變化</h2><div class="legend"><span><i style="width:10px;height:10px;border-radius:50%;background:var(--indigo)"></i>競速</span><span><i style="width:10px;height:10px;border-radius:50%;background:var(--ochre)"></i>個人賽</span><span>每份卷子只畫第一次</span></div>'+trendSvg(P.trend)+'</div>';

  if(P.wrong.length){
    var shown=P.wrong.slice(0,opts.teacher?40:12);
    h+='<div class="sheet stack"><h2>答錯的題目</h2><div class="muted" style="font-size:.85rem">弱的題型排前面'+(P.wrong.length>shown.length?'，先列 '+shown.length+' 題（共 '+P.wrong.length+' 題）':'')+'。可以挑幾題重算一次，算不出來再問老師。</div><div class="wq">'+
      shown.map(function(r){ var q=data.qinfo[r.qid]||{}, src=q.img?(/^(https?:|\/)/.test(q.img)?q.img:IMG+q.img):IMG+r.qid+'.png';
        return '<figure><img loading="lazy" src="'+esc(src)+'" alt="'+esc(r.qid)+' 題目"><figcaption>'+esc(r.qid)+'・'+esc(q.topic||'')+'・'+(r.kind==='個人'?'個人賽':'競速')+
          '・當時寫 '+(r.answer?'<b>'+esc(r.answer)+'</b>':'空白')+'・'+fmt(r.seconds)+'</figcaption>'+
          (q.sol?'<details class="sol" data-src="'+esc(IMG.replace(/img\/$/,'')+q.sol)+'"><summary>看詳解</summary><div class="solbody"></div></details>':'')+'</figure>'; }).join('')+'</div></div>';
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
    });
  });
}
root.TRMLProfile={render:render,compute:compute};
})(typeof window!=='undefined'?window:this);
