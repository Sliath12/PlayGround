(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');
  const ui = Object.fromEntries(['hpText','hpFill','xpText','xpFill','coinText','questCount','questFill','coords','interaction','toast','combatFlash','modalBackdrop','dialogTitle','dialogText','dialogAction','dialogDismiss','startOverlay','chatLines','chatInput','questCollapse','chatbox','chatToggle','locationToast'].map(id => [id, document.getElementById(id)]));
  const WORLD = 4700;
  let W = 0, H = 0, dpr = 1, last = 0, toastTimer = 0, hitFlash = 0, gameStarted = false, wonQuest = false;
  const saved = (() => { try { return JSON.parse(localStorage.getItem('mosslight-save') || '{}'); } catch { return {}; } })();
  const player = { x: saved.x || 155, y: 0, vx: 0, vy: 0, w: 34, h: 54, facing: 1, grounded: false, hp: saved.hp || 100, maxHp: 100, xp: saved.xp || 320, xpGoal: 500, level: saved.level || 4, coins: saved.coins || 128, kills: saved.kills || 0, attack: 0, invuln: 0, potions: 2 };
  const ground = () => H - 92;
  const keys = new Set();
  const camera = { x: 0 };
  let enemies = [];
  const travelers = [
    {x:1040,name:'Fernwhistle',tone:'#d6bedf',hair:'#483a53',body:'#9c719c'},
    {x:1670,name:'Bracken',tone:'#e5cb91',hair:'#604a35',body:'#718d61'},
    {x:2910,name:'Pip',tone:'#edb79e',hair:'#704c3a',body:'#7596a0'},
    {x:3760,name:'Sable',tone:'#d4b8d9',hair:'#40374e',body:'#bf7661'}
  ];
  const npc = {x:360,name:'Mira'};
  let seed = 8912;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const trees = Array.from({length:110},(_,i)=>({x:i*47+rand()*35, y:rand(), size:48+rand()*96, hue:Math.floor(rand()*3)}));
  const distant = Array.from({length:42},(_,i)=>({x:i*123+rand()*50,size:100+rand()*130,h:rand()}));
  const spawn = (count=19) => {
    enemies = Array.from({length:count},(_,i)=>({x:530+i*224+rand()*110,y:0,w:33,h:30,hp:i%7===5?2:1,alive:true,dir:rand()<.5?-1:1,phase:rand()*8,hit:0,cooldown:rand()*1.5,kind:i%9===6?'spore':'slime'}));
  };
  spawn();

  function resize(){
    const r=canvas.getBoundingClientRect(); W=r.width; H=r.height; dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
    player.y = Math.min(player.y || ground()-player.h, ground()-player.h);
  }
  window.addEventListener('resize',resize); resize();
  function save(){ localStorage.setItem('mosslight-save',JSON.stringify({x:player.x,hp:player.hp,xp:player.xp,level:player.level,coins:player.coins,kills:player.kills})); }
  function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('visible'),2200);}
  function addChat(name,text,cls='you'){
    const p=document.createElement('p'); const b=document.createElement('b'); b.className=cls; b.textContent=name; p.append(b,document.createTextNode(' '+text));ui.chatLines.append(p);while(ui.chatLines.children.length>5)ui.chatLines.firstChild.remove();ui.chatLines.scrollTop=ui.chatLines.scrollHeight;
  }
  function updateHud(){
    ui.hpText.textContent=`${Math.max(0,Math.ceil(player.hp))} / ${player.maxHp}`;ui.hpFill.style.width=`${Math.max(0,player.hp/player.maxHp*100)}%`;
    ui.xpText.textContent=`${player.xp} / ${player.xpGoal}`;ui.xpFill.style.width=`${player.xp/player.xpGoal*100}%`;
    document.querySelector('.level-pill').textContent=`LV. ${player.level}`;ui.coinText.textContent=`◈ ${player.coins}`;
    const q=Math.min(player.kills,5);ui.questCount.textContent=`${q} / 5`;ui.questFill.style.width=`${q/5*100}%`;
    ui.coords.textContent=`X ${String(Math.floor(player.x/10)).padStart(3,'0')}`;
    ui.interaction.classList.toggle('visible',Math.abs(player.x-npc.x)<93);
  }
  function talk(){
    if(Math.abs(player.x-npc.x)>100){showToast('Mira is back near the meadow entrance.');return;}
    ui.modalBackdrop.classList.add('visible');
    if(player.kills>=5&&!wonQuest){ui.dialogTitle.textContent='The trail is clear!';ui.dialogText.textContent='You did it! The bridge is clear, and the village can breathe easy. Here’s a little something for your travels.';ui.dialogAction.textContent='Claim your reward ✦';}
    else if(wonQuest){ui.dialogTitle.textContent='The meadow feels safer.';ui.dialogText.textContent='Thanks again for looking after Willowbrook. The road is a little brighter with you on it.';ui.dialogAction.textContent='Lovely day for a walk';}
    else{ui.dialogTitle.textContent='The trail needs you.';ui.dialogText.textContent='Moss slimes have been crowding the bridge again. Could you clear out five of them? The path will be safer for everyone.';ui.dialogAction.textContent=player.kills?`Keep going (${Math.min(player.kills,5)}/5)`:'I’ll help out';}
  }
  function closeDialog(){ui.modalBackdrop.classList.remove('visible');}
  ui.dialogAction.addEventListener('click',()=>{
    if(player.kills>=5&&!wonQuest){wonQuest=true;player.xp+=240;player.coins+=80;while(player.xp>=player.xpGoal){player.xp-=player.xpGoal;player.level++;player.xpGoal=Math.floor(player.xpGoal*1.35);player.maxHp+=12;player.hp=player.maxHp;showToast(`LEVEL UP! You are now level ${player.level}.`);}showToast('Quest complete • +240 XP • +80 coins');addChat('SYSTEM','Quest complete: A little less slime.','system');save();updateHud();}
    closeDialog();
  });
  ui.dialogDismiss.addEventListener('click',closeDialog);document.getElementById('closeDialog').addEventListener('click',closeDialog);
  ui.modalBackdrop.addEventListener('click',e=>{if(e.target===ui.modalBackdrop)closeDialog();});
  document.getElementById('startBtn').addEventListener('click',()=>{gameStarted=true;ui.startOverlay.style.display='none';ui.locationToast.classList.add('visible');setTimeout(()=>ui.locationToast.classList.remove('visible'),3600);showToast('Welcome to Willowbrook Meadows, Alder.');});
  ui.questCollapse.addEventListener('click',()=>document.querySelector('.quest-card').classList.toggle('collapsed'));
  ui.chatToggle.addEventListener('click',()=>{document.querySelector('.chat-lines').classList.toggle('collapsed');document.querySelector('#chatForm').classList.toggle('collapsed');});
  document.getElementById('chatForm').addEventListener('submit',e=>{e.preventDefault();const text=ui.chatInput.value.trim();if(text){addChat('Alder',text);ui.chatInput.value='';}});
  document.getElementById('soundBtn').addEventListener('click',e=>{const b=e.currentTarget;b.classList.toggle('muted');b.textContent=b.classList.contains('muted')?'♫̸':'♫';showToast(b.classList.contains('muted')?'Ambient sound muted':'Ambient sound on');});
  function attack(){if(!gameStarted||player.attack>0)return;player.attack=.27;let hit=false;for(const en of enemies){if(!en.alive)continue;const dx=en.x-player.x;if(Math.abs(dx)<84&&Math.sign(dx||1)===player.facing){en.hp--;en.hit=.22;en.x+=player.facing*27;hit=true;if(en.hp<=0){en.alive=false;player.kills++;player.xp+=en.kind==='spore'?55:35;player.coins+=4+Math.floor(rand()*7);if(player.kills===5&&!wonQuest)showToast('Quest updated • Return to Mira!');if(player.xp>=player.xpGoal){player.xp-=player.xpGoal;player.level++;player.xpGoal=Math.floor(player.xpGoal*1.35);player.maxHp+=12;player.hp=player.maxHp;showToast(`LEVEL UP! You are now level ${player.level}.`);}if(player.kills%3===0)addChat('Fernwhistle','Nice swing out there!','wanderer');save();}}}if(hit){hitFlash=.11;document.getElementById('combatFlash').classList.add('active');setTimeout(()=>document.getElementById('combatFlash').classList.remove('active'),85);}updateHud();}
  function jump(){if(gameStarted&&player.grounded){player.vy=-570;player.grounded=false;}}
  function potion(){if(player.potions>0&&player.hp<player.maxHp){player.potions--;player.hp=Math.min(player.maxHp,player.hp+38);showToast(`Potion used • ${player.potions} left`);updateHud();}}
  function handleKey(e,down){const k=e.key.toLowerCase();if([' ','arrowleft','arrowright','arrowup'].includes(k))e.preventDefault();if(down){keys.add(k);if(k==='j')attack();if(k===' '||k==='arrowup'||k==='w')jump();if(k==='f'||k==='e')talk();if(k==='q')potion();if(k==='escape')closeDialog();}else keys.delete(k);}
  window.addEventListener('keydown',e=>handleKey(e,true));window.addEventListener('keyup',e=>handleKey(e,false));
  document.querySelectorAll('.mobile-controls button').forEach(btn=>{const key=btn.dataset.key;const on=e=>{e.preventDefault();keys.add(key);if(key==='j')attack();if(key===' ')jump();};const off=e=>{e.preventDefault();keys.delete(key);};btn.addEventListener('pointerdown',on);btn.addEventListener('pointerup',off);btn.addEventListener('pointercancel',off);btn.addEventListener('pointerleave',off);});
  function rect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function drawBackground(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#83a9a0');g.addColorStop(.43,'#a8b99a');g.addColorStop(1,'#e1ba82');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const sunX=W*.73-(camera.x*.025%W);const glow=ctx.createRadialGradient(sunX,H*.27,2,sunX,H*.27,130);glow.addColorStop(0,'rgba(255,235,174,.48)');glow.addColorStop(1,'rgba(255,233,165,0)');ctx.fillStyle=glow;ctx.fillRect(sunX-130,H*.27-130,260,260);
    ctx.fillStyle='rgba(237,230,188,.58)';ctx.beginPath();ctx.arc(sunX,H*.27,23,0,Math.PI*2);ctx.fill();
    // distant rolling ridges
    ctx.fillStyle='#6d9385';ctx.beginPath();ctx.moveTo(0,H*.57);for(let x=0;x<=W+40;x+=40){const wx=x+camera.x*.12;ctx.lineTo(x,H*.48+Math.sin(wx*.003)*35+Math.sin(wx*.009)*12);}ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
    ctx.fillStyle='#537969';ctx.beginPath();ctx.moveTo(0,H*.69);for(let x=0;x<=W+50;x+=50){const wx=x+camera.x*.23;ctx.lineTo(x,H*.61+Math.sin(wx*.0027+2)*32+Math.cos(wx*.006)*8);}ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
    for(const t of distant){let sx=((t.x-camera.x*.33)%(W+180)+W+180)%(W+180)-70;const base=H*.69+t.h*32;ctx.fillStyle=t.h>.5?'#355c50':'#3e6657';ctx.beginPath();ctx.moveTo(sx,base-t.size);ctx.quadraticCurveTo(sx+t.size*.43,base-t.size*.87,sx+t.size*.48,base-t.size*.2);ctx.lineTo(sx+t.size*.65,base);ctx.lineTo(sx-t.size*.12,base+8);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(222,224,174,.12)';ctx.beginPath();ctx.ellipse(sx+t.size*.18,base-t.size*.62,t.size*.22,t.size*.12,-.4,0,Math.PI*2);ctx.fill();}
    // meadow grasses
    const gy=ground();ctx.fillStyle='#71905c';ctx.fillRect(0,gy,W,H-gy);ctx.fillStyle='#a4aa69';ctx.fillRect(0,gy,W,5);
    const start=Math.floor(camera.x/37)-1;for(let i=start;i<start+Math.ceil(W/37)+3;i++){let x=i*37-camera.x;let h=5+((i*17%13+13)%13);ctx.strokeStyle=i%3?'rgba(207,200,119,.55)':'rgba(221,218,148,.65)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,gy+4);ctx.lineTo(x-3,gy-h);ctx.moveTo(x+2,gy+5);ctx.lineTo(x+6,gy-h*.7);ctx.stroke();if(i%5===1){ctx.fillStyle='#e7d99b';ctx.beginPath();ctx.arc(x+1,gy-11,2,0,7);ctx.fill();}}
    // tree trunks and clustered crowns foreground
    trees.forEach(t=>{const sx=t.x-camera.x*.72;if(sx < -t.size*2||sx>W+t.size*2)return;const base=H*.76+t.y*H*.035;ctx.fillStyle='#604b3d';ctx.fillRect(sx-t.size*.07,base-t.size*.55,t.size*.14,t.size*.62);const palettes=[['#294d43','#37624e','#446e50'],['#315648','#416b50','#557857'],['#284941','#3c654d','#527451']][t.hue];for(let j=0;j<3;j++){ctx.fillStyle=palettes[j];ctx.beginPath();ctx.ellipse(sx+(j-1)*t.size*.22,base-t.size*(.63+(j===1?.2:0)),t.size*.34,t.size*.41,0,0,Math.PI*2);ctx.fill();}ctx.fillStyle='rgba(205,220,147,.12)';ctx.beginPath();ctx.ellipse(sx-t.size*.19,base-t.size*.78,t.size*.14,t.size*.09,-.5,0,Math.PI*2);ctx.fill();});
    // small village roofs and bridge landmarks
    const hut=500-camera.x*.72;if(hut>-180&&hut<W+180){const by=H*.75;ctx.fillStyle='#d5bc8a';ctx.fillRect(hut,by-75,98,77);ctx.fillStyle='#705843';ctx.beginPath();ctx.moveTo(hut-12,by-74);ctx.lineTo(hut+48,by-119);ctx.lineTo(hut+110,by-74);ctx.closePath();ctx.fill();ctx.fillStyle='#31483e';ctx.fillRect(hut+40,by-47,19,45);ctx.fillStyle='#e3c88f';ctx.fillRect(hut+10,by-53,20,20);ctx.fillRect(hut+68,by-53,18,20);}
    const bridge=1230-camera.x;if(bridge>-120&&bridge<W+80){const by=gy-8;ctx.fillStyle='#70563d';ctx.fillRect(bridge,by,170,11);ctx.fillStyle='#bd9360';for(let i=0;i<7;i++)ctx.fillRect(bridge+4+i*23,by+2,19,7);ctx.fillStyle='#745b41';ctx.fillRect(bridge+5,by-17,5,20);ctx.fillRect(bridge+159,by-17,5,20);ctx.fillRect(bridge+5,by-16,159,4);}
  }
  function drawPerson(x,y,opts={}){
    const s=opts.scale||1;ctx.save();ctx.translate(x,y);ctx.scale(s, s);const bob=opts.bob||0;ctx.translate(0,bob);
    // shadow
    ctx.fillStyle='rgba(25,34,25,.25)';ctx.beginPath();ctx.ellipse(0,0,20,5,0,0,Math.PI*2);ctx.fill();
    const skin=opts.skin||'#e4b991',hair=opts.hair||'#514334',body=opts.body||'#668b69';
    // legs
    rect(-10,-19,8,19,3,'#55493d');rect(3,-19,8,19,3,'#55493d');rect(-12,-5,11,6,2,'#333b37');rect(2,-5,12,6,2,'#333b37');
    // tunic, belt, arms
    ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-14,-42);ctx.lineTo(13,-42);ctx.lineTo(16,-17);ctx.lineTo(-16,-17);ctx.closePath();ctx.fill();rect(-15,-25,30,4,1,'#755c3f');rect(-3,-26,7,6,1,'#dfc37c');
    rect(-20,-40,7,21,3,skin);rect(14,-40,7,21,3,skin);
    // head and hair
    ctx.fillStyle=skin;ctx.beginPath();ctx.arc(0,-51,12,0,Math.PI*2);ctx.fill();ctx.fillStyle=hair;ctx.beginPath();ctx.arc(-1,-55,13,Math.PI,Math.PI*2);ctx.lineTo(12,-49);ctx.lineTo(7,-50);ctx.lineTo(4,-58);ctx.lineTo(-4,-56);ctx.lineTo(-12,-48);ctx.closePath();ctx.fill();
    // ear and face details
    ctx.fillStyle=skin;ctx.beginPath();ctx.arc(11,-50,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#382f2a';ctx.fillRect(opts.facing<0?-7:4,-52,2,2);
    // signature leaf cape
    ctx.fillStyle=opts.cape||'#8a9e65';ctx.beginPath();ctx.moveTo(-11,-41);ctx.lineTo(-20,-31);ctx.lineTo(-17,-18);ctx.lineTo(-9,-25);ctx.closePath();ctx.fill();
    if(opts.player){
      // rounded steel cap and tiny plume
      ctx.fillStyle='#b8c2ad';ctx.beginPath();ctx.arc(0,-56,13,Math.PI,Math.PI*2);ctx.lineTo(12,-53);ctx.lineTo(-12,-53);ctx.closePath();ctx.fill();ctx.fillStyle='#e1d6a2';ctx.fillRect(-2,-69,4,7);ctx.fillStyle='#91a88b';ctx.fillRect(-1,-66,2,5);
      // sword
      ctx.save();ctx.translate(opts.facing*16,-34);if(opts.attack>0){ctx.rotate(-opts.facing*1.35*opts.attack/.27);}ctx.rotate(-.55);ctx.fillStyle='#e4d8ac';ctx.fillRect(-2,-24,4,25);ctx.fillStyle='#9fb6b5';ctx.fillRect(-1,-24,2,20);ctx.fillStyle='#806348';ctx.fillRect(-6,-2,12,4);ctx.fillStyle='#dccb9d';ctx.fillRect(-2,2,4,8);ctx.restore();
    }
    ctx.restore();
  }
  function drawSlime(en,t){
    const sx=en.x-camera.x, gy=ground(), bob=Math.sin(t*3+en.phase)*3, squish=en.hit>0?.77:1;
    ctx.save();ctx.translate(sx,gy+bob);ctx.scale(1,squish);
    ctx.fillStyle='rgba(24,38,28,.25)';ctx.beginPath();ctx.ellipse(0,0,21,5,0,0,Math.PI*2);ctx.fill();
    const spore=en.kind==='spore';const color=spore?'#ad8dcb':'#89bd72';const light=spore?'#dbc2e8':'#d0e89a';
    ctx.fillStyle=en.hit>0?'#f3d9a1':color;ctx.beginPath();ctx.moveTo(-17,-2);ctx.quadraticCurveTo(-20,-20,-9,-28);ctx.quadraticCurveTo(0,-37,11,-27);ctx.quadraticCurveTo(21,-16,18,-2);ctx.quadraticCurveTo(8,4,-3,3);ctx.quadraticCurveTo(-13,4,-17,-2);ctx.fill();
    ctx.fillStyle=light;ctx.globalAlpha=.6;ctx.beginPath();ctx.ellipse(-6,-23,5,2,-.6,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle='#2e4938';ctx.beginPath();ctx.ellipse(-6,-15,2,3,0,0,Math.PI*2);ctx.ellipse(7,-15,2,3,0,0,Math.PI*2);ctx.fill();
    if(en.hp>1){rect(-14,-43,28,3,2,'rgba(22,31,27,.55)');rect(-14,-43,28*(en.hp/2),3,2,'#efcb8b');}
    ctx.restore();
  }
  function drawName(x,y,text,color='#e7e4c9'){
    ctx.font='600 10px DM Sans';ctx.textAlign='center';ctx.textBaseline='middle';const width=ctx.measureText(text).width+14;rect(x-width/2,y-9,width,18,6,'rgba(21,33,31,.64)');ctx.fillStyle=color;ctx.fillText(text,x,y+.5);
  }
  function updateMini(){
    const w=mini.width,h=mini.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#38564a';mctx.fillRect(0,0,w,h);
    mctx.fillStyle='#53745d';mctx.beginPath();mctx.moveTo(0,h*.65);mctx.quadraticCurveTo(w*.38,h*.3,w*.57,h*.62);mctx.quadraticCurveTo(w*.78,h*.87,w,h*.4);mctx.lineTo(w,h);mctx.lineTo(0,h);mctx.fill();
    mctx.fillStyle='#b28e62';mctx.fillRect(w*1230/W,h*.63,w*170/W,2);
    mctx.fillStyle='#c9d88d';mctx.beginPath();mctx.arc(player.x/W*w,h*.5,3.5,0,Math.PI*2);mctx.fill();
    mctx.fillStyle='#e6c690';mctx.beginPath();mctx.arc(npc.x/W*w,h*.57,2.5,0,Math.PI*2);mctx.fill();
    mctx.fillStyle='#d59f83';for(const tr of travelers)mctx.fillRect(tr.x/W*w,h*.58,2,2);
  }
  function update(dt,t){
    if(!gameStarted)return;
    const left=keys.has('a')||keys.has('arrowleft'),right=keys.has('d')||keys.has('arrowright');
    player.vx=(right?1:0)-(left?1:0);if(player.vx)player.facing=Math.sign(player.vx);
    const speed=player.grounded?245:220;player.x=Math.max(18,Math.min(WORLD-player.w,player.x+player.vx*speed*dt));
    player.vy+=1450*dt;player.y+=player.vy*dt;
    if(player.y+player.h>=ground()){player.y=ground()-player.h;player.vy=0;player.grounded=true;}else player.grounded=false;
    player.attack=Math.max(0,player.attack-dt);player.invuln=Math.max(0,player.invuln-dt);
    for(const en of enemies){if(!en.alive)continue;en.phase+=dt;en.hit=Math.max(0,en.hit-dt);en.cooldown-=dt;
      if(Math.abs(en.x-player.x)<390){en.dir=Math.abs(en.x-player.x)>145?Math.sign(player.x-en.x):en.dir;en.x+=en.dir*(en.kind==='spore'?31:43)*dt;}
      if(en.x<50||en.x>WORLD-40)en.dir*=-1;
      if(Math.abs(en.x-player.x)<37&&Math.abs((player.y+player.h)-(ground()))<35&&en.cooldown<=0&&player.invuln<=0){player.hp-=en.kind==='spore'?12:8;player.invuln=.9;en.cooldown=1.35;player.vx=0;player.vy=-190;hitFlash=.2;document.getElementById('combatFlash').classList.add('active');setTimeout(()=>document.getElementById('combatFlash').classList.remove('active'),130);if(player.hp<=0){player.hp=player.maxHp;player.x=Math.max(25,player.x-170);showToast('You caught your breath back in the meadow.');}}
    }
    const target=Math.max(0,Math.min(WORLD-W,camera.x+player.x-camera.x-W*.43));camera.x+=(target-camera.x)*Math.min(1,dt*4.5);
    if(player.x>340&&player.x<610&&npc.x===360){/* Mira stays by the village gate. */}
    updateHud();
  }
  function draw(t){
    ctx.clearRect(0,0,W,H);drawBackground();
    const gy=ground();
    // stepping stones and occasional flowers on the path
    for(let i=0;i<24;i++){const wx=200+i*191,sx=wx-camera.x;if(sx>-20&&sx<W+20){ctx.fillStyle=i%2?'rgba(207,187,140,.55)':'rgba(220,199,151,.62)';ctx.beginPath();ctx.ellipse(sx,gy+4,7+(i%3)*2,2,0,0,Math.PI*2);ctx.fill();}}
    // luminous mushrooms to break up the trail
    for(let i=0;i<12;i++){const wx=660+i*337,sx=wx-camera.x;if(sx>-20&&sx<W+20){ctx.strokeStyle='#c2baa0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx,gy);ctx.lineTo(sx,gy-10);ctx.stroke();ctx.fillStyle=i%2?'#e4b98e':'#d6a5a2';ctx.beginPath();ctx.ellipse(sx,gy-11,6,3.8,0,Math.PI,0);ctx.fill();ctx.fillStyle='rgba(255,235,194,.7)';ctx.beginPath();ctx.arc(sx-2,gy-12,1,0,7);ctx.fill();}}
    // Mira and other little adventurers
    const nx=npc.x-camera.x;drawPerson(nx,gy,{skin:'#efc7a2',hair:'#775438',body:'#bc8a50',cape:'#a6ad70',facing:1});drawName(nx,gy-74,'Mira','#f3d9a1');
    for(const tr of travelers){const tx=tr.x-camera.x;if(tx>-60&&tx<W+60){drawPerson(tx,gy,{skin:tr.tone,hair:tr.hair,body:tr.body,cape:'#777e67',facing:1});drawName(tx,gy-70,tr.name,tr.tone);}}
    for(const en of enemies)if(en.alive){drawSlime(en,t);}
    const px=player.x-camera.x;drawPerson(px,player.y+player.h,{player:true,facing:player.facing,attack:player.attack,skin:'#e7ba94',hair:'#5e4637',body:'#738a6c',cape:'#8eaa76',bob:player.grounded?Math.sin(t*9)*.8:0});
    if(player.invuln>0&&Math.floor(t*15)%2===0){ctx.fillStyle='rgba(255,238,195,.25)';ctx.beginPath();ctx.ellipse(px,player.y+26,26,34,0,0,Math.PI*2);ctx.fill();}
    updateMini();
  }
  function frame(now){const t=now/1000;const dt=Math.min(.034,(now-last)/1000||.016);last=now;update(dt,t);draw(t);requestAnimationFrame(frame);}
  updateHud();requestAnimationFrame(frame);
})();
