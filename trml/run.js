/* TRML 練習：作答頁共用程式（競速／個人／團體）
 * 頁面用 <body data-kind="競速|個人|團體"> 決定規則：
 *   競速：一題一頁、可跳題，整份卷子一個倒數。
 *   個人：兩題一回合、同一頁作答；回合時間到自動進下一回合，進了就不能回頭。
 *   團體：一題一頁、可跳題；答案寫「人工」的題目（證明題）改成寫過程＋拍照上傳。 */
(function(){
'use strict';
var KIND=document.body.getAttribute('data-kind')||'競速';
var API=(window.TRML_CONFIG&&window.TRML_CONFIG.apiUrl)||'';
var IMG_BASE=(window.TRML_CONFIG&&window.TRML_CONFIG.imgBase)||'img/';
var DEMO=!API;
var $=function(id){ return document.getElementById(id); };

var DEMO_DATA={
  teams:[{team:'範例一隊',members:['王小明','林小華','陳小安','李小青']},{team:'範例二隊',members:['張小宇','黃小晴','吳小哲','劉小芸']}],
  sets:[{id:'demo',kind:'競速',title:'範例卷　改寫自歷屆競速題',minutes:8,questions:[
    {qid:'D1',text:'解方程式\n2x/(1×2) + 2x/(2×3) + 2x/(3×4) + … + 2x/(2017×2018) = 2017\n求 x。'},
    {qid:'D2',text:'數列滿足 a₁ = 1，a₂ₙ = aₙ，a₂ₙ₊₁ = aₙ + 1。求 a₁₀₄。'},
    {qid:'D3',text:'某正整數的所有正因數和為 56，所有正因數的倒數和為 2。求這個正整數。'},
    {qid:'D4',text:'正方形的對角線長為 6，求邊長。'}
  ]}]
};
var DEMO_ANS={D1:'1009',D2:'3',D3:'28',D4:'3√2'};

function load(k){ try{ var v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch(e){ return null; } }
function save(k,v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
var SUF=KIND==='競速'?'':(KIND==='個人'?'-ind':'-team');
var RUN_KEY='trml-run'+SUF, PHOTO_KEY='trml-photos'+SUF, PEND_KEY='trml-pending'+SUF, HIST_KEY='trml-history', WHO_KEY='trml-who', PASS_KEY='trml-pass';

var cfg=null, run=null, timer=null, lastTick=0, lastInput=null;

function fmt(sec){ sec=Math.max(0,Math.round(sec)); var m=Math.floor(sec/60), s=sec%60; return (m<10?'0':'')+m+':'+(s<10?'0':'')+s; }
function show(v){ ['v-login','v-run','v-result'].forEach(function(id){ $(id).hidden = id!==v; }); window.scrollTo(0,0); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function postJ(url,body,n){ n=n||0;
  // Apps Script 偶爾把 POST 的回覆換成首頁資料（有 teams、sets，沒有這次要的結果）；同一份再送一次是安全的（後端會認出重複）
  return fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(d){
    if(d&&d.teams&&d.sets&&n<3) return new Promise(function(res){setTimeout(res,800*(n+1));}).then(function(){return postJ(url,body,n+1);});
    if(d&&d.teams&&d.sets) throw new Error('伺服器回覆不完整，請再按一次');
    return d; }); }
function post(body){ return postJ(API,body); }
function each(sel,root,fn){ Array.prototype.forEach.call((root||document).querySelectorAll(sel),fn); }
function nRounds(set){ return Math.ceil(set.questions.length/2); }

/* ---------- 名單與卷子 ---------- */
function boot(){
  if(DEMO){ $('demoNote').hidden=false; $('pinWrap').hidden=true; cfg=JSON.parse(JSON.stringify(DEMO_DATA)); cfg.sets=cfg.sets.filter(mine); renderLogin(); return; }
  $('sets').innerHTML='<div class="muted">讀取中…</div>';
  fetch(API+'?action=init').then(function(r){return r.json();}).then(function(d){
    if(!d.ok) throw new Error(d.error||'讀取失敗');
    d.sets=d.sets.filter(mine); cfg=d; renderLogin(); autoUnlock();
  }).catch(function(e){
    $('sets').innerHTML=''; $('loadErr').hidden=false;
    $('loadErr').textContent='讀不到題庫：'+e.message+'。請確認網路，或請老師檢查設定。';
  });
}
function mine(s){ return (s.kind||'競速')===KIND; }

function renderLogin(){
  var who=load(WHO_KEY)||{};
  var ts=$('team'); ts.innerHTML='<option value="">選隊伍</option>'+cfg.teams.map(function(t){return '<option>'+esc(t.team)+'</option>';}).join('');
  if(who.team) ts.value=who.team;
  fillNames(who.name);
  if(who.pin) $('pin').value=who.pin;
  var remember=function(){ save(WHO_KEY,{team:ts.value,name:$('name').value,pin:$('pin').value.trim()}); };
  ts.onchange=function(){ fillNames(); $('pin').value=''; remember(); renderSets(); };
  $('name').onchange=function(){ $('pin').value=''; remember(); renderSets(); };
  $('pin').oninput=remember;
  renderSets(); renderResume(); renderPending();
}
function fillNames(sel){
  var t=cfg.teams.filter(function(x){return x.team===$('team').value;})[0];
  $('name').innerHTML='<option value="">選姓名</option>'+(t?t.members.map(function(n){return '<option>'+esc(n)+'</option>';}).join(''):'');
  if(sel) $('name').value=sel;
}
function isOpen(s){ return !!s.questions; }
function meta(s){
  var cnt=s.questions?s.questions.length:(s.count||0);
  if(KIND==='個人') return Math.ceil(cnt/2)+' 回合・每回合 2 題・'+s.minutes+' 分鐘';
  return cnt+' 題・'+s.minutes+' 分鐘';
}
function renderSets(){
  var hist=load(HIST_KEY)||{}, team=$('team').value, name=$('name').value, ready=!!(team&&name);
  if(!cfg.sets.length){ $('sets').innerHTML='<div class="muted">目前沒有開放的卷子。</div>'; return; }
  var order=cfg.sets.map(function(s,i){return i;}).sort(function(a,b){ return (isOpen(cfg.sets[b])?1:0)-(isOpen(cfg.sets[a])?1:0) || a-b; });
  $('sets').innerHTML=order.map(function(i){
    var s=cfg.sets[i], n=hist[s.id+'|'+team+'|'+name];
    var head='<b>'+esc(s.title)+'</b><div class="meta">'+meta(s)+'</div>'+(s.note?'<div class="note">'+esc(s.note)+'</div>':'');
    if(isOpen(s)) return '<div class="set">'+head+
      (n?'<div class="done">這台裝置上已交過 '+n.count+' 次，最近一次 '+n.score+'/'+(n.max||n.total)+(n.pending?'（證明題待批改）':'')+'</div>':'')+
      '<button class="primary" data-start="'+i+'"'+(ready?'':' disabled')+'>開始</button></div>';
    if(s.status==='scheduled') return '<div class="set locked">'+head+'<div class="lock">'+esc(s.openDate||'')+' 開放</div></div>';
    return '<div class="set locked">'+head+'<div class="lock">需要通關密碼</div>'+
      '<div class="unlock"><input type="text" id="pass-'+i+'" autocomplete="off" spellcheck="false" placeholder="通關密碼" aria-label="'+esc(s.title)+' 的通關密碼"><button data-unlock="'+i+'">解鎖</button></div>'+
      '<div class="err" id="perr-'+i+'"></div></div>';
  }).join('') + (ready?'':'<div class="muted">先選隊伍和姓名。</div>');
  each('[data-start]',$('sets'),function(b){ b.onclick=function(){ askStart(cfg.sets[+b.getAttribute('data-start')]); }; });
  each('[data-unlock]',$('sets'),function(b){
    var i=+b.getAttribute('data-unlock'), inp=$('pass-'+i);
    b.onclick=function(){ unlock(i, inp.value.trim()); };
    inp.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.isComposing) unlock(i, inp.value.trim()); });
  });
}
function unlock(i, pass, silent){
  var s=cfg.sets[i]; if(!pass) return;
  var err=$('perr-'+i); if(err&&!silent) err.textContent='確認中…';
  return post({action:'unlock',setId:s.id,pass:pass}).then(function(d){
    if(!d.ok){ if(!silent&&$('perr-'+i)) $('perr-'+i).textContent=d.error||'通關密碼不對'; return; }
    s.questions=d.questions; s.setPass=pass;
    var m=load(PASS_KEY)||{}; m[s.id]=pass; save(PASS_KEY,m);
    renderSets();
  }).catch(function(){ if(!silent&&$('perr-'+i)) $('perr-'+i).textContent='連不上題庫，請確認網路後再試。'; });
}
function autoUnlock(){
  var m=load(PASS_KEY)||{};
  cfg.sets.forEach(function(s,i){ if(!s.questions && s.status==='locked' && m[s.id]) unlock(i,m[s.id],true); });
}
function rulesText(set){
  if(KIND==='個人') return '<div><b>'+esc(set.title)+'</b>：'+nRounds(set)+' 回合，每回合 2 題、'+set.minutes+' 分鐘。</div>'+
    '<div class="muted">回合時間到會自動進下一回合；進了下一回合，前面的就不能再改。每回合兩題全對 3 分、對一題 1 分。</div>';
  if(KIND==='團體') return '<div><b>'+esc(set.title)+'</b>：'+set.questions.length+' 題，倒數 '+set.minutes+' 分鐘。</div>'+
    '<div class="muted">一隊交一份：請隊長用一台裝置作答，其他人一起算。證明題寫出過程，也可以把紙本拍照上傳。時間到會自動交卷。</div>';
  return '<div><b>'+esc(set.title)+'</b>：'+set.questions.length+' 題，倒數 '+set.minutes+' 分鐘。</div>'+
    '<div class="muted">開始後不能暫停；切到別的畫面時間照樣走。時間到會自動交卷。</div>';
}
function askStart(set){
  var c=$('confirm'); c.hidden=false;
  c.innerHTML=rulesText(set)+'<div class="row"><button class="primary" id="go">開始計時</button><button id="cancel">先不要</button></div>';
  c.scrollIntoView({block:'center',behavior:'smooth'});
  $('cancel').onclick=function(){ c.hidden=true; };
  $('go').onclick=function(){
    if(DEMO){ c.hidden=true; startRun(set); return; }
    var btn=$('go'); btn.disabled=true; btn.textContent='確認代碼中…';
    var fail=function(msg){ btn.disabled=false; btn.textContent='開始計時';
      var e=c.querySelector('.err'); if(!e){ e=document.createElement('div'); e.className='err'; c.appendChild(e); } e.textContent=msg; };
    post({action:'login',team:$('team').value,name:$('name').value,pin:$('pin').value.trim()}).then(function(d){
      if(d.ok){ c.hidden=true; startRun(set); return; }
      fail(d.error||'代碼不對，請再確認一次。'); $('pin').focus();
    }).catch(function(){ fail('連不上題庫，請確認網路後再按一次。'); });
  };
}
function deadlineOf(r){ return r.kind==='個人'?r.roundEnd:r.deadline; }
function renderResume(){
  var r=load(RUN_KEY), box=$('resume');
  if(!r){ box.hidden=true; return; }
  var left=(deadlineOf(r)-Date.now())/1000;
  var lastRound=r.kind!=='個人'||r.round>=nRounds(r.set)-1;
  box.hidden=false;
  if(left>0||!lastRound){
    box.innerHTML='<div class="row" style="justify-content:space-between"><div><b>'+esc(r.set.title)+'</b> 還沒交（'+esc(r.name)+'）'+(left>0?'，剩 '+fmt(left):'')+'。</div><button class="primary" id="resumeGo">繼續作答</button></div>';
    $('resumeGo').onclick=function(){ run=r; run.photos=load(PHOTO_KEY)||{}; enterRun(); };
  }else{
    box.innerHTML='<div class="row" style="justify-content:space-between"><div><b>'+esc(r.set.title)+'</b> 的時間已經到了，還沒送出（'+esc(r.name)+'）。</div><button class="warn" id="resumeGo">現在交卷</button></div>';
    $('resumeGo').onclick=function(){ run=r; run.photos=load(PHOTO_KEY)||{}; submit(true); };
  }
}
function renderPending(){
  var p=load(PEND_KEY), box=$('pending');
  if(!p||DEMO){ box.hidden=true; return; }
  box.hidden=false;
  box.innerHTML='<div class="row" style="justify-content:space-between"><div>有一份〈'+esc(p.setTitle)+'〉的答案上次沒送出去。</div><button class="primary" id="pendGo">重新送出</button></div>';
  $('pendGo').onclick=function(){ sendPayload(p, null); };
}

/* ---------- 作答 ---------- */
function startRun(set){
  var now=Date.now();
  run={ kind:KIND, set:set, setPass:set.setPass||'', team:$('team').value, name:$('name').value, pin:$('pin').value.trim(), startedAt:now,
        deadline:now+set.minutes*60000, answers:{}, secs:{}, cur:0, photos:{}, clientId:'c'+now.toString(36)+Math.random().toString(36).slice(2,8) };
  if(KIND==='個人'){ run.round=0; run.roundEnd=now+set.minutes*60000; run.deadline=now+nRounds(set)*set.minutes*60000; run.focus=set.questions[0].qid; }
  set.questions.forEach(function(q){ run.answers[q.qid]=''; run.secs[q.qid]=0; });
  save(PHOTO_KEY,null); save(RUN_KEY,run); enterRun();
}
function persist(){ var p=run.photos; delete run.photos; save(RUN_KEY,run); run.photos=p; }
function enterRun(){
  lastTick=Date.now();
  show('v-run');
  $('rTitle').textContent=run.set.title;
  $('rWho').textContent=run.team+'・'+run.name;
  $('subConfirm').hidden=true;
  if(KIND==='個人') renderRound(); else { buildSingle(); buildCells(); renderQ(); }
  lastTick=Date.now();
  clearInterval(timer); timer=setInterval(tick,500); tick();
}
function curQ(){ return run.set.questions[run.cur]; }
function account(){
  var now=Date.now();
  if(run && lastTick && document.visibilityState!=='hidden'){
    var qid=KIND==='個人'?run.focus:curQ().qid;
    if(qid) run.secs[qid]=(run.secs[qid]||0)+(now-lastTick)/1000;
  }
  lastTick=now;
}
function tick(){
  if(!run) return;
  account();
  var left=(deadlineOf(run)-Date.now())/1000, c=$('clock');
  c.textContent=fmt(left);
  var warnAt=KIND==='個人'?60:300;
  c.className='clock'+(left<=30||(KIND!=='個人'&&left<=60)?' danger':left<=warnAt?' warn':'');
  if(left<=0){
    if(KIND==='個人' && run.round<nRounds(run.set)-1){ nextRound(true); return; }
    submit(true); return;
  }
  persist();
}
document.addEventListener('visibilitychange',function(){ if(run){ if(document.visibilityState==='hidden') account(); else lastTick=Date.now(); }});

function imgSrc(q){
  var f=q.img||((q.text)?'':q.qid+'.png');
  if(!f) return '';
  return /^(https?:|data:|\/)/.test(f)?f:IMG_BASE+f;
}
function fillBody(el,q,label){
  el.innerHTML='';
  var src=imgSrc(q);
  if(src){ var im=new Image(); im.src=src; im.alt=label+'題目'; im.onerror=function(){ el.textContent='（題目圖片讀不到：'+src+'）'; }; el.appendChild(im); }
  if(q.text){ var t=document.createElement('div'); t.textContent=q.text; el.appendChild(t); }
}
var HINT='分數寫 3/4，根號按 √，圓周率按 π，多個答案用逗號隔開。';
function keysHtml(){ return ['√','π','/','^','(',')',',','-'].map(function(k){return '<button type="button" data-k="'+k+'" aria-label="輸入 '+k+'">'+k+'</button>';}).join(''); }
function bindKeys(box){
  each('button',box,function(b){
    b.onmousedown=function(e){ e.preventDefault(); };
    b.onclick=function(){
      var a=lastInput; if(!a) return;
      var s=a.selectionStart==null?a.value.length:a.selectionStart, e2=a.selectionEnd==null?s:a.selectionEnd;
      a.value=a.value.slice(0,s)+b.getAttribute('data-k')+a.value.slice(e2);
      a.setSelectionRange(s+1,s+1); a.dispatchEvent(new Event('input')); a.focus();
    };
  });
}

/* 一題一頁（競速、團體） */
function buildSingle(){
  $('runBody').innerHTML='<div class="sheet qcard">'+
    '<div class="qno" id="qno"></div><div class="qbody" id="qbody"></div>'+
    '<div id="autoBox" class="stack" style="gap:10px">'+
      '<div class="ans"><input type="text" id="answer" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="答案"></div>'+
      '<div class="keys" id="keys">'+keysHtml()+'</div><div class="hint">'+HINT+'按 Enter 到下一題。</div></div>'+
    '<div id="manualBox" class="stack" style="gap:10px" hidden>'+
      '<div class="hint">這題要寫出求解或證明過程，老師會批改。可以直接打字，也可以寫在紙上拍照上傳（最多 3 張）。</div>'+
      '<textarea id="proof" aria-label="過程"></textarea>'+
      '<div class="photos" id="photos"></div></div>'+
    '<div class="nav"><button id="prev">上一題</button><button id="next" class="primary">下一題</button></div></div>';
  $('cellsBox').hidden=false;
  var a=$('answer');
  lastInput=a;
  a.addEventListener('input',function(){ run.answers[curQ().qid]=this.value; updateCells(); persist(); });
  a.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); go(run.cur+1); }});
  $('proof').addEventListener('input',function(){ run.answers[curQ().qid]=this.value; updateCells(); persist(); });
  $('prev').onclick=function(){ go(run.cur-1); };
  $('next').onclick=function(){ go(run.cur+1); };
  bindKeys($('keys'));
}
function renderQ(){
  var q=curQ(), n=run.set.questions.length;
  $('qno').innerHTML='第 '+(run.cur+1)+' 題　／ 共 '+n+' 題'+(q.manual?'　<span class="badge">寫過程・老師批改</span>':'');
  fillBody($('qbody'),q,'第 '+(run.cur+1)+' 題');
  $('autoBox').hidden=!!q.manual; $('manualBox').hidden=!q.manual;
  if(q.manual){ $('proof').value=run.answers[q.qid]||''; renderPhotos(q); }
  else { var a=$('answer'); a.value=run.answers[q.qid]||''; if(window.matchMedia('(pointer:fine)').matches) a.focus(); }
  $('prev').disabled=run.cur===0;
  $('next').textContent=run.cur===n-1?'看答案格':'下一題';
  updateCells();
}
function go(i){
  account();
  var n=run.set.questions.length;
  if(i>=n){ $('cells').scrollIntoView({behavior:'smooth',block:'center'}); return; }
  run.cur=Math.max(0,Math.min(n-1,i)); persist(); renderQ();
}
function buildCells(){
  $('cellsLabel').textContent='答案格　點題號可以跳題';
  $('cells').innerHTML=run.set.questions.map(function(q,i){return '<button type="button" class="cell'+(q.manual?' manual':'')+'" data-i="'+i+'">'+(i+1)+'</button>';}).join('');
  each('.cell',$('cells'),function(c){ c.onclick=function(){ go(+c.getAttribute('data-i')); window.scrollTo({top:0,behavior:'smooth'}); }; });
}
function hasAns(q){ return !!(run.answers[q.qid]||'').trim() || !!((run.photos||{})[q.qid]||[]).length; }
function updateCells(){
  var filled=0;
  each('.cell',$('cells'),function(c,i){
    var q=run.set.questions[i], has=hasAns(q);
    if(has) filled++;
    c.className='cell'+(q.manual?' manual':'')+(has?' filled':'')+(KIND!=='個人'&&i===run.cur?' cur':'');
  });
  $('rCount').textContent='已填 '+filled+'/'+run.set.questions.length;
}

/* 證明題照片：先在手機上縮小成 1600px 的 JPEG 再存 */
function renderPhotos(q){
  var list=run.photos[q.qid]||[];
  $('photos').innerHTML=list.map(function(d,i){return '<div class="ph"><img src="'+d+'" alt="第 '+(i+1)+' 張照片"><button type="button" data-del="'+i+'" aria-label="刪除這張">×</button></div>';}).join('')+
    (list.length<3?'<label class="filebtn">＋ 拍照或選照片<input type="file" accept="image/*" id="photoIn"></label>':'')+
    '<span class="hint" id="photoMsg"></span>';
  each('[data-del]',$('photos'),function(b){ b.onclick=function(){ list.splice(+b.getAttribute('data-del'),1); run.photos[q.qid]=list; savePhotos(); renderPhotos(q); updateCells(); }; });
  var inp=$('photoIn');
  if(inp) inp.onchange=function(){
    var f=inp.files&&inp.files[0]; if(!f) return;
    $('photoMsg').textContent='處理中…';
    shrink(f).then(function(d){ list.push(d); run.photos[q.qid]=list; var ok=savePhotos(); renderPhotos(q); updateCells();
      if(!ok) $('photoMsg').textContent='照片太大存不進這台裝置的暫存，交卷前請不要關掉網頁。'; })
      .catch(function(){ $('photoMsg').textContent='這張照片讀不出來，換一張試試。'; });
  };
}
function savePhotos(){ return save(PHOTO_KEY,run.photos); }
function shrink(file){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(file), img=new Image();
    img.onload=function(){
      var s=Math.min(1,1600/Math.max(img.width,img.height)), c=document.createElement('canvas');
      c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
      var g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',0.72));
    };
    img.onerror=function(){ URL.revokeObjectURL(url); rej(); };
    img.src=url;
  });
}

/* 一回合兩題（個人） */
function roundQs(){ return run.set.questions.slice(run.round*2, run.round*2+2); }
function renderRound(){
  var R=nRounds(run.set), qs=roundQs();
  $('runBody').innerHTML='<div class="sheet stack">'+
    '<div class="row" style="justify-content:space-between"><div class="roundtag">第 '+(run.round+1)+' 回合　／ 共 '+R+' 回合</div><div class="hint">兩題全對 3 分、對一題 1 分</div></div>'+
    '<div class="qpair">'+qs.map(function(q,i){ var no=run.round*2+i+1;
      return '<div class="qcard"><div class="qno">第 '+no+' 題</div><div class="qbody" id="qb-'+i+'"></div>'+
        '<div class="ans"><input type="text" data-q="'+esc(q.qid)+'" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="第 '+no+' 題答案"></div></div>'; }).join('')+'</div>'+
    '<div class="keys" id="keys">'+keysHtml()+'</div><div class="hint">'+HINT+'</div></div>';
  qs.forEach(function(q,i){ fillBody($('qb-'+i),q,'第 '+(run.round*2+i+1)+' 題'); });
  each('input[data-q]',$('runBody'),function(inp,i){
    var qid=inp.getAttribute('data-q');
    inp.value=run.answers[qid]||'';
    inp.addEventListener('focus',function(){ account(); run.focus=qid; lastInput=inp; });
    inp.addEventListener('input',function(){ run.answers[qid]=inp.value; updateCells(); persist(); });
    inp.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); var all=$('runBody').querySelectorAll('input[data-q]'); if(all[i+1]) all[i+1].focus(); }});
    if(i===0){ lastInput=inp; if(window.matchMedia('(pointer:fine)').matches) inp.focus(); }
  });
  if(!run.focus||qs.every(function(q){return q.qid!==run.focus;})) run.focus=qs[0].qid;
  bindKeys($('keys'));
  $('cellsLabel').textContent='答案格　灰色是還沒到的回合，已經過去的回合不能再改';
  $('cells').innerHTML=run.set.questions.map(function(q,i){ var r=Math.floor(i/2);
    return '<div class="cell" data-r="'+r+'" style="'+(r>run.round?'opacity:.45':'')+'">'+(i+1)+'</div>'; }).join('');
  $('cellsBox').hidden=false;
  $('btnSubmit').textContent=run.round<R-1?'結束這回合':'交卷';
  updateCells();
}
function nextRound(auto){
  account();
  var m=run.set.minutes*60000;
  run.roundEnd=(auto?run.roundEnd:Date.now())+m;
  run.round++; run.focus=null; persist();
  $('subConfirm').hidden=true;
  renderRound(); window.scrollTo(0,0);
}

$('btnSubmit').onclick=function(){
  var c=$('subConfirm'); c.hidden=false;
  if(KIND==='個人' && run.round<nRounds(run.set)-1){
    var emp=roundQs().filter(function(q){return !(run.answers[q.qid]||'').trim();}).length;
    c.innerHTML='<div>'+(emp?'這回合還有 <b>'+emp+'</b> 題沒填。':'這回合兩題都填了。')+'進下一回合後，這回合就不能再改；下一回合從現在開始計時。</div>'+
      '<div class="row"><button class="warn" id="subGo">進下一回合</button><button id="subNo">繼續寫</button></div>';
    window.scrollTo({top:0,behavior:'smooth'});
    $('subNo').onclick=function(){ c.hidden=true; };
    $('subGo').onclick=function(){ nextRound(false); };
    return;
  }
  var qs=KIND==='個人'?roundQs():run.set.questions;
  var empty=qs.filter(function(q){return !hasAns(q);}).length;
  c.innerHTML='<div>'+(empty?'還有 <b>'+empty+'</b> 題沒填。':'每一題都填了。')+'交卷後就不能再改。</div>'+
    '<div class="row"><button class="warn" id="subGo">確定交卷</button><button id="subNo">繼續寫</button></div>';
  window.scrollTo({top:0,behavior:'smooth'});
  $('subNo').onclick=function(){ c.hidden=true; };
  $('subGo').onclick=function(){ submit(false); };
};

/* ---------- 交卷 ---------- */
function submit(auto){
  if(!run||run._sending) return;
  account(); clearInterval(timer);
  run._sending=true;
  var total=KIND==='個人'?nRounds(run.set)*run.set.minutes*60:run.set.minutes*60;
  var used=Math.min(total,(Math.min(Date.now(),run.deadline)-run.startedAt)/1000);
  var photos=run.photos||{};
  var payload={ action:'submit', kind:KIND, setId:run.set.id, setTitle:run.set.title, team:run.team, name:run.name, pin:run.pin||'', setPass:run.setPass||'', clientId:run.clientId,
    startedAt:run.startedAt, usedSec:Math.round(used), auto:!!auto,
    responses:run.set.questions.map(function(q){ var o={qid:q.qid, answer:(run.answers[q.qid]||'').trim(), seconds:Math.round(run.secs[q.qid]||0)};
      if(q.manual){ o.manual=true; if((photos[q.qid]||[]).length) o.photos=photos[q.qid]; } return o; }) };
  var snapshot=run;
  if(!save(PEND_KEY,payload)){ var lite=JSON.parse(JSON.stringify(payload)); lite.responses.forEach(function(r){ delete r.photos; }); save(PEND_KEY,lite); }
  save(RUN_KEY,null); save(PHOTO_KEY,null); run=null;
  sendPayload(payload, snapshot);
}
function sendPayload(payload, snapshot){
  var set=snapshot?snapshot.set:(cfg.sets.filter(function(s){return s.id===payload.setId;})[0])||{questions:payload.responses.map(function(r){return {qid:r.qid,manual:r.manual};})};
  if(DEMO){
    var results=payload.responses.map(function(r){ var ok=!!r.answer&&TRMLGrade.isCorrect(r.answer,DEMO_ANS[r.qid]); return {qid:r.qid,correct:ok,expected:DEMO_ANS[r.qid]}; });
    var sc=results.filter(function(r){return r.correct;}).length;
    return done({ok:true,kind:'競速',score:sc,max:results.length,total:results.length,results:results,showAnswers:true,attemptNo:1});
  }
  show('v-result');
  $('resTitle').textContent=payload.setTitle; $('resWho').textContent=payload.team+'・'+payload.name;
  $('resScore').textContent='送出中…'; $('resUsed').textContent=fmt(payload.usedSec); $('resNote').textContent=''; $('resCells').innerHTML=''; $('resTable').innerHTML=''; $('resSlow').textContent='';
  post(payload).then(function(d){ if(!d.ok) throw new Error(d.error||'送出失敗'); done(d); })
    .catch(function(e){
      $('resScore').textContent='沒送出去';
      $('resNote').innerHTML='<span class="err">'+esc(e.message)+'</span>。答案已經存在這台裝置上，回到清單按「重新送出」即可。';
    });
  function done(d){
    save(PEND_KEY,null);
    var hist=load(HIST_KEY)||{}, k=payload.setId+'|'+payload.team+'|'+payload.name, h=hist[k]||{count:0};
    hist[k]={count:h.count+1,score:d.score,total:d.total,max:d.max,pending:d.pending||0}; save(HIST_KEY,hist);
    renderResult(payload,d,set);
  }
}
function renderResult(p,d,set){
  show('v-result');
  var kind=d.kind||KIND;
  $('resTitle').textContent=p.setTitle; $('resWho').textContent=p.team+'・'+p.name+(d.attemptNo>1?'・第 '+d.attemptNo+' 次':'');
  $('resScore').innerHTML=d.score+'<small> / '+(d.max||d.total)+(kind==='個人'?' 分':kind==='團體'?' 分':'')+'</small>';
  $('resUsed').textContent=fmt(p.usedSec);
  var notes=[];
  if(p.auto) notes.push('時間到自動交卷。');
  if(kind==='團體'&&d.pending) notes.push('證明題 '+d.pending+' 題等老師批改，現在的分數還沒算進去。');
  if(d.attemptNo>1) notes.push('老師的統計以第一次為準。');
  $('resNote').textContent=notes.join('');
  var pb=$('pinBox');
  if(!pb){ pb=document.createElement('div'); pb.id='pinBox'; pb.className='confirm stack'; pb.style.borderColor='var(--ochre)'; pb.style.background='var(--ochre-soft)';
    var anchor=$('v-result').querySelector('.sheet'); anchor.parentNode.insertBefore(pb,anchor); }
  pb.hidden=!d.apin;
  if(d.apin) pb.innerHTML='<div><b>'+esc(p.name)+'，這是你的「我的分析」密碼：</b></div>'+
    '<div style="font-family:var(--f-mono);font-size:2.4rem;font-weight:700;letter-spacing:.2em;color:var(--ochre)">'+esc(d.apin)+'</div>'+
    '<div>請現在記下來或截圖。<b>這組密碼只會顯示這一次</b>，之後交卷不會再出現；忘了再問老師。用它在首頁的「我的分析」看自己的強弱項，只有你自己看得到。</div>';
  var resp={}; p.responses.forEach(function(r){resp[r.qid]=r;});
  $('resCells').innerHTML=d.results.map(function(r,i){return '<div class="cell '+(r.manual?'wait':r.correct?'ok':'no')+'">'+(i+1)+'</div>';}).join('');
  var max=Math.max.apply(null,p.responses.map(function(r){return r.seconds;}).concat([1]));
  var order=p.responses.map(function(r,i){return {i:i,s:r.seconds};}).sort(function(a,b){return b.s-a.s;}).slice(0,3).filter(function(x){return x.s>0;});
  $('resSlow').textContent=kind==='個人'?'個人賽同一回合的兩題一起顯示，用時是依你點在哪一格答案來算的，僅供參考。':
    (order.length?'花最久的是第 '+order.map(function(x){return (x.i+1)+' 題（'+fmt(x.s)+'）';}).join('、第 ')+'。':'');
  var showA=d.showAnswers;
  var head='<tr>'+(kind==='個人'?'<th>回合</th>':'')+'<th>題</th><th>作答</th>'+(showA?'<th>正確答案</th>':'')+'<th></th>'+(kind==='團體'?'<th>得分</th>':'')+'<th>用時</th><th style="width:34%"></th></tr>';
  $('resTable').innerHTML=head+d.results.map(function(r,i){ var x=resp[r.qid]||{answer:'',seconds:0};
    var ansCell=r.manual?((x.answer?esc(x.answer.slice(0,30))+(x.answer.length>30?'…':''):'')+((x.photos||[]).length?' <span class="badge">照片 '+x.photos.length+' 張</span>':'')||'<span class="muted">（空白）</span>')
      :(x.answer?esc(x.answer):'<span class="muted">（空白）</span>');
    var roundCell='';
    if(kind==='個人'){ if(i%2===0) roundCell='<td rowspan="2" class="mono">第 '+(i/2+1)+' 回合<br><b>'+((d.rounds||[])[i/2]||0)+' 分</b></td>'; }
    return '<tr>'+roundCell+'<td class="mono">'+(i+1)+'</td><td class="mono">'+ansCell+'</td>'+
      (showA?'<td class="mono">'+esc(r.expected||'')+'</td>':'')+
      '<td class="'+(r.manual?'muted">待批改':(r.correct?'mark-ok">○':'mark-no">×'))+'</td>'+
      (kind==='團體'?'<td class="mono">'+(r.manual?'–':r.points)+'</td>':'')+
      '<td class="mono">'+fmt(x.seconds)+'</td>'+
      '<td><span class="tbar'+(r.correct?'':' no')+'" style="width:'+(100*x.seconds/max).toFixed(1)+'%"></span></td></tr>';
  }).join('');
  renderSols(d.results,p,d);
}
/* 詳解：交卷後才拿得到圖檔位置；點開才載入圖片 */
function renderSols(results,p,d){
  var box=$('resSol');
  if(!box){ box=document.createElement('div'); box.id='resSol'; box.className='sheet stack';
    var tbl=$('resTable').closest('.sheet'); tbl.parentNode.insertBefore(box,tbl.nextSibling); }
  var has=results.some(function(r){return r.sol;});
  box.hidden=!has; if(!has){ box.innerHTML=''; return; }
  box.innerHTML='<h2>詳解</h2><div class="muted" style="font-size:.88rem">點題號展開。先自己再想一次，真的想不出來再看。看完可以在下面留回饋：這題難不難、卡在哪、你的想法或另解。</div>'+
    results.map(function(r,i){ if(!r.sol) return '';
      var mark=r.manual?'<span class="muted">證明題</span>':(r.correct?'<span class="mark-ok">○</span>':'<span class="mark-no">×</span>');
      return '<details class="sol" data-q="'+esc(r.qid)+'" data-src="'+esc(IMG_BASE.replace(/img\/$/,'')+r.sol)+'"><summary>第 '+(i+1)+' 題　'+mark+'</summary><div class="solbody"></div></details>'; }).join('');
  each('details.sol',box,function(dt){
    dt.addEventListener('toggle',function(){
      if(!dt.open||dt._loaded) return; dt._loaded=true;
      var b=dt.querySelector('.solbody'), im=new Image(); im.alt=dt.querySelector('summary').textContent+' 詳解';
      im.onerror=function(){ b.innerHTML='<span class="muted">這題的詳解還沒放上來。</span>'; };
      im.src=dt.getAttribute('data-src'); b.appendChild(im);
      var qid=dt.getAttribute('data-q');
      if(!DEMO&&window.TRMLNote&&qid){ var nb=document.createElement('div'); b.appendChild(nb);
        TRMLNote.mount(nb,{api:API,auth:{team:p.team,name:p.name,pin:p.pin||''},qid:qid,setId:p.setId,note:(d.notes||{})[qid],shared:(d.shared||{})[qid]}); }
    });
  });
}
$('btnBack').onclick=function(){ show('v-login'); renderSets(); renderResume(); renderPending(); };

boot();
})();
