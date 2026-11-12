from kit import *

CSS2 = r'''
.wk{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.wk button{min-height:64px;border:3px solid var(--bd);border-radius:8px;background:var(--chip);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-weight:900;font-size:13px;cursor:pointer;padding:0;position:relative}
.wk button i{width:10px;height:10px;border:2.5px solid var(--bd);border-radius:50%;display:block}
.wk button.done i{background:var(--blk)}
.wk button.rest i{border-style:dashed}
.wk button.today{background:var(--blk);color:var(--on);box-shadow:3px 3px 0 var(--sh)}
.wk button.today i{border-color:var(--on);background:var(--on)}
.exr{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 0;border-top:2px solid var(--bd)}
.exr:first-child{border-top:0}
.exr .n{width:30px;height:30px;flex:none;border:3px solid var(--bd);border-radius:8px;display:grid;place-items:center;font-weight:900;font-size:13px;background:var(--chip)}
.exr .grow{flex:1;min-width:0}.exr .grow b{display:block;font-size:16px;line-height:1.2}.exr .grow span{font-size:13px;color:var(--mut)}
.exr .tg{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.mini{display:inline-flex;align-items:center;height:24px;padding:0 8px;border:2.5px solid var(--bd);border-radius:6px;font-size:12px;font-weight:900;background:var(--soft);white-space:nowrap}
.hand{width:30px;height:44px;flex:none;display:grid;place-items:center;cursor:grab}
.hand i{display:block;width:16px;height:3px;background:var(--ink);box-shadow:0 6px 0 var(--ink),0 -6px 0 var(--ink)}
.vid{display:flex;flex-direction:column;gap:8px;width:100%;text-align:left;background:none;border:0;padding:0;cursor:pointer}
.vid .th{height:132px;border:3px solid var(--bd);border-radius:10px;background:repeating-linear-gradient(135deg,var(--soft) 0 10px,var(--chip) 10px 20px);display:grid;place-items:center;position:relative;box-shadow:4px 4px 0 var(--sh)}
.vid .th .pl{width:52px;height:52px;border-radius:50%;border:3px solid var(--bd);background:var(--blk);color:var(--on);display:grid;place-items:center}
.vid .th .du{position:absolute;right:8px;bottom:8px;background:var(--blk);color:var(--on);font-size:12px;font-weight:900;padding:2px 7px;border-radius:4px}
.vid b{font-size:15px;line-height:1.25}
.vp{display:flex;flex-direction:column;gap:28px}
.vs{display:flex;flex-direction:column;gap:14px}
.vh{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.vh h2{font-size:20px}.vh span{font-size:13px;font-weight:800;color:var(--mut)}
.grp{display:flex;flex-direction:column;gap:10px}
.gl2{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.vg{display:grid;grid-template-columns:1fr 1fr;gap:20px 14px}
.vg .vid .th{height:92px;box-shadow:3px 3px 0 var(--sh);border-radius:8px}
.vg .vid .th .pl{width:40px;height:40px}
.vm{display:flex;flex-direction:column;gap:6px;align-items:flex-start;padding:0 2px}
.vm b{font-size:15px;line-height:1.2}
.note2{display:flex;flex-direction:column;gap:6px;padding:12px 14px;background:var(--soft);border:3px solid var(--bd);border-radius:2px 14px 14px 14px}
.note2 b{font-size:15px;line-height:1.3}.note2 span{font-size:13px;color:var(--mut);line-height:1.4}
.hs{display:flex;gap:14px;overflow-x:auto;padding:0 0 14px;margin:0 -16px;padding-inline:16px;scrollbar-width:none;scroll-snap-type:x mandatory;scroll-padding:0 16px}
.hs .vid{scroll-snap-align:start}
.hs::-webkit-scrollbar{display:none}
.hs .vid{flex:none;width:140px}.hs .vid .th{height:180px;border-radius:14px 4px 14px 4px}
.seg.sx{overflow-x:auto;scrollbar-width:none}.seg.sx::-webkit-scrollbar{display:none}.seg.sx button{flex:none;padding:0 16px}
.dtabs{position:sticky;top:-10px;z-index:3;background:var(--bg);padding:6px 0 8px;margin:-6px 0 -4px}
.big{font-size:60px;line-height:1}
.stp5{display:flex;align-items:center;justify-content:space-between;gap:12px}
.stp5>:first-child{width:72px;flex:none}
.stp5 .stepper{flex:1;justify-content:space-between}
.stp5 .stepper output{font-size:44px;min-width:104px}
.stp5 .stepper button{width:52px;height:52px}
.rr{width:190px;height:190px;position:relative;margin:4px auto}
.rr svg{width:190px;height:190px;transform:rotate(-90deg)}
.rr .tr{fill:none;stroke:var(--soft);stroke-width:16}
.rr .fg{fill:none;stroke:var(--blk);stroke-width:16}
.rr .c{position:absolute;inset:0;display:grid;place-items:center;text-align:center}
.rr .c b{font-size:56px;letter-spacing:-2px;line-height:1;display:block;font-variant-numeric:tabular-nums}
.rr .c span{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.setrow{display:flex;gap:8px}
.setrow div{flex:1;border:3px solid var(--bd);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:2px;background:var(--chip);font-size:12px;font-weight:800;color:var(--mut)}
.setrow div b{font-size:17px;color:var(--ink);font-variant-numeric:tabular-nums}
.setrow div.done{background:var(--soft)}
.setrow div.cur{background:var(--blk);color:var(--on)}.setrow div.cur b{color:var(--on)}
.prow{display:flex;gap:12px;align-items:center;min-height:52px}
.prow .dot{width:28px;height:28px;border:3px solid var(--bd);border-radius:50%;flex:none;display:grid;place-items:center;background:var(--chip)}
.prow.ok .dot{background:var(--blk);color:var(--on)}
.prow.cur .dot{border-style:dashed}
.prow b{font-size:15px}
.gtag{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 0;border-top:2px solid var(--bd);width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;cursor:pointer}
.gtag:first-child{border-top:0}
.gtag .grow{flex:1;min-width:0}.gtag .grow span{display:block;font-size:12px;color:var(--mut);font-weight:700}.gtag .grow b{font-size:15px}
.gtag .v{font-weight:900;font-size:14px;text-align:right;max-width:130px}
.mcol{display:flex;gap:8px;flex-wrap:nowrap}
'''
JS2 = r'''
HOOKS.push(function(ph){
 const R=$('[data-sp="rest"]',ph);if(!R)return;
 let t=+R.dataset.t0||90,tot=90,id=null;const ring=$('.rr .fg',ph),L=2*Math.PI*78;
 const draw=()=>{const o=$('[data-time]',ph);if(o)o.textContent=Math.floor(t/60)+':'+String(t%60).padStart(2,'0');if(ring){ring.style.strokeDasharray=L;ring.style.strokeDashoffset=L*(1-t/tot)}};
 const stop=()=>{clearInterval(id);id=null};
 const tick=()=>{if(!document.body.contains(ph)){stop();return}t=Math.max(0,t-1);draw();if(t===0)go('log')};
 const go=to=>{$$('[data-sp]',ph).forEach(p=>p.hidden=p.dataset.sp!==to);$$('[data-bar]',ph).forEach(b=>b.hidden=b.dataset.bar!==to);stop();if(to==='rest'){t=tot=90;draw();id=setInterval(tick,1000)}};
 ph.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go);if(e.target.closest('[data-add]')){t+=30;tot=Math.max(tot,t);draw()}});
 if(!R.hidden){draw();id=setInterval(tick,1000)}
});
'''
SEGHD = lambda lab, r='': f'<div class="eyb rv"><span>{lab}</span>{r}</div>'

def wkstrip():
    days = [('M', 'done'), ('T', 'rest'), ('W', 'done'), ('T', 'today'), ('F', ''), ('S', 'rest'), ('S', '')]
    return '<div class="wk rv">' + ''.join(f'<button class="{c}" aria-label="day">{d}<i></i></button>' for d, c in days) + '</div>'

def exr(i, name, sub, tags=()):
    return (f'<div class="exr"><span class="n">{i}</span><div class="grow"><b>{name}</b><span>{sub}</span>' + ('<div class="tg">' + ''.join(f'<span class="mini">{t}</span>' for t in tags) + '</div>' if tags else '') + f'</div>{SV["chev"]}</div>')

LOWER = [('Box squat', '3 × 8 · 135 lb', ['Barbell']), ('Romanian deadlift', '3 × 10 · 115 lb', ['Barbell']), ('Split squat', '2 × 10 · 25 lb', ['Dumbbell']), ('Hip thrust', '3 × 10 · 135 lb', ['Barbell']), ('Calf raise', '3 × 15 · Bodyweight', ['Bodyweight'])]

def tabs3(active):
    ts = [('p', 'Plan'), ('n', 'Notes'), ('v', 'Videos')]
    return '<div class="dtabs"><div class="seg rv" data-tabs="pt">' + ''.join(f'<button data-t="{k}" aria-pressed="{"true" if k == active else "false"}">{n}</button>' for k, n in ts) + '</div></div>'
def pan(k, a, html): return f'<div data-p="pt:{k}" {"" if k == a else "hidden"} style="display:flex;flex-direction:column;gap:16px">{html}</div>'

def plan_p():
    return (wkstrip() + SEGHD('Today, Thursday') +
      f'<div class="card blk hi rv" style="gap:10px;border-radius:6px 24px 6px 6px"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><h2 style="font-size:24px">Lower body</h2><p style="opacity:.8">5 exercises · about 55 min</p></div>{pill("Session 3 of 4")}</div><button class="btn" style="background:var(--on);color:var(--blk);border-color:var(--on);box-shadow:none">Start session {SV["chev"]}</button></div>'
      f'<div class="card rv"><div class="list">' + ''.join(exr(i + 1, n, s, t) for i, (n, s, t) in enumerate(LOWER)) + '</div></div>'
      + SEGHD('Rest of the week') +
      f'<div class="card flat rv"><div class="list"><div class="row" style="cursor:default">{ib("muscle")}<div class="grow"><b>Fri · Upper body</b><span>5 exercises</span></div>{SV["chev"]}</div><div class="row" style="cursor:default">{ib("sleeping")}<div class="grow"><b>Sat · Rest</b><span>Active recovery day. Focus on mobility and sleep.</span></div></div><div class="row" style="cursor:default">{ib("dumbbells")}<div class="grow"><b>Sun · Full body, easy</b><span>4 exercises</span></div>{SV["chev"]}</div></div></div>')

def notes_p():
    return (f'<div class="card rv" style="gap:10px"><div style="display:flex;align-items:center;gap:12px">{ib("journey")}<h2>Expected timeline</h2></div><div class="tl"><div class="st cur"><span class="n">1</span><div><b>Weeks 1 to 2</b><span>Learn the lifts. Keep every set 2 reps from failure.</span></div></div><div class="st"><span class="n">2</span><div><b>Weeks 3 to 6</b><span>Add 5 lb to the main lifts when all sets are clean.</span></div></div><div class="st"><span class="n">3</span><div><b>Week 7</b><span>Deload, then retest your squat.</span></div></div></div></div>'
      f'<div class="card sq0 rv" style="gap:8px"><div style="display:flex;align-items:center;gap:12px">{ib("injury")}<h2>Important notes</h2></div><p>Box squat to parallel and stop short of the knee ache. Brace your core before each rep.</p></div>'
      f'<div class="card flat rv" style="gap:8px"><div style="display:flex;align-items:center;gap:12px">{ib("protein")}<h2>Nutrition guidance</h2></div><p class="mut">170 g protein on training days. Eat a carb-led meal 2 hours before lower body.</p></div>'
      f'<div style="display:flex;gap:10px" class="rv"><button class="btn gh" style="flex:1">View PDF</button><button class="btn gh" style="flex:1">Share</button></div>')

def chipgrp(label, items, on, single=True):
    return (f'<div class="grp rv"><span class="gl2">{label}</span><div class="chips" {"data-single" if single else ""} data-g="{label}">' +
            ''.join(f'<button class="chip sm3" aria-pressed="{"true" if i in on else "false"}">{i}</button>' for i in items) + '</div></div>')

def vcard(n, tag, d):
    return f'<button class="vid"><div class="th"><span class="pl">{SV["chev"]}</span><span class="du">{d}</span></div><div class="vm"><b>{n}</b><span class="mini">{tag}</span></div></button>'

def vids_p():
    return (
      f'<div class="vp">'
      f'<div class="fld rv"><input aria-label="Search exercises" placeholder="Search the exercise library"></div>'
      + f'<section class="vs rv"><div class="vh"><h2>Pulled from your journey</h2><span>Based on your goals</span></div><div class="hs">' + ''.join(f'<button class="vid"><div class="th"><span class="pl">{SV["chev"]}</span><span class="du">{d}</span></div><b>{n}</b></button>' for n, d in [('Box squat form', '0:42'), ('Romanian deadlift hinge', '0:38'), ('Split squat setup', '0:31')]) + '</div></section>'
      + f'<section class="vs rv"><div class="vh"><h2>Browse the library</h2></div>'
      + chipgrp('Split', ['Push Pull Legs', 'Upper Body', 'Lower Body', 'Full Body'], ['Lower Body'])
      + chipgrp('Muscle', ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'], ['Quads'], False)
      + chipgrp('Equipment', ['Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine'], ['Barbell'], False) + '</section>'
      + f'<section class="vs rv"><div class="vh"><h2>Quads</h2><span>6 results</span></div><div class="vg">' + ''.join(vcard(n, t, d) for n, t, d in [('Barbell back squat', 'Barbell', '0:48'), ('Box squat', 'Barbell', '0:42'), ('Goblet squat', 'Dumbbell', '0:35'), ('Split squat', 'Dumbbell', '0:31'), ('Leg press', 'Machine', '0:40'), ('Step-up', 'Bodyweight', '0:28')]) + '</div></section>'
      + f'<section class="vs rv"><div class="note2"><b>Stop if you feel sharp pain or joint discomfort.</b><span>Form and technique demonstrations from search results. Thumbnails here are samples.</span></div>'
      f'<button class="btn gh" data-open="dis">{ib("banned").replace("class=\"ib ", "class=\"ib sm0 ")} Exercises I want to avoid</button></section></div>')

def tools_sheet():
    return sheet('dis', '<h2>Exercises to avoid</h2><p class="mut">Plans built for you will skip these.</p><div class="chips" data-g="dis">' + ''.join(f'<button class="chip sm3" aria-pressed="{x}">{n}<span class="tick">{SV["check"]}</span></button>' for n, x in [('Burpees', 'true'), ('Lunges', 'true'), ('Running', 'false'), ('Deadlifts', 'false'), ('Pull-ups', 'false'), ('Jump squats', 'false'), ('Planks', 'false')]) + '</div><div style="display:flex;gap:10px"><button class="btn gh" data-close="dis" style="flex:1">Cancel</button><button class="btn" data-close="dis" style="flex:1.4">Save</button></div>')

def plan_home(a, sheets=''):
    head = top('My workout plan', sub='4-day muscle build · week 3', right=f'<button class="sq" aria-label="Saved plans">{ib("week").replace("class=\"ib ", "class=\"ib sm0 ")}</button>')
    return head + tabs3(a) + pan('p', a, plan_p()) + pan('n', a, notes_p()) + pan('v', a, vids_p()), dock(1) + sheets

S = []
def add(t, n, body, extra=''): S.append(screen(t, n, body, extra))
def addp(t, n, a, sheets=''):
    b, d = plan_home(a, sheets); S.append(screen(t, n, b, d))

addp('1 · My plan', 'Plan opens on the week as a strip, not a calendar. Today is the black day, finished days are filled, and rest days are dashed. One black card starts the session; everything else is the rest of the plan.', 'p')
addp('2 · Plan notes', 'Timeline, injury notes and nutrition guidance move to their own tab. The timeline is a real sequence, so it is numbered. The PDF and Share are one tap away.', 'n')
addp('3 · Exercise videos', 'Videos start with the exercises in your plan, then the full library by muscle. Sources are labeled as search results. The avoid list is a sheet, not a settings screen.', 'v')
S.append(screen('4 · Exercise videos, avoid list', 'Picking exercises to avoid is a one-sheet chip list with a count, so it can be changed mid-plan.', *plan_home('v', tools_sheet().replace('data-sheet="dis"', 'data-sheet="dis" data-autoopen'))))

# session
def sesbar(label):
    return (f'<div style="display:flex;align-items:center;gap:12px" class="rv"><button class="sq" aria-label="End session">{SV["x"]}</button><div style="flex:1;min-width:0"><b style="font-size:17px">Lower body</b><p class="sm mut">{label}</p></div>{pill("24:10", "n")}</div>'
            f'<div class="bar rv">{"" }<i class="{g()}" style="width:36%" data-fill></i></div>')
logp = (f'<div data-sp="log" style="display:flex;flex-direction:column;gap:16px"><div><span class="eyb">Set 2 of 3</span><h1 style="font-size:34px;margin-top:4px">Box squat</h1><p class="mut" style="margin-top:6px">Target 8 reps. Last time 8 × 135 lb.</p></div>'
        f'<div class="setrow"><div class="done">Set 1<b>8 × 135</b></div><div class="cur">Set 2<b>now</b></div><div>Set 3<b>8 × 135</b></div></div>'
        f'<div class="card"><div class="stp5"><div><span class="eyb">Weight</span></div><div class="stepper"><button data-st="-5" aria-label="Less weight">{SV["minus"]}</button><output class="num" data-min="0" data-max="500">135</output><button data-st="5" aria-label="More weight">{SV["plus"]}</button></div></div>'
        f'<div class="stp5" style="border-top:2px solid var(--bd);padding-top:12px"><div><span class="eyb">Reps</span></div><div class="stepper"><button data-st="-1" aria-label="Fewer reps">{SV["minus"]}</button><output class="num" data-min="0" data-max="50">8</output><button data-st="1" aria-label="More reps">{SV["plus"]}</button></div></div></div>'
        f'<div class="note" style="background:var(--soft);border:3px solid var(--bd);border-radius:2px 14px 14px 14px;padding:12px;font-size:15px;line-height:1.4"><b style="display:block;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);margin-bottom:4px">Cue</b>Brace your core before each rep.</div></div>')
restp = (f'<div data-sp="rest" data-t0="47" hidden style="display:flex;flex-direction:column;gap:16px"><div style="text-align:center"><span class="eyb" style="justify-content:center">Rest</span></div>'
         f'<div class="rr"><svg viewBox="0 0 190 190"><defs><linearGradient id="rg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#60A5FA"/><stop offset="1" stop-color="#818CF8"/></linearGradient></defs><circle class="tr" cx="95" cy="95" r="78"/><circle class="fg" cx="95" cy="95" r="78"/></svg><div class="c"><div><b data-time>0:47</b><span>until set 3</span></div></div></div>'
         f'<div style="display:flex;gap:10px"><button class="btn gh" data-add style="flex:1">+30 s</button><button class="btn gh" style="flex:1">End workout</button></div>'
         f'<div class="card flat"><div class="prow ok"><span class="dot">{SV["check"]}</span><b>Set 2 logged: 8 × 135 lb</b></div><div class="prow cur"><span class="dot"></span><div><b>Next: set 3, box squat</b><p class="sm mut">Same weight, aim for 8 clean reps</p></div></div></div></div>')
nextup = '<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px">' + ib('dumbbells') + '<div style="flex:1;min-width:0"><span class="sm mut">Up next</span><b style="display:block">Romanian deadlift · 3 × 10</b></div></div>'
seslog = sesbar('Exercise 1 of 5 · 4 of 11 sets') + f'<div class="rv">{logp}{restp}</div>' + nextup
S.append(screen('5 · Session, log a set', 'Session mode is one exercise at a time with the two numbers you change as big steppers. Logging a set starts the rest timer. This screen runs the real flow, so tap Log set.', seslog, '<div class="bnav2"><button class="btn" data-bar="log" data-go="rest">Log set</button><button class="btn" data-bar="rest" data-go="log" hidden>Skip rest</button></div>', ))
S[-1] = S[-1].replace('<div class="bnav2">', '<div class="bnav2" style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd)">')
restfirst = seslog.replace('<div data-sp="log" style="display:flex', '<div data-sp="log" hidden style="display:flex').replace('data-sp="rest" data-t0="47" hidden', 'data-sp="rest" data-t0="47"')
S.append(screen('6 · Session, resting', 'Rest is a ring with the time as the biggest thing on the screen, plus the two actions you need: add 30 seconds or skip. It returns to the next set by itself at zero.', restfirst, '<div class="bnav2" style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd)"><button class="btn" data-bar="log" data-go="rest" hidden>Log set</button><button class="btn" data-bar="rest" data-go="log">Skip rest</button></div>'))

# generate
def gt(ic, lab, help_, val):
    return f'<button class="gtag" data-open="field">{ib(ic)}<div class="grow"><b>{lab}</b><span>{help_}</span></div><span class="v">{val}</span>{SV["chev"]}</button>'
gen = (top('New plan') +
  '<div class="seg rv" data-tabs="gp"><button data-t="a" aria-pressed="true">Build with AI</button><button data-t="t" aria-pressed="false">Ask my trainer</button></div>'
  '<div data-p="gp:a" style="display:flex;flex-direction:column;gap:16px"><div class="rv"><h1>Built from your profile</h1><p class="sm mut" style="margin-top:6px">Tap anything that looks wrong and fix it before you generate.</p></div>'
  '<div class="card rv"><div class="list">' + gt('age', 'Age', 'personal info', '29') + gt('height', 'Height', 'personal info', '5\'11"') + gt('journey', 'Goal', 'primary goal', 'Build Muscle') + gt('inter', 'Level', 'training status', 'Intermediate') + gt('week', 'Frequency', 'weekly sessions', '4 days') + gt('gym', 'Environment', 'training place', 'Home') + gt('dumbbells', 'Equipment', 'available tools', '2 selected') + gt('injury', 'Injuries', 'limitations', 'Left knee') + gt('energy', 'Energy', 'daily energy', 'Moderate') + gt('hydration', 'Hydration', 'water habits', '4–8 cups') + '</div></div>'
  '<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px"><div style="flex:1;min-width:0"><b>2 of 3 plans used this month</b><p class="sm mut">Resets on Dec 1</p></div>' + pill('1 left') + '</div>'
  '<button class="btn rv">Generate plan</button></div>'
  '<div data-p="gp:t" hidden style="display:flex;flex-direction:column;gap:16px"><div class="card" style="flex-direction:row;align-items:center;gap:12px">' + av('JR') + '<div style="flex:1;min-width:0"><b>Jordan Reyes</b><p class="sm mut">Your trainer</p></div></div>'
  '<div class="fld"><label for="rq1">What kind of plan do you want?</label><textarea id="rq1" rows="4">Four days a week at home with dumbbells. I want to keep squats knee-friendly.</textarea></div><button class="btn">Send request</button><p class="sm mut">Clients send plan requests from their account. Jordan builds it and it lands here.</p></div>')
fsheet = sheet('field', '<h2>Edit equipment</h2><p class="mut">Used only for this plan request.</p><div class="chips" data-g="eq">' + ''.join(f'<button class="chip sm3" aria-pressed="{x}">{n}<span class="tick">{SV["check"]}</span></button>' for n, x in [('Full gym', 'false'), ('Dumbbells', 'true'), ('Resistance bands', 'false'), ('Pull-up bar', 'true'), ('Bodyweight only', 'false')]) + '</div><div style="display:flex;gap:10px"><button class="btn gh" data-close="field" style="flex:1">Cancel</button><button class="btn" data-close="field" style="flex:1.4">Save</button></div>')
S.append(screen('7 · New plan', 'Generating starts from a list of the facts the plan will use, each one editable in place. The monthly limit is stated before you tap, and Ask my trainer is a tab rather than a dead end.', gen, dock(1) + fsheet))

stepsl = [('ok', 'Reading your profile'), ('ok', 'Choosing exercises for dumbbells and a pull-up bar'), ('cur', 'Working around your left knee'), ('', 'Writing notes and nutrition guidance')]
genb = (top('Building your plan', back=False) +
  '<div class="card sq0 rv" style="align-items:center;padding:8px"><div class="lot lg" data-l="diet" style="width:100%;height:150px"></div></div>'
  f'<div class="rv"><h1>Almost there</h1><p class="mut" style="margin-top:6px">This takes about a minute.</p></div><div class="bar rv"><i class="{g()}" style="width:64%" data-fill></i></div>'
  '<div class="card flat rv"><div>' + ''.join(f'<div class="prow {c}"><span class="dot">{SV["check"] if c == "ok" else ""}</span><b>{t}</b></div>' for c, t in stepsl) + '</div></div>'
  '<p class="sm mut rv">You can leave this screen. Your plan keeps building and shows up in Saved plans.</p><button class="btn gh rv">Back to Today</button>')
S.append(screen('8 · Building', 'The wait shows four named steps with the current one dashed, plus the promise that leaving does not cancel it.', genb, dock(1)))

# saved
svd = (top('Saved plans', right=f'<button class="sq" aria-label="New plan">{SV["plus"]}</button>') +
  '<div class="fld rv"><input aria-label="Search plans" placeholder="Search your plans"></div>'
  '<div class="card rv"><div class="list">' + ''.join(f'<button class="row">{ib(ic)}<div class="grow"><b>{n}</b><span>{s}</span></div>{p}</button>' for ic, n, s, p in [('muscle', '4-day muscle build', 'Built by AI · Nov 2', pill('Active')), ('dumbbells', 'Strength block', 'From Jordan · Oct 14', pill('Trainer', 'n')), ('workout', 'Home dumbbell, 3 days', 'Built by AI · Sep 3', '')]) + '</div></div>'
  '<button class="btn gh rv" data-open="delp">Delete a plan</button>')
dsheet = sheet('delp', '<span class="pill g2" style="align-self:flex-start">Cannot be undone</span><h2>Delete plan</h2><p class="mut">Are you sure you want to delete this workout plan?</p><div class="card flat" style="flex-direction:row;align-items:center;gap:12px">' + ib('workout') + '<div><b>Home dumbbell, 3 days</b><p class="sm mut">Built by AI · Sep 3</p></div></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="delp" style="flex:1">Keep it</button><button class="btn" data-close="delp" style="flex:1.2">Delete plan</button></div>').replace('data-sheet="delp"', 'data-sheet="delp" data-autoopen')
S.append(screen('9 · Saved plans', 'Saved plans are rows with who built each one. Delete names the plan and says it cannot be undone.', svd, dock(1) + dsheet))

# trainer builder
DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
b1 = (top('Build a plan') + steps(0, 3, 40) + '<div class="eyb rv"><span>Step 1 of 3 · Schedule</span></div>'
  '<h1 class="rv">Name your plan and set the schedule shell</h1>'
  '<div class="fld rv"><label for="pn">Plan name</label><input id="pn" value="4-day muscle build"></div>'
  '<div class="fld rv"><label>For</label><div class="chips" data-single data-g="for">' + ''.join(f'<button class="chip sm3" aria-pressed="{x}">{n}</button>' for n, x in [('Alex R.', 'true'), ('Maya C.', 'false'), ('Dev P.', 'false'), ('Template', 'false')]) + '</div></div>'
  + SEGHD('Training days') +
  '<div class="wk rv" data-g="days" data-nopickx>' + ''.join(f'<button class="chip" style="min-height:56px;padding:0;justify-content:center" aria-pressed="{"true" if i in (0, 2, 3, 4) else "false"}">{d}</button>' for i, d in enumerate(DAYS)) + '</div>'
  + SEGHD('What each day is') +
  '<div class="card rv"><div class="list">' + ''.join(f'<div class="row" style="cursor:default;flex-direction:column;align-items:stretch;gap:8px"><b>{d}</b><div class="seg">' + ''.join(f'<button aria-pressed="{"true" if t == v else "false"}" style="font-size:12px;padding:0 4px">{t}</button>' for t in ['Upper', 'Lower', 'Full body', 'Custom']) + '</div></div>' for d, v in [('Monday', 'Upper'), ('Wednesday', 'Full body'), ('Thursday', 'Lower'), ('Friday', 'Upper')]) + '</div></div>')
S.append(screen('10 · Builder, schedule', 'The trainer builds the week first and the days second. Each chosen day gets a type, so the plan has a shape before a single exercise is added.', b1, '<div class="bnav2" style="position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd)"><button class="btn gh" style="width:56px;padding:0;flex:none">' + SV['back'] + '</button><button class="btn">Add exercises ' + SV['chev'] + '</button></div>'))

def brow(n, s):
    return f'<div class="exr"><span class="hand"><i></i></span><div class="grow"><b>{n}</b><span>{s}</span></div><button class="sq" style="width:44px;height:44px;box-shadow:none" data-open="edx" aria-label="Edit">{SV["chev"]}</button></div>'
b2 = (top('Build a plan') + steps(0, 3, 85) + '<div class="eyb rv"><span>Step 2 of 3 · Exercises</span></div>'
  '<div class="seg sx rv" data-tabs="bd">' + ''.join(f'<button data-t="{k}" aria-pressed="{"true" if k == "th" else "false"}">{n}</button>' for k, n in [('m', 'Mon · Upper'), ('w', 'Wed · Full body'), ('th', 'Thu · Lower'), ('f', 'Fri · Upper')]) + '</div>'
  '<div class="card rv"><div class="list">' + ''.join(brow(n, s) for n, s, t in LOWER[:4]) + '</div></div>'
  f'<button class="btn gh rv" data-open="lib">{SV["plus"]} Add exercise</button><p class="sm mut rv">Drag the handle to reorder. Tap an exercise to change sets, reps and weight.</p>')
libs = sheet('lib', '<h2>Exercise library</h2><div class="fld"><input aria-label="Search" placeholder="Search exercises"></div>'
  '<div class="seg sx" data-nopick>' + ''.join(f'<button aria-pressed="{"true" if m == "Glutes" else "false"}">{m}</button>' for m in ['Chest', 'Back', 'Shoulders', 'Biceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves']) + '</div>'
  '<div class="chips" data-g="eqf">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if e in ("Barbell", "Dumbbell") else "false"}">{e}</button>' for e in ['Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine']) + '</div>'
  '<div class="list">' + ''.join(f'<button class="row" data-close="lib" data-open="edx"><div class="grow"><b>{n}</b><span>{s}</span></div><span class="sq" style="width:44px;height:44px;box-shadow:none;display:grid;place-items:center;border:3px solid var(--bd);border-radius:10px">{SV["plus"]}</span></button>' for n, s in [('Barbell hip thrust', 'Glutes · Barbell'), ('Dumbbell glute bridge', 'Glutes · Dumbbell'), ('Cable pull-through', 'Glutes · Cable')]) + '</div>'
  '<button class="btn gh" data-close="lib">Use a custom name</button>')
S.append(screen('11 · Builder, exercises', 'Exercises are rows with a reorder handle and one tap to edit. Adding opens the library inside a sheet, so the day stays visible behind it.', b2, '<div class="bnav2" style="position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd)"><button class="btn gh" style="width:56px;padding:0;flex:none">' + SV['back'] + '</button><button class="btn">Review ' + SV['chev'] + '</button></div>' + libs.replace('data-sheet="lib"', 'data-sheet="lib" data-autoopen')))

edx = sheet('edx', '<h2>Edit exercise</h2><div class="fld"><label for="en">Exercise</label><input id="en" value="Box squat"></div>'
  f'<div class="card flat" style="gap:10px"><div class="stp5"><span class="eyb">Sets</span><div class="stepper"><button data-st="-1" aria-label="Fewer sets">{SV["minus"]}</button><output class="num" data-min="1" data-max="10" style="font-size:30px;min-width:48px">3</output><button data-st="1" aria-label="More sets">{SV["plus"]}</button></div></div>'
  f'<div class="stp5" style="border-top:2px solid var(--bd);padding-top:10px"><span class="eyb">Reps</span><div class="stepper"><button data-st="-1" aria-label="Fewer reps">{SV["minus"]}</button><output class="num" data-min="1" data-max="50" style="font-size:30px;min-width:48px">8</output><button data-st="1" aria-label="More reps">{SV["plus"]}</button></div></div>'
  f'<div class="stp5" style="border-top:2px solid var(--bd);padding-top:10px"><span class="eyb">Weight</span><div class="stepper"><button data-st="-5" aria-label="Less weight">{SV["minus"]}</button><output class="num" data-min="0" data-max="500" style="font-size:30px;min-width:60px">135</output><button data-st="5" aria-label="More weight">{SV["plus"]}</button></div></div></div>'
  '<div class="fld"><label for="cu">Coaching cue</label><input id="cu" value="Brace your core before each rep."></div>'
  '<div style="display:flex;gap:10px"><button class="btn gh" data-close="edx" style="flex:1">Cancel</button><button class="btn" data-close="edx" style="flex:1.4">Save exercise</button></div>')
S.append(screen('12 · Edit exercise', 'Sets, reps and weight are three steppers, with a cue field that shows up in the client\'s session mode.', b2.replace('data-open="lib"', 'data-open="lib"'), '<div class="bnav2" style="position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd)"><button class="btn gh" style="width:56px;padding:0;flex:none">' + SV['back'] + '</button><button class="btn">Review ' + SV['chev'] + '</button></div>' + edx.replace('data-sheet="edx"', 'data-sheet="edx" data-autoopen')))

build('workouts.html', 'Coach Connect Workouts', '', 'Workouts',
      'Plans for clients and trainers: the week strip and plan tabs, session mode with a rest timer, exercise videos, building a plan with AI or asking a trainer, saved plans, and the trainer plan builder with its exercise library.',
      S, lots=('diet',), extra_js=JS2, extra_css=CSS2)
