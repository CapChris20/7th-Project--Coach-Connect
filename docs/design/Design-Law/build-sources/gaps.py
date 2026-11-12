import re, os, io, contextlib
from kit import *
with contextlib.redirect_stdout(io.StringIO()):
    import coach as C, home as H, progress as P

def css_of(name):
    src = open(os.path.join(B, name + '.py')).read()
    return re.search(r"CSS2 = r'''(.*?)'''", src, re.S).group(1)
def js_of(name):
    src = open(os.path.join(B, name + '.py')).read()
    return re.search(r"JS2 = r'''(.*?)'''", src, re.S).group(1)

CSS = css_of('coach') + css_of('home') + css_of('progress') + r'''
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.role{display:flex;flex-direction:column;gap:12px;padding:16px;border:3px solid var(--bd);border-radius:10px;background:var(--sf);box-shadow:5px 5px 0 var(--sh);text-align:left;cursor:pointer;width:100%}
.role[aria-pressed="true"]{background:var(--blk);color:var(--on)}
.role[aria-pressed="true"] .ib{border-color:var(--on)}
.role h2{margin:0;font-size:22px}
.role ul{margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.role li{list-style:none;display:flex;gap:10px;font-size:14px;line-height:1.35}
.role li::before{content:"";width:9px;height:9px;margin-top:6px;flex:none;border:3px solid currentColor;background:currentColor}
.sr3{display:grid;grid-template-columns:34px 1fr 1fr 44px;gap:8px;align-items:center}
.sr3 .n{width:34px;height:34px;border:3px solid var(--bd);border-radius:8px;display:grid;place-items:center;font-weight:900;font-size:13px;background:var(--chip)}
.sr3 input{min-height:44px;width:100%;border:3px solid var(--bd);border-radius:8px;background:var(--sf);font-size:16px;font-weight:800;text-align:center;font-variant-numeric:tabular-nums;color:var(--ink)}
.sr3 .ck{width:44px;height:44px;border:3px solid var(--bd);border-radius:8px;background:var(--chip);display:grid;place-items:center;cursor:pointer;padding:0;color:var(--on)}
.sr3 .ck[aria-pressed="true"]{background:var(--blk)}
.sr3 .ck svg{opacity:0}.sr3 .ck[aria-pressed="true"] svg{opacity:1}
.cols{display:grid;grid-template-columns:34px 1fr 1fr 44px;gap:8px;font-size:12px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:var(--mut);text-align:center}
.mood{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.mood .chip.tile{min-height:88px}
.xl2{color:var(--ink);overflow:auto;border:3px solid var(--bd);border-radius:8px;background:var(--sf);box-shadow:4px 4px 0 var(--sh);max-height:360px}
.xl2 table,.xl2 td,.xl2 th{color:var(--ink)}
.xl2 td.sel{color:var(--on)}
.xl2 table{border-collapse:separate;border-spacing:0;font-size:14px;min-width:520px;width:100%}
.xl2 th,.xl2 td{height:44px;padding:0 10px;white-space:nowrap;border-bottom:2px solid var(--bd);border-right:2px solid var(--bd);text-align:left;font-variant-numeric:tabular-nums}
.xl2 th{background:var(--soft);font-size:12px;font-weight:900;text-align:center;position:sticky;top:0;z-index:2}
.xl2 td:first-child,.xl2 th:first-child{position:sticky;left:0;z-index:1;width:36px;min-width:36px;text-align:center;background:var(--soft);font-size:12px;font-weight:900;border-right:3px solid var(--bd);padding:0}
.xl2 th:first-child{z-index:3}
.xl2 td.sel{background:var(--blk);color:var(--on);font-weight:900;outline:3px solid var(--bd);outline-offset:-3px}
.xl2 td.f{font-weight:900;background:var(--soft)}
.fx{display:flex;align-items:center;gap:10px;min-height:48px;padding:0 12px;border:3px solid var(--bd);border-radius:8px;background:var(--sf)}
.fx b{font-family:ui-monospace,Menlo,monospace;font-size:15px;border:3px solid var(--bd);border-radius:6px;padding:1px 8px;background:var(--soft)}
.fx span{font-family:ui-monospace,Menlo,monospace;font-size:15px;font-weight:800}
.tools2{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}
.tools2::-webkit-scrollbar{display:none}
.tools2 button{flex:none;min-width:44px;height:44px;border:3px solid var(--bd);border-radius:8px;background:var(--chip);font-weight:900;font-size:15px;color:var(--ink);cursor:pointer;padding:0 10px}
.cl{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 0;border-top:2px solid var(--bd)}
.cl:first-child{border-top:0}.cl .grow{flex:1;min-width:0}.cl b{display:block;font-size:16px}.cl span.s{font-size:13px;color:var(--mut)}
.bnav{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd);z-index:4}
.bnav .btn{flex:1}
'''
JS = js_of('coach') + js_of('home') + js_of('progress') + r'''
HOOKS.push(function(ph){
 $$('.role',ph).forEach(r=>r.addEventListener('click',()=>{$$('.role',ph).forEach(x=>x.setAttribute('aria-pressed','false'));r.setAttribute('aria-pressed','true');if(window.gsap&&!RM)gsap.fromTo(r,{scale:.97},{scale:1,duration:.4,ease:'back.out(3)'})}));
 $$('.sr3 .ck',ph).forEach(c=>c.addEventListener('click',()=>c.setAttribute('aria-pressed',String(c.getAttribute('aria-pressed')!=='true'))));
 $$('.xl2 td',ph).forEach(td=>td.addEventListener('click',()=>{if(td.cellIndex===0)return;$$('.xl2 td.sel',ph).forEach(x=>x.classList.remove('sel'));td.classList.add('sel');const f=$('.fx span',ph),n=$('.fx b',ph);if(f)f.textContent=td.dataset.f||td.textContent;if(n)n.textContent=String.fromCharCode(64+td.cellIndex)+td.parentElement.rowIndex}));
});
'''

S = []
def add(t, n, body, extra='', a=None, lab='', second=False, nodock=False):
    S.append(screen(t, n, body, (dock(a) if a else '') + extra, lab=lab, second=second, nodock=nodock))

# 1 role
role = (top('Choose role', back=True) + '<div style="display:flex;gap:10px;align-items:center" class="rv"><div style="flex:1;min-width:0"><h1>How will you use Coach Connect?</h1><p class="sm mut" style="margin-top:6px">You can switch later from Settings.</p></div></div>'
  '<button class="role rv" aria-pressed="true"><div style="display:flex;align-items:center;gap:12px">' + ib('people') + '<h2>I want a coach</h2></div><ul><li><span>Find a trainer or join yours with a code</span></li><li><span>Get a plan, log workouts and meals</span></li><li><span>Message and book sessions</span></li></ul></button>'
  '<button class="role rv" aria-pressed="false"><div style="display:flex;align-items:center;gap:12px">' + ib('dumbbell') + '<h2>I am a coach</h2></div><ul><li><span>List yourself and take on clients</span></li><li><span>Build plans, documents and sheets</span></li><li><span>Track every client in one place</span></li></ul></button>',
  '<div class="bnav"><button class="btn">Continue ' + SV['chev'] + '</button></div>')
add('1 · Choose role', 'The role choice is two big tiles that say what each side gets, and the chosen one turns black. It was in your old screens as How will you use Coach Connect, and the new sign-up only had a small switch for it. Tap a tile.', role[0], role[1])

# 2 log workout pair
def setrow(i, w, r, ok): return f'<div class="sr3"><span class="n">{i}</span><input aria-label="Weight" value="{w}" inputmode="decimal"><input aria-label="Reps" value="{r}" inputmode="numeric"><button class="ck" aria-pressed="{ok}" aria-label="Done">{SV["check"]}</button></div>'
def logw(data=True):
    h = top('Log workout', sub='Lower body · Thu, Nov 13')
    if not data:
        return h + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('workout', 'lg') + '<h1>No workout logged yet</h1><p class="mut">Add the exercises you did, with sets and weight. Your trainer is told when you save.</p><button class="btn">Add from my plan</button><button class="btn gh">Add an exercise</button></div>'
    ex = lambda n, sets: ('<div class="card rv" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:17px">' + n + '</b><button class="sq" aria-label="Remove exercise" style="width:44px;height:44px;box-shadow:none">' + SV['x'] + '</button></div><div class="cols"><span>Set</span><span>lb</span><span>Reps</span><span></span></div>' + sets + '<button class="btn gh sm2" style="align-self:flex-start;width:auto;padding:0 14px">' + SV['plus'] + ' Add set</button></div>')
    return (h + ex('Box squat', setrow(1, 135, 8, 'true') + setrow(2, 135, 8, 'true') + setrow(3, 145, 8, 'false')) + ex('Romanian deadlift', setrow(1, 115, 10, 'false') + setrow(2, 115, 10, 'false'))
            + '<button class="btn gh rv">' + SV['plus'] + ' Add exercise</button><div class="card flat rv"><div class="rate"><div class="hd2"><b>Post-workout rating</b><span class="num"><b data-o="pw2" data-v="8" data-pre="" style="font-size:20px">8</b> / 10</span></div><div class="rng" data-min="1" data-max="10" data-step="1" data-val="8" data-out="pw2"><div class="trk"><div class="fl ' + g() + '"></div></div><div class="kb" aria-label="Rating"></div></div></div></div>')
add('2 · Log workout', 'A standalone log: each exercise is a card with set rows (weight, reps, a done box), so you type numbers instead of tapping chips. Done sets turn black. The empty side offers the plan or a blank exercise. This was a separate screen in your old set and was only a card on the dashboard.', logw(True), '<div class="bnav"><button class="btn">Save workout</button></div>', lab='Logging', a=None)
add('x', 'x', logw(False), '', lab='Empty', second=True)

# 3 check-in
ck = (top('Daily check-in', sub='3 of 5 done') + steps(0, 3, 60).replace('Chapter 1 of 3', 'Check-in progress') +
  '<div class="card rv" style="gap:12px">' + H.rate('Muscle soreness', 'so3', 3, 8) + H.rate('Energy level', 'en3', 6, 8) + H.rate('Stress level', 'st3', 4, 8) + '</div>'
  '<div class="gl3 rv" style="font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)">Mood</div><div class="chips rv" data-single data-g="md">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if m == "Okay" else "false"}">{m}</button>' for m in ['Happy', 'Okay', 'Tired', 'Stressed', 'Anxious']) + '</div>'
  '<div class="fld rv"><label for="ckn">Note to Jordan</label><textarea id="ckn" rows="3" placeholder="Tap to add a note for your trainer">Slept badly, long day at work.</textarea></div>', '<div class="bnav"><button class="btn">Save check-in</button></div>')
add('3 · Daily check-in', 'The check-in as its own screen: three sliders, one mood row, a note. The same controls as the dashboard, so the habit is the same in both places.', ck[0], ck[1])

# 4 mood
md = (top('Mood check-in', sub='How are you feeling?') + '<div class="mood rv" data-single data-g="m5">' + ''.join(f'<button class="chip tile" aria-pressed="{"true" if m == "Tired" else "false"}">{ib(ic)}<span>{m}<small>{s}</small></span><span class="tick">{SV["check"]}</span></button>' for m, ic, s in [('Happy', 'energy', 'Good energy'), ('Okay', 'progress', 'Steady'), ('Tired', 'sleeping', 'Low battery'), ('Stressed', 'stress', 'Wound up'), ('Anxious', 'injury', 'On edge')]) + '</div>'
  '<div class="fld rv"><label for="mn">What is behind it? (optional)</label><textarea id="mn" rows="3">Long day at work and a poor night of sleep.</textarea></div><p class="sm mut rv">Only your coach reads this note.</p>', '<div class="bnav"><button class="btn">Save mood</button></div>')
add('4 · Mood check-in', 'Mood is five tiles with a few words under each, because a mood is a short thought and not a number. The note is optional and says who reads it.', md[0], md[1])

# 5 momentum
mom = (top('Weekly Momentum', sub='Calories against your goal') + '<div class="card rv" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><div><span class="gl3" style="font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)">Days on target</span><div class="num big">5 of 7</div></div>' + pill('Best week yet') + '</div>'
  + P.bar_chart([2250, 2380, 2100, 2300, 1950, 2600, 2280], ['M', 'T', 'W', 'T', 'F', 'S', 'S'], 3000, 2300).replace('Hours slept each day', 'Calories each day').replace('>0<', '>0<') + '<p class="sm mut">Dashed line is your 2,300 calorie goal.</p></div>'
  '<div class="gl3 rv" style="font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)">Next Habit</div>'
  '<div class="card rv" style="flex-direction:row;align-items:center;gap:12px">' + ib('protein') + '<div style="flex:1;min-width:0"><b style="font-size:17px">Log breakfast before 9 am</b><p class="sm mut">You skipped it 3 of 7 days. That is where you miss protein.</p></div><button class="sw" aria-pressed="false" aria-label="Take this habit"></button></div>'
  '<button class="btn rv">Log a meal</button>')
add('5 · Weekly Momentum', 'Momentum is one chart and one habit: how many days were on target, then the single next thing to do, with a switch to take it on. Both parts are in your nutrition screens; this gives them a page.', mom, '', a='nutrition')

# 6-7 spreadsheet editor
rows = [('Exercise', 'Mon', 'Wed', 'Fri'), ('Box squat', '3×8 @ 135', '3×8 @ 140', '3×6 @ 145'), ('Romanian deadlift', '3×10 @ 115', '3×10 @ 115', '3×8 @ 125'), ('Split squat', '2×10 @ 25', '2×10 @ 30', '2×10 @ 30'), ('Hip thrust', '3×10 @ 135', '3×10 @ 145', '3×8 @ 155'), ('Total sets', '=SUM(B2:B5)', '', '')]
head = '<tr><th></th>' + ''.join(f'<th>{c}</th>' for c in 'ABCD') + '</tr>'
body_ = ''.join('<tr><td>' + str(i + 1) + '</td>' + ''.join(f'<td class="{"sel" if (i, j) == (1, 1) else ""}" data-f="{c}">{"11" if c.startswith("=") else c}</td>' for j, c in enumerate(r)) + '</tr>' for i, r in enumerate(rows))
sed = (top('Week 3 program', sub='Spreadsheet · Saved just now', right='<button class="sq" data-open="sm" aria-label="Menu"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="3" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="17" y="10" width="4" height="4"/></svg></button>') +
  '<div class="fx rv"><b>B2</b><span>3×8 @ 135</span></div><div class="xl2 rv"><table><thead>' + head + '</thead><tbody>' + body_ + '</tbody></table></div>'
  '<div class="tools2 rv"><button>B</button><button>I</button><button>+ Row</button><button>+ Col</button><button>Σ Sum</button><button>Fill</button><button>Undo</button></div>'
  '<p class="sm mut rv">Tap a cell to edit it. The bar above shows its value or formula. Row and column headers stay put.</p><button class="btn rv" data-open="shs">Share with clients</button>')
sm = sheet('sm', '<h2>Sheet menu</h2><div class="list">' + ''.join(f'<button class="row"><div class="grow"><b>{t}</b><span>{s}</span></div>{SV["chev"]}</button>' for t, s in [('Format cells', 'Bold, italic, number format'), ('Insert row or column', 'Above, below, left, right'), ('Delete row or column', 'Asks first'), ('Sort', 'A to Z or by column'), ('Export', 'CSV or PDF')]) + '</div><button class="btn gh" data-close="sm">Close</button>')
add('6 · Spreadsheet editor', 'The trainer\'s sheet editor: a formula bar showing the selected cell, a grid with pinned row numbers and column letters, and a one-row toolbar. Tap any cell to move the selection. This was the old Untitled sheet screen.', sed, sm)
add('7 · Sheet menu', 'The slide-up menu holds the less common actions, so the toolbar stays short.', sed, sm.replace('data-sheet="sm"', 'data-sheet="sm" data-autoopen'))

# 8-9 trainer AI coach
hero = lambda: '<div class="hero2 rv"><div><span class="eyb">Trainer coach · Fitness only</span><div class="q">Who needs you today?</div><p>I see all 9 clients and their logs.</p></div><div class="lot" data-l="robot"></div></div>'
tcoach = (top('Ask your coach', back=False, right=f'<button class="sq" aria-label="Past chats"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 7h16M4 12h16M4 17h10"/></svg></button>') + hero() +
  sec('The coach sees today') + '<div class="hs3 rv">' + ''.join(f'<span class="seec">{ib(ic).replace("class=\"ib ", "class=\"ib sm0 ")}{t}</span>' for ic, t in [('people', '9 clients'), ('injury', '2 not logged in 3 days'), ('schedule', '3 sessions today'), ('scales', '1 payment past due')]) + '</div>' +
  sec('Do it for me') + '<div class="t4 rv">' + ''.join(f'<button class="tl4">{ib(ic)}<b>{t}</b><span>{s}</span></button>' for ic, t, s in [('injury', 'Spot who has not logged', 'This week'), ('checkin', 'Draft weekly notes', 'For every client'), ('workout', 'Build a plan', 'From a client profile'), ('people', 'Message a group', 'With your wording')]) + '</div>' +
  sec('Or try asking') + '<div class="hs3 rv pr">' + ''.join(f'<button class="pc2"><span>{q}</span>{SV["chev"]}</button>' for q in ['Help me spot clients who have not logged food or workouts this week.', 'Which clients should I check in on today?', 'Summarize how my clients slept this week.']) + '</div>')
add('8 · Trainer coach home', 'The trainer\'s coach home swaps the client tools for coaching tools. The strip says what it can see across the roster, and one-tap tools act on clients, not on yourself. These prompts come from your trainer prompt list.', tcoach, C.composer() + C.drawer(False), a=None)
reply = (C.CONV + '<div class="bub rv">Help me spot clients who have not logged food or workouts this week.</div>' + f'<div class="reply rv">{C.coachtag()}<h3>Two clients have gone quiet</h3><p>Maya and Sam have not logged since Monday. Dev logged, but his sleep averages 5.4 hours.</p>'
  '<div class="card flat" style="padding:4px 14px"><div>' + ''.join(f'<div class="cl">{av(i)}<div class="grow"><b>{n}</b><span class="s">{s}</span></div>{pill(t, "n")}</div>' for i, n, s, t in [('MC', 'Maya Chen', 'No log in 3 days', 'Check in'), ('SO', 'Sam Ortiz', 'No log in 4 days', 'Check in'), ('DP', 'Dev Patel', 'Sleep averaging 5.4 h', 'Watch')]) + '</div></div></div>'
  '<div class="card rv" style="gap:10px"><div style="display:flex;align-items:center;gap:10px">' + pill('Ready to send') + '<span class="sm mut">Needs your OK</span></div><b style="font-size:16px">Message Maya and Sam: "Hey, how is this week going? Want to log a quick check-in?"</b><div style="display:flex;gap:8px"><button class="btn gh sm2" style="flex:1">Edit</button><button class="btn sm2" style="flex:1.4">Review</button></div></div>')
add('9 · Trainer coach reply', 'The reply lists the clients with a plain reason and an action, then proposes one message to two people. Nothing is sent until the trainer reviews it.', reply, C.composer(), a=None)

build('missing-screens.html', 'Coach Connect Missing Screens', '', 'Missing screens',
      'Screens that were in your old set or your app but were not yet in the new system: role choice, standalone logging, mood, weekly momentum, the spreadsheet editor and the trainer AI coach. Tap the tiles, set rows and cells.',
      S, lots=('robot',), extra_js=JS, extra_css=CSS)
