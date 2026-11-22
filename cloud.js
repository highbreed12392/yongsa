/* 용사의 주간 계획표 · 카카오 로그인 + Supabase 서버 어댑터
   게임 코드는 claude.use("user"/"db"/"room"/"sample") 를 그대로 부르고,
   이 파일이 그 호출을 Supabase(카카오 로그인)로 연결해 줍니다.
   claude.ai 안에서 열리면(window.claude 가 이미 있으면) 아무것도 하지 않아요. */
(function(){
  var C=window.YONGSA_CLOUD||{};
  if(window.claude||!C.supabaseUrl||!C.supabaseAnonKey)return;
  // APK 안의 내장 화면에서 열렸으면, 온라인일 때 실제 사이트로 이동(카카오 로그인은 진짜 주소에서만 돌아옴)
  if(location.hostname==="yongsa.app"&&C.siteUrl&&navigator.onLine&&!/local=1/.test(location.search)){location.replace(C.siteUrl+(location.pathname.indexOf("play")>=0?"#play":""));return}
  window.__CLOUD=true;
  var sb=null,session=null,api=null,resolveReady,ready=new Promise(function(r){resolveReady=r});
  var GUEST="yc_guest";
  function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function lsSet(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}

  window.claude={use:async function(n){await ready;if(!session)return null;if(!api)api=mkApi();return api[n]||null}};

  /* ---------- 로그인 화면 ---------- */
  function css(){if(document.getElementById("yc-css"))return;var s=document.createElement("style");s.id="yc-css";
    s.textContent="#yc-login{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(40,28,14,.72);padding:16px;font-family:'Do Hyeon','Malgun Gothic',sans-serif}"+
    "#yc-login .box{background:#fdf6e3;border:3px solid #6b4a2a;border-radius:6px;max-width:360px;width:100%;padding:22px 20px;text-align:center;box-shadow:0 6px 0 #3a2814}"+
    "#yc-login h1{margin:0 0 6px;font-size:26px;color:#3a2814}#yc-login p{margin:0 0 16px;color:#6b5a44;font-size:15px;line-height:1.6;font-family:sans-serif}"+
    "#yc-login .kakao{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:50px;border:0;border-radius:8px;background:#FEE500;color:#191919;font-size:17px;font-weight:700;cursor:pointer;font-family:sans-serif}"+
    "#yc-login button{box-shadow:none!important;transform:none!important}#yc-login .kakao{border:0!important}"+
    "#yc-login .guest{margin-top:12px;background:none!important;border:0!important;color:#6b5a44;text-decoration:underline;font-size:14px;cursor:pointer;font-family:sans-serif;min-height:44px}"+
    "#yc-login .err{color:#b0302a;font-size:13px;margin-top:10px;font-family:sans-serif}";document.head.appendChild(s)}
  var KAKAO_ICON='<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.8 5.3 4.6 6.7l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.5.1.9.1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg>';
  function showLogin(msg){css();var el=document.getElementById("yc-login");if(el)el.remove();el=document.createElement("div");el.id="yc-login";
    el.innerHTML='<div class="box" role="dialog" aria-label="로그인"><h1>용사의 주간 계획표</h1><p>카카오 계정으로 로그인하면<br>폰·PC 어디서나 이어서 하고, 친구와 길드·레이드를 함께해요.</p>'+
      '<button class="kakao" id="yc-kakao">'+KAKAO_ICON+'카카오로 시작하기</button><button class="guest" id="yc-guest">로그인 없이 혼자 하기</button>'+(msg?'<div class="err">'+msg+'</div>':'')+'</div>';
    document.body.appendChild(el);
    document.getElementById("yc-kakao").onclick=function(){login()};
    document.getElementById("yc-guest").onclick=function(){lsSet(GUEST,"1");el.remove();resolveReady()}}
  async function login(){
    if(!sb){showLogin("인터넷 연결을 확인해 주세요.");return}
    lsSet(GUEST,null);
    var to=C.siteUrl||(location.origin+location.pathname);
    var r=await sb.auth.signInWithOAuth({provider:"kakao",options:{redirectTo:to,scopes:C.kakaoScopes||"profile_nickname profile_image"}});
    if(r.error)showLogin("로그인을 시작하지 못했어요: "+r.error.message)}
  window.cloudLogin=function(){if(session)return;var el=document.getElementById("yc-login");if(el)el.remove();lsSet(GUEST,null);showLogin()};
  window.cloudLogout=async function(){try{if(sb)await sb.auth.signOut()}catch(e){}lsSet(GUEST,"1");location.reload()};
  window.cloudInfo=function(){return{on:true,signedIn:!!session,name:kakaoName(),id:session?session.user.id:null}};
  function kakaoName(){if(!session)return"";var m=session.user.user_metadata||{};return m.nickname||m.name||m.full_name||m.preferred_username||m.user_name||""}

  /* ---------- 시작 ---------- */
  function start(){
    if(!window.supabase||!window.supabase.createClient){resolveReady();return}
    sb=window.supabase.createClient(C.supabaseUrl,C.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
    sb.auth.getSession().then(function(r){session=r.data&&r.data.session||null;
      if(/[?&](code|error)=/.test(location.search))history.replaceState(null,"",location.pathname+location.hash);
      if(session){lsSet(GUEST,null);fillName();resolveReady()}
      else if(lsGet(GUEST)||!navigator.onLine)resolveReady();
      else{var go=function(){document.body?showLogin(/error=/.test(location.search)?"카카오 로그인이 취소됐거나 실패했어요.":""):setTimeout(go,50)};go()}
    }).catch(function(){resolveReady()});
    sb.auth.onAuthStateChange(function(ev,s){if(ev==="TOKEN_REFRESHED"||ev==="SIGNED_IN")session=s||session;if(ev==="SIGNED_OUT")session=null})}
  function fillName(){var n=kakaoName();if(!n)return;var t=0,iv=setInterval(function(){var i=document.getElementById("hero-name");if(i&&!i.value){i.value=n.slice(0,12);i.dispatchEvent(new Event("input",{bubbles:true}))}if(++t>40)clearInterval(iv)},250)}
  if(window.supabase)start();else{var tries=0,iv=setInterval(function(){if(window.supabase){clearInterval(iv);start()}else if(++tries>80){clearInterval(iv);resolveReady()}},100)}

  /* ---------- claude.use() 대체 구현 ---------- */
  function mkApi(){
    var uid=session.user.id,T="docs";
    var clone=function(v){return v==null?v:JSON.parse(JSON.stringify(v))};
    var parentOf=function(p){return p.split("/").slice(0,-1).join("/")};
    var last=function(p){return p.split("/").pop()};
    var rid=function(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4)};
    function snapDoc(path,row){return{id:last(path),exists:!!row,data:function(){return row?clone(row.data):undefined},metadata:{}}}
    var chN=0;function chan(){return sb.channel("yc"+(++chN)+"-"+rid())}
    function docRef(path){return{id:last(path),path:path,
      get:async function(){var r=await sb.from(T).select("path,data").eq("path",path).maybeSingle();if(r.error)throw r.error;return snapDoc(path,r.data)},
      set:async function(v){var r=await sb.from(T).upsert({path:path,parent:parentOf(path),data:clone(v),updated_at:new Date().toISOString()});if(r.error)throw r.error},
      update:async function(v){var r=await sb.rpc("docs_merge",{p:path,patch:clone(v)});if(r.error)throw r.error},
      "delete":async function(){var r=await sb.from(T).delete().eq("path",path);if(r.error)throw r.error},
      onSnapshot:function(fn,err){var me=this,alive=true;
        me.get().then(function(s){if(alive)fn(s)}).catch(function(e){if(err)err(e)});
        var ch=chan().on("postgres_changes",{event:"*",schema:"public",table:T,filter:"path=eq."+path},function(pl){if(!alive)return;fn(snapDoc(path,pl.eventType==="DELETE"?null:pl.new))}).subscribe();
        return function(){alive=false;sb.removeChannel(ch)}},
      collection:function(c){return colRef(path+"/"+c)}}}
    function colRef(path,q){q=q||{};
      async function list(){var r=sb.from(T).select("path,data").eq("parent",path);
        if(q.where)r=r.eq("data->>"+q.where[0],String(q.where[2]));
        r=r.limit(1000);var res=await r;if(res.error)throw res.error;var rows=res.data||[];
        if(q.order){var f=q.order[0],d=q.order[1]==="desc"?-1:1;rows.sort(function(a,b){var x=a.data&&a.data[f],y=b.data&&b.data[f];return(x>y?1:x<y?-1:0)*d})}
        if(q.limit)rows=rows.slice(0,q.limit);
        var docs=rows.map(function(x){return snapDoc(x.path,x)});return{docs:docs,size:docs.length,empty:!docs.length,docChanges:function(){return[]},metadata:{}}}
      return{path:path,
        doc:function(id){return docRef(path+"/"+(id||rid()))},
        add:async function(v){var d=docRef(path+"/"+rid());await d.set(v);return d},
        where:function(f,o,v){return colRef(path,Object.assign({},q,{where:[f,o,v]}))},
        orderBy:function(f,d){return colRef(path,Object.assign({},q,{order:[f,d||"asc"]}))},
        limit:function(n){return colRef(path,Object.assign({},q,{limit:n}))},
        get:list,
        onSnapshot:function(fn,err){var alive=true,tm=null;
          var run=function(){list().then(function(s){if(alive)fn(s)}).catch(function(e){if(err)err(e)})};run();
          var ch=chan().on("postgres_changes",{event:"*",schema:"public",table:T,filter:"parent=eq."+path},function(){clearTimeout(tm);tm=setTimeout(run,250)}).subscribe();
          return function(){alive=false;sb.removeChannel(ch)}}}}
    var db={doc:docRef,collection:colRef};

    var user={id:async function(){return uid},me:async function(){return{id:uid,name:kakaoName()}},
      isOwner:async function(){return false},can:async function(){return true},canEdit:function(){return true},profiles:async function(){return{}}};

    // 실시간 접속자(같은 맵에 보이기, 채팅)
    var room=(function(){var cbs=[],peers=[],lastT=0,pend=null,tm=null,joined=false;
      var ch=sb.channel("yongsa-room",{config:{presence:{key:uid}}});
      ch.on("presence",{event:"sync"},function(){var st=ch.presenceState();
        peers=Object.keys(st).map(function(k){var a=st[k];var p=a[a.length-1];return{by:k,isMe:k===uid,kind:"viewer",presence:p&&p.p}});
        cbs.forEach(function(f){try{f({peers:peers})}catch(e){}})}).subscribe(function(s){if(s==="SUBSCRIBED"){joined=true;if(pend)flush()}});
      function flush(){if(!joined||!pend)return;var p=pend;pend=null;lastT=Date.now();ch.track({p:p}).catch(function(){})}
      return{presence:async function(p){pend=p;var wait=400-(Date.now()-lastT);if(wait<=0)flush();else{clearTimeout(tm);tm=setTimeout(flush,wait)}},
        onPeers:function(cb){cbs.push(cb);if(peers.length)cb({peers:peers});return function(){cbs=cbs.filter(function(f){return f!==cb})}}}})();

    // AI(NPC 대화·내레이션): Supabase Edge Function "ai" 가 있을 때만
    var sample=C.ai?async function(prompt,opts){
      var r=await fetch(C.supabaseUrl+"/functions/v1/ai",{method:"POST",headers:{"Content-Type":"application/json",apikey:C.supabaseAnonKey,Authorization:"Bearer "+session.access_token},body:JSON.stringify({prompt:String(prompt).slice(0,6000),tier:(opts&&opts.modelTier)||"default"})});
      if(r.status===429){var e=new Error("rate_limited");e.code="rate_limited";throw e}
      if(!r.ok)throw new Error("ai "+r.status);var j=await r.json();return{text:j.text||""}}:null;

    return{db:db,user:user,room:room,sample:sample}}
})();
