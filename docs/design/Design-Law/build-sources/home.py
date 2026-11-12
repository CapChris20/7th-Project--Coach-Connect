from kit import *

CSS2 = r'''
.welcome{background:var(--blk);color:var(--on);border:3px solid var(--bd);border-radius:6px 26px 6px 6px;box-shadow:6px 6px 0 var(--sh);padding:14px 14px 14px 16px;display:grid;grid-template-columns:1fr 112px;gap:6px;align-items:center;overflow:hidden;min-height:150px}
.welcome .q{font-size:30px;line-height:1;letter-spacing:-1px;font-weight:900;margin:6px 0 8px}
.welcome .eyb{color:var(--on);opacity:.72}
.welcome p{color:var(--on);opacity:.8;font-size:14px}
.welcome .lot{width:112px;height:112px}
.card .btn.sm2{font-size:13px;min-width:0;padding:0 6px}
.hi{display:flex;align-items:center;gap:12px}
.hi .grow{flex:1;min-width:0}
.hi small{display:block;color:var(--mut);font-size:13px}
.hi b{font-size:19px;letter-spacing:-.3px}
.when{display:flex;flex-direction:column;justify-content:center;min-width:92px;padding-right:12px;border-right:3px solid var(--bd)}
.when .num{font-size:30px;line-height:1}
.ring{width:104px;height:104px;flex:none;position:relative}
.ring svg{width:104px;height:104px;transform:rotate(-90deg)}
.ring .tr{fill:none;stroke:var(--soft);stroke-width:13}
.ring .fg{fill:none;stroke:var(--blk);stroke-width:13}
.ring .c{position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1.05}
.ring .c b{font-size:22px;letter-spacing:-.5px}
.mac{display:flex;flex-direction:column;gap:5px}
.mac .t{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800}
.mac .t .im{width:20px;height:20px}
.mac .t span{margin-left:auto;color:var(--mut);font-weight:700;font-variant-numeric:tabular-nums}
.mac .bar{height:12px;border-width:2.5px;border-radius:6px}
.hs2{display:flex;gap:12px;overflow-x:auto;margin:0 -16px;padding:4px 16px 14px;scroll-snap-type:x mandatory;scroll-padding:0 16px;scrollbar-width:none}
.hs2::-webkit-scrollbar{display:none}
.vt{flex:none;width:148px;scroll-snap-align:start;display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-height:164px;padding:12px;background:var(--sf);border:3px solid var(--bd);border-radius:10px;box-shadow:4px 4px 0 var(--sh);text-align:left;cursor:pointer;position:relative}
.vt:nth-child(even){border-radius:10px 26px 10px 10px}
.vt:nth-child(3n){border-radius:10px 10px 10px 26px}
.vt .v{font-size:30px;line-height:1}
.vt .v small{font-size:13px;color:var(--mut);letter-spacing:0;margin-left:3px;font-weight:800}
.vt .l{font-size:12px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut)}
.vt .tap{font-size:13px;font-weight:800;text-decoration:underline;text-underline-offset:3px}
.spk{display:flex;align-items:flex-end;gap:3px;height:24px}
.spk i{width:7px;border:2px solid var(--bd);background:var(--blk);display:block}
.rate{display:flex;flex-direction:column;gap:2px}
.rate .hd2{display:flex;justify-content:space-between;align-items:baseline}
.rate .hd2 b{font-size:15px}
.rate .hd2 span{font-size:20px}
.card .rate+.rate{border-top:2px solid var(--bd);padding-top:8px}
.ex{display:flex;flex-direction:column;gap:8px;padding:10px 0;border-top:2px solid var(--bd)}
.ex:first-of-type{border-top:0}
.ex .h{display:flex;justify-content:space-between;align-items:center}
.ex .h b{font-size:16px}
.sets{display:flex;flex-wrap:wrap;gap:8px}
.sets i{font-style:normal;min-height:36px;padding:0 12px;display:inline-flex;align-items:center;border:3px solid var(--bd);border-radius:8px;font-weight:800;font-size:14px;background:var(--chip);font-variant-numeric:tabular-nums}
.sets i.done{background:var(--blk);color:var(--on)}
.act{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.act .chip.tile{min-height:88px;box-shadow:3px 3px 0 var(--sh)}
.stars{display:flex;gap:8px}
.stars button{width:44px;height:44px;border:3px solid var(--bd);border-radius:10px;background:var(--chip);display:grid;place-items:center;cursor:pointer;padding:0}
.stars button svg{fill:none;stroke:var(--ink);stroke-width:2.6}
.stars button.on{background:var(--blk)}.stars button.on svg{fill:var(--on);stroke:var(--on)}
.cups{display:flex;gap:6px}
.cups button{flex:1;height:44px;border:3px solid var(--bd);border-radius:6px 6px 14px 14px;background:var(--chip);cursor:pointer;padding:0}
.cups button.on{background:var(--blk)}
.tag{display:inline-flex;align-items:center;height:26px;padding:0 10px;border:2.5px solid var(--bd);border-radius:6px;font-size:12px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;background:var(--blk);color:var(--on)}
.wkd{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.wkd i{height:30px;border:3px solid var(--bd);border-radius:6px;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:900;background:var(--chip)}
.wkd i.d{background:var(--blk);color:var(--on)}
.wkd i.t{border-style:dashed}
'''

JS2 = r'''
HOOKS.push(function(ph){
 $$('.stars',ph).forEach(s=>{const set=n=>{$$('button',s).forEach((b,i)=>b.classList.toggle('on',i<n));const o=$('[data-starv]',ph);if(o)o.textContent=n+' of 5'};
  s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const n=$$('button',s).indexOf(b)+1;set(n);if(window.gsap&&!RM)gsap.fromTo(b,{scale:.7,rotate:-20},{scale:1,rotate:0,duration:.5,ease:'back.out(3)'})});set(+s.dataset.v||0)});
 $$('.cups',ph).forEach(s=>{const set=n=>{$$('button',s).forEach((b,i)=>b.classList.toggle('on',i<n));const o=$('[data-cupv]',ph);if(o)o.textContent=n};
  s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const n=$$('button',s).indexOf(b)+1;set(n);if(window.gsap&&!RM)gsap.fromTo(b,{scaleY:.6},{scaleY:1,duration:.5,ease:'elastic.out(1,.4)'})});set(+s.dataset.v||0)});
 $$('.ring .fg',ph).forEach(c=>{const r=+c.getAttribute('r'),L=2*Math.PI*r,p=+c.dataset.pct/100;c.style.strokeDasharray=L;c.style.strokeDashoffset=L*(1-p);
  if(window.gsap&&!RM)gsap.from(c,{strokeDashoffset:L,duration:1.1,ease:'power3.out',delay:.2})});
 ph.addEventListener('pointerdown',e=>{const t=e.target.closest('.vt');if(t&&window.gsap&&!RM)gsap.to(t,{scale:.95,duration:.1})});
 ['pointerup','pointercancel','pointerleave'].forEach(ev=>ph.addEventListener(ev,()=>{if(window.gsap&&!RM)$$('.vt',ph).forEach(t=>{if(gsap.getProperty(t,'scale')<1)gsap.to(t,{scale:1,duration:.4,ease:'back.out(3)'})})},true));
 const m=$('[data-scrollto]',ph);if(m)setTimeout(()=>{const s=$('.scr',ph);if(s)s.scrollTop=+m.dataset.scrollto},400);
});
'''

def star(): return '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" stroke-linejoin="miter"/></svg>'
def spk(vals): return '<div class="spk">' + ''.join(f'<i style="height:{max(4, int(v * 20))}px"></i>' for v in vals) + '</div>'

def rate(lab, key, v, mx):
    return (f'<div class="rate"><div class="hd2"><b>{lab}</b><span class="num"><b data-o="{key}" data-v="{v}" data-pre="" style="font-size:20px">{v}</b> / {mx}</span></div>'
            f'<div class="rng" data-min="1" data-max="{mx}" data-step="1" data-val="{v}" data-out="{key}"><div class="trk"><div class="fl {g()}"></div></div><div class="kb" aria-label="{lab}"></div></div></div>')

def macro(ic, n, a, b):
    return f'<div class="mac"><div class="t"><i class="im i-{ic}"></i>{n}<span>{a} / {b} g</span></div>{bar(round(a / b * 100))}</div>'

def welcome():
    return (
     f'<div class="hi rv">{av("AR")}<div class="grow"><small>Thursday evening</small><b>Good evening, Alex</b></div><button class="sq" aria-label="Notifications">{SV["bell"]}</button></div>'
     f'<div class="welcome rv"><div><span class="eyb">Daily motivation</span><div class="q">Keep showing up.</div><p>Session 3 of 4 this week. Lower body at 6:30.</p></div><div class="lot" data-l="zlifter"></div></div>')

def trainer_block():
    return (
     sec('Up next', pill('Today')) +
     f'<div class="card rv" style="flex-direction:row"><div class="when"><span class="num">6:30</span><span class="sm mut">PM · 60 min</span></div>'
     f'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:10px"><div><b style="font-size:17px">Lower body strength</b><p class="sm mut">Saturday check-in call at 9:00 AM</p></div>'
     f'<div style="display:flex;gap:8px"><button class="btn gh sm2" style="flex:1;padding:0 8px">Message</button><button class="btn sm2" style="flex:1;padding:0 8px">Reschedule</button></div></div></div>'
     f'<button class="row rv" data-open="trainer" style="border:3px solid var(--bd);border-radius:10px;padding:8px 12px;background:var(--sf);min-height:64px">{av("JR")}<div class="grow"><b>Your trainer · Jordan Reyes</b><span>Message, notes, payment, review</span></div>{SV["chev"]}</button>')

def no_trainer():
    feats = [('workout', 'Custom workout plans'), ('people', 'Live coaching support'), ('progress', 'Real-time progress tracking'), ('schedule', 'Message and schedule sessions')]
    return (
     f'<div class="card sq0 rv" style="gap:10px"><span class="tag" style="align-self:flex-start">No trainer yet</span><h2>Find your perfect trainer</h2>'
     f'<div class="list">' + ''.join(f'<div class="row" style="cursor:default;min-height:52px">{ib(ic)}<div class="grow"><b style="font-size:15px">{t}</b></div></div>' for ic, t in feats) + '</div>'
     f'<button class="btn">Find a trainer</button><button class="btn gh">I have an invite code</button></div>')

def ring(pct, big, small, gr=False):
    return (f'<div class="ring"><svg viewBox="0 0 104 104"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6B9D"/><stop offset="1" stop-color="#FB923C"/></linearGradient></defs>'
            f'<circle class="tr" cx="52" cy="52" r="44"/><circle class="fg" cx="52" cy="52" r="44" data-pct="{pct}"/></svg><div class="c"><div><b class="num">{big}</b><div class="sm mut">{small}</div></div></div></div>')

def progress_block():
    return (
     sec('Your week', '<span>Nov 10 to 16</span>') +
     f'<div class="card rv" style="flex-direction:row;gap:14px;align-items:center">{ring(75, "3", "of 4")}'
     f'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px"><b style="font-size:17px">Sessions done</b><div class="wkd"><i class="d">M</i><i>T</i><i class="d">W</i><i class="t">T</i><i>F</i><i>S</i><i>S</i></div><p class="sm mut">Protein averaging 142 g. Sleep averaging 6.9 h.</p></div></div>' +
     sec("Today's numbers", '<span>Tap to log</span>') +
     '<div class="hs2 rv">'
     f'<button class="vt" data-open="log">{ib("sleeping")}<span class="l">Sleep</span><span class="v num">7.5<small>hrs</small></span>{spk([.6, .7, .5, .8, .55, .45, .75])}</button>'
     f'<button class="vt" data-open="log">{ib("hydration")}<span class="l">Water</span><span class="v num">5<small>cups</small></span><span class="tap">Add a cup</span></button>'
     f'<button class="vt" data-open="log">{ib("scales")}<span class="l">Weight</span><span class="v num">172<small>lb</small></span>{spk([.9, .88, .86, .85, .84, .83, .82])}</button>'
     f'<button class="vt" data-open="log">{ib("workout")}<span class="l">Steps</span><span class="tap">Tap to log</span></button></div>')

def nutrition():
    return (
     sec('Nutrition today', '<button class="chip sm3" style="font-size:13px;padding:0 12px">Log a meal</button>') +
     f'<div class="card rv" style="flex-direction:row;gap:14px;align-items:center">{ring(71, "1,640", "of 2,300")}'
     f'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:9px">{macro("protein", "Protein", 118, 170)}{macro("carbs", "Carbs", 160, 250)}{macro("fats", "Fats", 48, 70)}</div></div>')

def log_block():
    return (
     sec('Workouts today', '<span class="tag">Lower body</span>') +
     f'<div class="card rv"><div>'
     f'<div class="ex"><div class="h"><b>Box squat</b><span class="sm mut">3 sets</span></div><div class="sets"><i class="done">8 × 135</i><i class="done">8 × 135</i><i>8 × 145</i></div></div>'
     f'<div class="ex"><div class="h"><b>Romanian deadlift</b><span class="sm mut">3 sets</span></div><div class="sets"><i>10 × 115</i><i>10 × 115</i><i>10 × 115</i></div></div>'
     f'<div class="ex"><div class="h"><b>Split squat</b><span class="sm mut">2 sets</span></div><div class="sets"><i>10 × 25</i><i>10 × 25</i></div></div></div>'
     f'<div style="display:flex;gap:8px"><button class="btn gh sm2" style="flex:1;padding:0 8px">{SV["plus"]} Add set</button><button class="btn gh sm2" style="flex:1;padding:0 8px">{SV["plus"]} Exercise</button></div>'
     f'<button class="btn">Save workout</button><div style="display:flex;align-items:center;gap:8px" class="sm mut">{pill("Trainer notified")}<span>after you save</span></div></div>')

def checkin_block():
    return (
     sec('Daily check-in', pill('3 of 5 done', 'n')) +
     f'<div class="card rv" style="gap:12px">{rate("Muscle soreness", "so", 3, 8)}{rate("Energy level", "en", 6, 8)}{rate("Stress level", "st", 4, 8)}'
     f'<div class="rate"><div class="hd2"><b>Mood</b></div><div class="chips" data-single data-g="mood">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if m == "Okay" else "false"}">{m}</button>' for m in ['Happy', 'Okay', 'Tired', 'Stressed', 'Anxious']) + '</div></div>'
     f'<div class="rate"><div class="hd2"><b>Post-workout rating</b><span class="num"><b data-o="pw" data-v="8" data-pre="" style="font-size:20px">8</b> / 10</span></div><div class="rng" data-min="1" data-max="10" data-step="1" data-val="8" data-out="pw"><div class="trk"><div class="fl {g()}"></div></div><div class="kb" aria-label="Post-workout rating"></div></div></div></div>' +
     sec('Note to Jordan') +
     f'<div class="fld rv"><textarea id="nt1" aria-label="Note to trainer" style="min-height:84px" placeholder="Tap to add a note for your trainer">Knee felt tight on the second set of squats, fine after warm-up.</textarea><p class="sm mut">Only your coach reads this note.</p></div>')

def go_block():
    return (
     sec('Go to') +
     f'<div class="act rv" data-nopick>' + ''.join(f'<button class="chip tile" aria-pressed="false">{ib(ic)}<span>{t}</span></button>' for ic, t in [('workout', 'Workouts'), ('progress', 'Progress'), ('week', 'History'), ('journey', 'Analytics')]) + '</div>'
     f'<button class="row rv" style="border:3px solid var(--bd);border-radius:10px;padding:8px 12px;background:var(--sf);min-height:64px">{ib("picture")}<div class="grow"><b>Your notes and files</b><span>3 shared by Jordan</span></div>{SV["chev"]}</button>')

def dashboard(trainer=True, scroll=0):
    marker = f'<div data-scrollto="{scroll}" hidden></div>' if scroll else ''
    return marker + welcome() + (trainer_block() if trainer else no_trainer()) + progress_block() + nutrition() + log_block() + checkin_block() + go_block()

S = []
def add(t, n, trainer=True, scroll=0, sheets='', ai=False):
    S.append(screen(t, n, dashboard(trainer, scroll), dock('home', ai=ai) + sheets))

add('1 · Dashboard', 'One scrolling dashboard. It opens on the daily quote and your lifter animation, then your trainer and next session, then your week and today\'s numbers. No tabs: everything you need to see your progress is on the same page.')
add('2 · Dashboard, your week', 'Scrolled down to the progress block: sessions as a ring with the week strip, then number cards you swipe sideways. Each one opens the same log sheet.', scroll=470)
add('3 · Dashboard, log and check-in', 'Further down: the workout log, the daily check-in with sliders, and the note to your trainer. Every part of the old home is here; only the order and the controls changed.', scroll=1240)
add('4 · Dashboard, no trainer', 'Without a trainer the trainer and next-session block becomes one invitation with the four things a trainer adds.', trainer=False)

log_sheet = sheet('log', f'<div style="display:flex;align-items:center;gap:12px">{ib("hydration")}<div style="flex:1"><h2>Log water</h2><p class="sm mut">Tap the cup you are on</p></div></div>'
  f'<div style="display:flex;align-items:baseline;gap:8px"><span class="num" style="font-size:56px;line-height:1" data-cupv>5</span><b>of 8 cups</b></div>'
  f'<div class="cups" data-v="5">' + '<button aria-label="cup"></button>' * 8 + '</div>'
  f'<div class="chips" data-single><button class="chip" aria-pressed="true">Today</button><button class="chip" aria-pressed="false">Yesterday</button></div>'
  f'<div style="display:flex;gap:10px"><button class="btn gh" data-close="log" style="flex:1">Cancel</button><button class="btn" data-close="log" style="flex:1.4">Save</button></div>').replace('data-sheet="log"', 'data-sheet="log" data-autoopen')
add('5 · Log sheet', 'Every number card opens this one sheet, filled for that vital. Water uses cups you tap instead of a number you type.', scroll=470, sheets=log_sheet)

tr_sheet = sheet('trainer', f'<div style="display:flex;gap:12px;align-items:center">{av("JR")}<div style="flex:1;min-width:0"><h2>Jordan Reyes</h2><p class="sm mut">Strength and mobility coach</p></div>{pill("Your trainer")}</div>'
  f'<div class="list">'
  + ''.join(f'<button class="row" {x}>{ib(ic)}<div class="grow"><b>{t}</b><span>{s}</span></div>{SV["chev"]}</button>' for ic, t, s, x in [
    ('people', 'Message', 'Usually replies within a few hours', ''), ('picture', 'View profile', 'Rates, specialties, credentials', ''),
    ('checkin', 'Notes and files', '3 shared with you', ''), ('scales', 'Manage coaching payment', 'Next charge on the 1st', ''),
    ('journey', 'Write a review', 'Tell other clients how it went', 'data-open="review" data-close="trainer"')]) + '</div>').replace('data-sheet="trainer"', 'data-sheet="trainer" data-autoopen')
add('6 · My trainer', 'The trainer row opens this sheet with the five things you can do with your trainer.', sheets=tr_sheet)

rv_sheet = sheet('review', f'<div style="display:flex;gap:12px;align-items:center">{av("JR")}<div style="flex:1"><h2>Review Jordan</h2><p class="sm mut">Visible on their profile</p></div></div>'
  f'<div class="stars" data-v="4">' + (f'<button aria-label="star">{star()}</button>') * 5 + '</div><div class="sm"><b data-starv>4 of 5</b></div>'
  f'<div class="chips" data-g="tags">' + ''.join(f'<button class="chip sm3" aria-pressed="{x}">{t}</button>' for t, x in [('Clear plans', 'true'), ('Responsive', 'true'), ('Pushes me', 'false'), ('Great with injuries', 'false')]) + '</div>'
  f'<div class="fld"><label for="rv1">Your review</label><textarea id="rv1" rows="3">Built around my knee from week one, and checks in without nagging.</textarea></div>'
  f'<div style="display:flex;gap:10px"><button class="btn gh" data-close="review" style="flex:1">Not now</button><button class="btn" data-close="review" style="flex:1.4">Post review</button></div>').replace('data-sheet="review"', 'data-sheet="review" data-autoopen')
add('7 · Write a review', 'The review lives behind the trainer sheet. Stars fill as you tap and tags save typing.', sheets=rv_sheet)

S.append(screen('8 · Navigation bar', 'Your bar, same five slots: Home, Workout (the larger icon), the raised + button, Files, Nutrition. The + opens an add sheet, shown open here. The add sheet contents are my guess at what your + sheet offers.', dashboard(True, 0), dock('home').replace('data-sheet="plus"', 'data-sheet="plus" data-autoopen')))
S.append(screen('9 · Navigation bar, AI layout', 'The same bar with AI Coach in the fourth slot and that tab active.', dashboard(True, 470), dock('ai', ai=True)))

build('client-home.html', 'Coach Connect Client Home', '', 'Client dashboard',
      'The client home as one dashboard for seeing progress: welcome card with the daily quote, trainer and next session, your week, number cards, nutrition, workout log and check-in. Scroll inside the phone. The bottom bar is your real five-slot bar in the new look.',
      S, lots=('zlifter',), extra_js=JS2, extra_css=CSS2)
