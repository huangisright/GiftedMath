/* TRML 練習：學生對每題的回饋（難易度、卡在哪、想法／另解、選填照片）
 * TRMLNote.mount(el, {api, auth:{team,name,pin|apin}, qid, setId, note, shared, readonly})
 * 只有自己和老師看得到；老師分享的另解會出現在「同學分享的另解」。 */
(function(root){
'use strict';
var STUCK=['看不懂題目','沒有想法','方法對但算錯','粗心','看完詳解還是不懂'];
var CSS='.nt{border-top:1px dashed var(--line);margin-top:10px;padding-top:10px;display:flex;flex-direction:column;gap:8px;font-size:.92rem}'+
'.nt .lab{font-size:.8rem;color:var(--muted)}'+
'.nt .seg{display:flex;gap:6px;flex-wrap:wrap}'+
'.nt .seg button{padding:5px 12px;font-size:.9rem;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-weight:400;cursor:pointer}'+
'.nt .seg button.on{background:var(--indigo);border-color:var(--indigo);color:var(--card)}'+
'.nt textarea{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:4px;padding:8px 10px;width:100%;min-height:5em;resize:vertical}'+
'.nt .row2{display:flex;gap:10px;align-items:center;flex-wrap:wrap}'+
'.nt .save{background:var(--indigo);border:1px solid var(--indigo);color:var(--card);border-radius:4px;padding:7px 14px;font-weight:700;cursor:pointer}'+
'.nt .file{display:inline-flex;align-items:center;gap:4px;border:1px dashed var(--indigo);color:var(--indigo);border-radius:4px;padding:6px 10px;cursor:pointer;font-size:.88rem;position:relative}'+
'.nt .file input{position:absolute;inset:0;opacity:0;cursor:pointer}'+
'.nt .st{font-size:.85rem;color:var(--muted)}.nt .st.ok{color:var(--moss)}.nt .st.err{color:var(--danger)}'+
'.nt .thumbs{display:flex;gap:6px}.nt .thumbs img{width:64px;height:64px;object-fit:cover;border-radius:4px;border:1px solid var(--line)}'+
'.nt-sh{background:var(--moss-soft);border-radius:6px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;margin-top:10px}'+
'.nt-sh b{color:var(--moss)}.nt-sh .one{white-space:pre-wrap;overflow-wrap:anywhere}.nt-sh img{max-width:100%;border-radius:4px;background:#fff}';
function css(){ if(document.getElementById('nt-css')) return; var s=document.createElement('style'); s.id='nt-css'; s.textContent=CSS; document.head.appendChild(s); }
function postJ(url,body,n){ n=n||0;
  // Apps Script 偶爾把 POST 的回覆換成首頁資料（有 teams、sets，沒有這次要的結果）；同一份再送一次是安全的（後端會認出重複）
  return fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(d){
    if(d&&d.teams&&d.sets&&n<3) return new Promise(function(res){setTimeout(res,800*(n+1));}).then(function(){return postJ(url,body,n+1);});
    if(d&&d.teams&&d.sets) throw new Error('伺服器回覆不完整，請再按一次');
    return d; }); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function shrink(file){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(file), img=new Image();
    img.onload=function(){ var s=Math.min(1,1400/Math.max(img.width,img.height)), c=document.createElement('canvas');
      c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
      var g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',0.72)); };
    img.onerror=function(){ URL.revokeObjectURL(url); rej(); };
    img.src=url;
  });
}
function sharedHtml(list){
  if(!list||!list.length) return '';
  return '<div class="nt-sh"><b>同學分享的另解</b>'+list.map(function(s){
    return '<div class="one"><span style="color:var(--muted)">'+esc(s.name)+'：</span>'+esc(s.text||'')+'</div>'+
      (s.photos||[]).map(function(u){return '<img loading="lazy" src="'+esc(u)+'" alt="'+esc(s.name)+' 的另解照片" onerror="this.remove()">';}).join('');
  }).join('')+'</div>';
}
function readonlyHtml(n){
  if(!n||(!n.diff&&!(n.stuck||[]).length&&!n.text&&!n.nphotos)) return '';
  return '<div class="nt"><div class="lab">回饋　'+esc(n.time||'')+'</div>'+
    (n.diff?'<div>難易度：<b>'+esc(n.diff)+'</b></div>':'')+((n.stuck||[]).length?'<div>卡在：'+esc(n.stuck.join('、'))+'</div>':'')+
    (n.text?'<div style="white-space:pre-wrap">'+esc(n.text)+'</div>':'')+(n.nphotos?'<div class="lab">附照片 '+n.nphotos+' 張</div>':'')+'</div>';
}
function mount(el,o){
  css();
  if(o.readonly){ el.innerHTML=readonlyHtml(o.note)+sharedHtml(o.shared); return; }
  var n=o.note||{}, st={diff:n.diff||'', stuck:(n.stuck||[]).slice(), photos:[], clear:false, nphotos:n.nphotos||0};
  el.innerHTML='<div class="nt">'+
    '<div class="lab">這題對你來說</div><div class="seg" data-g="diff">'+['簡單','剛好','難'].map(function(x){return '<button type="button" data-v="'+x+'">'+x+'</button>';}).join('')+'</div>'+
    '<div class="lab">卡在哪裡（可複選，沒卡住就不用選）</div><div class="seg" data-g="stuck">'+STUCK.map(function(x){return '<button type="button" data-v="'+x+'">'+x+'</button>';}).join('')+'</div>'+
    '<div class="lab">想法或另解（只有你和老師看得到）</div><textarea placeholder="例如：我是用……的方法，或是看完詳解才發現……"></textarea>'+
    '<div class="row2"><label class="file">＋ 附照片（選填）<input type="file" accept="image/*"></label><span class="thumbs"></span><span class="pinfo st"></span></div>'+
    '<div class="row2"><button type="button" class="save">存回饋</button><span class="st msg">'+(n.time?'上次存於 '+esc(n.time):'')+'</span></div>'+
  '</div>'+sharedHtml(o.shared);
  var box=el.querySelector('.nt'), ta=box.querySelector('textarea'), msg=box.querySelector('.msg');
  ta.value=n.text||'';
  function paint(){
    Array.prototype.forEach.call(box.querySelectorAll('[data-g=diff] button'),function(b){ b.classList.toggle('on',b.getAttribute('data-v')===st.diff); });
    Array.prototype.forEach.call(box.querySelectorAll('[data-g=stuck] button'),function(b){ b.classList.toggle('on',st.stuck.indexOf(b.getAttribute('data-v'))>=0); });
    box.querySelector('.thumbs').innerHTML=st.photos.map(function(d){return '<img src="'+d+'" alt="要上傳的照片">';}).join('');
    var pi=box.querySelector('.pinfo');
    pi.innerHTML=st.nphotos&&!st.clear?'已存 '+st.nphotos+' 張 <a href="#" class="clr">刪掉</a>':'';
    var c=pi.querySelector('.clr'); if(c) c.onclick=function(e){ e.preventDefault(); st.clear=true; paint(); };
  }
  Array.prototype.forEach.call(box.querySelectorAll('[data-g=diff] button'),function(b){ b.onclick=function(){ var v=b.getAttribute('data-v'); st.diff=st.diff===v?'':v; paint(); }; });
  Array.prototype.forEach.call(box.querySelectorAll('[data-g=stuck] button'),function(b){ b.onclick=function(){ var v=b.getAttribute('data-v'), i=st.stuck.indexOf(v); if(i>=0) st.stuck.splice(i,1); else st.stuck.push(v); paint(); }; });
  var fi=box.querySelector('input[type=file]');
  fi.onchange=function(){ var f=fi.files&&fi.files[0]; if(!f) return; if(st.photos.length>=2){ msg.textContent='一題最多 2 張照片。'; return; }
    shrink(f).then(function(d){ st.photos.push(d); fi.value=''; paint(); }).catch(function(){ msg.textContent='這張照片讀不出來。'; }); };
  box.querySelector('.save').onclick=function(){
    var btn=this; btn.disabled=true; msg.className='st msg'; msg.textContent='存檔中…';
    var body={action:'note',qid:o.qid,setId:o.setId||'',diff:st.diff,stuck:st.stuck,text:ta.value.trim(),photos:st.photos,clearPhotos:st.clear};
    for(var k in o.auth) body[k]=o.auth[k];
    postJ(o.api,body).then(function(d){
      btn.disabled=false;
      if(!d.ok){ msg.className='st msg err'; msg.textContent=d.error||'存檔失敗'; return; }
      st.photos=[]; st.clear=false; st.nphotos=d.note.nphotos; paint();
      msg.className='st msg ok'; msg.textContent='已存（'+d.note.time+'）';
    }).catch(function(){ btn.disabled=false; msg.className='st msg err'; msg.textContent='連不上，請再按一次。'; });
  };
  paint();
}
root.TRMLNote={mount:mount, readonlyHtml:readonlyHtml};
root.postJ=root.postJ||postJ;
})(window);
