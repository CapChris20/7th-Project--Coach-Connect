from kit import *

LOGO = base64.b64encode(open(os.path.join(B, 'logo.png'), 'rb').read()).decode()

CSS3 = r'''
.hi{display:flex;align-items:center;gap:12px}
.hi .grow{flex:1;min-width:0}
.hi small{display:block;color:var(--mut);font-size:13px}
.hi b{font-size:19px;letter-spacing:-.3px}
.cc-logo{background:url(data:image/png;base64,__LOGO__) center/contain no-repeat}
.mq{border-top:3px solid var(--on);overflow:hidden;white-space:nowrap;height:44px;display:flex;align-items:center}
.mq .tr{display:inline-flex;will-change:transform}
.mq span{font-weight:900;font-size:15px;font-style:italic;padding-right:18px;letter-spacing:.2px;white-space:nowrap}
.mq span i{display:inline-block;width:12px;height:12px;border-radius:3px;transform:rotate(45deg);margin:0 0 0 18px;background:linear-gradient(135deg,#FCD34D,#F472B6);vertical-align:middle}
.foot{display:flex;justify-content:center;align-items:center;gap:6px;font-size:15px;color:var(--mut);flex-wrap:wrap}
.lnk{background:none;border:0;padding:0;min-height:44px;font-weight:900;font-size:15px;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:3px;cursor:pointer;color:var(--ink)}

/* welcome */
.stage{position:relative;background:var(--blk);color:var(--on);border:3px solid var(--bd);border-radius:6px 34px 6px 6px;box-shadow:6px 6px 0 var(--sh);overflow:hidden;display:flex;flex-direction:column}
.stage .grid{position:absolute;inset:0;background-image:linear-gradient(var(--on) 1.5px,transparent 1.5px),linear-gradient(90deg,var(--on) 1.5px,transparent 1.5px);background-size:28px 28px;opacity:.09;-webkit-mask-image:radial-gradient(circle at 50% 40%,#000 10%,transparent 72%);mask-image:radial-gradient(circle at 50% 40%,#000 10%,transparent 72%)}
.stage .sticker{position:absolute;top:14px;left:12px;transform:rotate(-5deg);z-index:2}
.stage .mark{position:relative;height:138px;margin:30px 0 0;display:grid;place-items:center}
.stage .mark .cc-logo{width:196px;height:138px;position:relative;z-index:1}
.stage .ring{position:absolute;width:140px;height:140px;border-radius:50%;border:3px dashed var(--on);opacity:.28}
.stage .ring.r2{width:182px;height:182px;opacity:.14}
.stage .wm2{position:relative;text-align:center;padding:0 12px 16px;font-weight:900;line-height:.92;letter-spacing:-2px;font-size:42px}
.stage .wm2 span{display:block}
.stage .bar2{width:64px;height:8px;border-radius:4px;margin:10px auto 0;background:linear-gradient(90deg,#FCD34D,#F472B6)}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-top:4px}
.tile3{display:flex;flex-direction:column;align-items:flex-start;gap:8px;background:var(--sf);border:3px solid var(--bd);box-shadow:4px 4px 0 var(--sh);padding:9px;min-height:92px}
.tile3 b{font-size:14px;line-height:1.15;letter-spacing:-.2px}
.tile3:nth-child(1){transform:rotate(-2deg);border-radius:6px 20px 6px 6px}
.tile3:nth-child(2){transform:translateY(8px) rotate(1.5deg);border-radius:6px}
.tile3:nth-child(3){transform:rotate(-1deg);border-radius:20px 6px 6px 6px}
.h1w{font-size:27px;line-height:1;letter-spacing:-1px;font-weight:900;margin:8px 0 0;text-wrap:balance}
.mk{background:linear-gradient(135deg,#FCD34D,#F472B6);color:#0A0A0A;padding:0 8px;border:3px solid var(--bd);border-radius:8px;display:inline-block;transform:rotate(-1.5deg)}

/* home hero: welcome + tagline + animation */
/* Surface hero (follows theme) — not inverted fill/blk. Welcome .stage stays blk. */
.hero4{position:relative;background:var(--sf);color:var(--ink);border:3px solid var(--bd);border-radius:6px 30px 6px 6px;box-shadow:6px 6px 0 var(--sh);overflow:hidden}
.hero4.rev{border-radius:30px 6px 6px 6px}
.hero4 .grid{position:absolute;inset:0;background-image:linear-gradient(var(--ink) 1.5px,transparent 1.5px),linear-gradient(90deg,var(--ink) 1.5px,transparent 1.5px);background-size:28px 28px;opacity:.08;-webkit-mask-image:radial-gradient(circle at 70% 40%,#000 10%,transparent 70%);mask-image:radial-gradient(circle at 70% 40%,#000 10%,transparent 70%)}
.hero4 .row4{position:relative;display:grid;grid-template-columns:1fr 128px;gap:0;align-items:center;padding:18px 0 12px 16px}
.hero4.rev .row4{grid-template-columns:128px 1fr;padding:18px 16px 12px 0}
.hero4.rev .row4 .tx{order:2}
.hero4 .eyb{color:var(--ink);opacity:.75}
.hero4 .wl{font-size:29px;line-height:1;letter-spacing:-1.1px;font-weight:900;margin:8px 0 0}
.hero4 .wl .mk{padding:0 6px;margin-left:-2px;font-size:29px;margin-top:6px}
.hero4 .art{position:relative;width:128px;height:138px}
.hero4 .art .disc{position:absolute;right:-6px;bottom:-14px;width:118px;height:118px;border-radius:50%;border:3px solid var(--ink);opacity:.9}
.hero4.rev .art .disc{right:auto;left:-6px}
.hero4 .art .lot{position:absolute;right:2px;bottom:0;width:122px;height:122px}
.hero4.rev .art .lot{right:auto;left:2px}
.hero4 .mq{border-top-color:var(--ink)}
.hero4 .mq span{color:var(--ink)}
'''.replace('__LOGO__', LOGO)

JS3 = r'''
HOOKS.push(function(ph){
 const cd=$('[data-cdh]',ph);if(cd){let s=5*3600+59*60+12;const f=n=>String(n).padStart(2,'0');const tick=()=>{cd.textContent=f(Math.floor(s/3600))+':'+f(Math.floor(s%3600/60))+':'+f(s%60)};tick();
  const id=setInterval(()=>{if(!document.body.contains(ph)){clearInterval(id);return}s=s>0?s-1:0;tick()},1000)}
 const tb=$('[data-theme-btn]',ph);if(tb)tb.addEventListener('click',()=>ph.classList.toggle('dk'));
 if(!window.gsap||RM)return;
 const lg=$('.stage .cc-logo',ph);
 if(lg){gsap.from(lg,{scale:.5,rotate:-14,duration:.9,ease:'elastic.out(1,.55)',clearProps:'transform'});gsap.to(lg,{y:-6,duration:2.2,ease:'sine.inOut',yoyo:true,repeat:-1,delay:1})}
 $$('.stage .ring',ph).forEach((r,i)=>gsap.to(r,{rotate:i?-360:360,duration:i?40:28,ease:'none',repeat:-1}));
 const mq=$('.mq .tr',ph);if(mq){const w=mq.scrollWidth/2;gsap.fromTo(mq,{x:0},{x:-w,duration:14,ease:'none',repeat:-1})}
 $$('.tile3',ph).forEach((t,i)=>gsap.from(t,{y:24,opacity:0,duration:.5,delay:.35+i*.08,ease:'power3.out',clearProps:'opacity,y'}));
 $$('.hero2 .wk .d.on',ph).forEach((d,i)=>gsap.from(d,{scale:0,duration:.45,delay:.5+i*.08,ease:'back.out(2)',clearProps:'transform'}));
 $$('.hero3 .st b[data-n]',ph).forEach(b=>{const n=+b.dataset.n,o={v:0};gsap.to(o,{v:n,duration:1,delay:.4,ease:'power2.out',onUpdate:()=>{b.textContent=Math.round(o.v)}})});
});
'''

def tile(ic, label):
    return '<div class="tile3">%s<b>%s</b></div>' % (ib(ic), label)

def hi(ini, small, name):
    return '<div class="hi rv">%s<div class="grow"><small>%s</small><b>%s</b></div><button class="sq" aria-label="Notifications">%s</button></div>' % (av(ini), small, name, SV['bell'])

S = []

S.append(screen('1 · Welcome',
 'Your CC infinity mark is the centerpiece, on a black stage with a faint grid and two slow dashed rings. COACH CONNECT sits under it. The sticker, the bar under the wordmark and the diamonds in the tagline strip are the gradient accents. The three tiles replace the old two, and their wording is mine. The moon button flips this phone between light and dark.',
 '<div style="display:flex;justify-content:flex-end" class="rv"><button class="sq" data-theme-btn aria-label="Switch theme"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/></svg></button></div>'
 '<div class="stage rv"><div class="grid"></div><span class="pill g9 sticker">Day One starts here</span>'
 '<div class="mark"><span class="ring"></span><span class="ring r2"></span><div class="cc-logo" role="img" aria-label="Coach Connect logo"></div></div>'
 '<div class="wm2"><span>COACH</span><span>CONNECT</span><div class="bar2"></div></div>'
 '<div class="mq"><div class="tr">' + ''.join('<span>One Day or Day One!<i></i></span>' for _ in range(8)) + '</div></div></div>'
 '<div class="tiles rv">' + tile('dumbbell', 'Plans and logs') + tile('checkin', 'Daily check-ins') + tile('progress', 'Real progress') + '</div>'
 '<h1 class="h1w rv" style="margin-top:14px">Trainers and clients, finally <span class="mk">in sync.</span></h1>'
 '<button class="btn rv">Get started %s</button>' % SV['chev'] +
 '<div class="foot rv">Already have an account? <button class="lnk">Sign in</button></div>', nodock=True))

def hero(rev, lot, g1, tag):
    return ('<div class="hero4 rv%s"><div class="grid"></div><div class="row4"><div class="tx"><span class="eyb">%s</span><div class="wl">Welcome to <span class="mk">Coach Connect</span></div></div>'
            '<div class="art"><div class="disc %s"></div><div class="lot" data-l="%s"></div></div></div>'
            '<div class="mq"><div class="tr">' % (' rev' if rev else '', tag, g1, lot) + ''.join('<span>One Day or Day One!<i></i></span>' for _ in range(8)) + '</div></div></div>')

S.append(screen('2 · Client home hero',
 'The hero is now just the welcome: Welcome to Coach Connect, your tagline strip, and the lifter animation. No streak, no stats, no countdown. Below it the home cards continue as before.',
 hi('CA', 'Thursday evening', 'Good evening, Cade') + hero(False, 'zlifter', 'g2', 'Your training home') +
 sec('Up next') +
 '<div class="card flat rv"><b>Lower body strength</b><p class="sm mut">Today at 6:30 PM · 60 min with Jordan</p></div>',
 dock('home')))

S.append(screen('3 · Trainer home hero',
 'Same welcome for the trainer, mirrored, with the boxer animation. No numbers in the hero. The Needs you card sits right under it.',
 hi('CH', 'Thursday evening', 'Good evening, Chris') + hero(True, 'zboxer', 'g5', 'Your coaching home') +
 sec('Needs you', '<span class="cnt">1</span>') +
 '<div class="card flat rv"><b>New client messages</b><p class="sm mut">9 unread, open inbox</p></div>',
 dock('home')))

build('hero-and-welcome-redesign.html', 'Welcome and Home Heroes', '', 'Welcome and home heroes',
      'The welcome screen with your CC logo, and a simpler welcome hero for the client home and the trainer home. Light and dark. The moon button on the welcome screen flips that phone.',
      S, lots=('zlifter', 'zboxer'), extra_js=JS3, extra_css=CSS3)
