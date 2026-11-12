from kit import *

CSS2 = r'''
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.gl3{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.tr{display:flex;align-items:center;gap:12px;min-height:76px;padding:10px 0;border-top:2px solid var(--bd);width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;cursor:pointer}
.list>.tr:first-child{border-top:0}
.tr .grow{flex:1;min-width:0}.tr .grow b{display:block;font-size:16px;line-height:1.2}.tr .grow span.s{display:block;font-size:13px;color:var(--mut);margin-top:2px}
.tr .grow .why{margin-top:6px}
.why{display:inline-flex;align-items:center;height:24px;padding:0 8px;border:2.5px solid var(--bd);border-radius:6px;font-size:12px;font-weight:900;background:var(--soft);white-space:nowrap}
.why.dash{background:transparent;border-style:dashed}
.sig{display:inline-flex;align-items:center;height:24px;padding:0 8px;border:2.5px solid var(--bd);border-radius:999px;font-size:12px;font-weight:900;white-space:nowrap}
.sig.t{background:var(--blk);color:var(--on)}
.seg.sx{overflow-x:auto;scrollbar-width:none}.seg.sx::-webkit-scrollbar{display:none}.seg.sx button{flex:none;padding:0 16px}
.dtabs{position:sticky;top:-10px;z-index:3;background:var(--bg);padding:6px 0 8px;margin:-6px 0 -4px}
.st3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.st3 div{border:3px solid var(--bd);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:3px;background:var(--chip)}
.st3 b{font-size:20px;font-variant-numeric:tabular-nums;line-height:1.1}.st3 span{font-size:12px;font-weight:800;color:var(--mut);letter-spacing:.5px;text-transform:uppercase}
.st3 em{font-style:normal;font-size:12px;font-weight:800;color:var(--mut)}
.mt{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mt div{border:3px solid var(--bd);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:4px;background:var(--chip);min-height:84px}
.mt div b{font-size:24px;letter-spacing:-.6px;line-height:1;font-variant-numeric:tabular-nums}.mt div b small{font-size:13px;color:var(--mut);letter-spacing:0;font-weight:800}
.mt div span{font-size:12px;font-weight:800;color:var(--mut);letter-spacing:.6px;text-transform:uppercase}
.mt div.no{border-style:dashed;background:transparent}.mt div.no b{font-size:14px;letter-spacing:0;color:var(--mut);line-height:1.25}
.note{background:var(--soft);border:3px solid var(--bd);border-radius:2px 14px 14px 14px;padding:12px;font-size:15px;line-height:1.45}
.note b{display:block;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);margin-bottom:4px}
.pc{display:flex;flex-direction:column;gap:8px}
.pc .t{display:flex;gap:10px;font-size:15px;line-height:1.35}
.pc .t::before{content:"";width:10px;height:10px;margin-top:6px;flex:none;border:3px solid var(--bd);background:var(--blk)}
.pc.neg .t::before{background:transparent}
.chart{width:100%;height:auto;display:block}
.chart text{font-size:12px;font-weight:700;fill:var(--mut);font-family:inherit}
.chart .gl{stroke:var(--soft);stroke-width:2}
.chart .bb{transform-box:fill-box;transform-origin:50% 100%;fill:var(--blk);stroke:var(--bd);stroke-width:3}
.chart .bb.rest{fill:transparent;stroke-dasharray:5 4}
.chart .goal{stroke:var(--ink);stroke-width:2.5;stroke-dasharray:6 5}
.ring{width:104px;height:104px;flex:none;position:relative}
.ring svg{width:104px;height:104px;transform:rotate(-90deg)}
.ring .tr2{fill:none;stroke:var(--soft);stroke-width:13}.ring .fg{fill:none;stroke:var(--blk);stroke-width:13}
.ring .c{position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1.05}
.ring .c b{font-size:22px;letter-spacing:-.5px;display:block}
.mac{display:flex;flex-direction:column;gap:5px}
.mac .t{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800}
.mac .t .im{width:20px;height:20px}.mac .t span{margin-left:auto;color:var(--mut);font-weight:700;font-variant-numeric:tabular-nums}
.mac .bar{height:12px;border-width:2.5px;border-radius:6px}
.fr{display:flex;align-items:center;gap:10px;min-height:56px;padding:8px 0;border-top:2px solid var(--bd)}
.list>.fr:first-child{border-top:0}
.fr .grow{flex:1;min-width:0}.fr .grow b{display:block;font-size:15px}.fr .grow span{font-size:13px;color:var(--mut)}
.fr .k{font-size:17px;font-weight:900;font-variant-numeric:tabular-nums}
.bnav{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd);z-index:4}
.bnav .btn{flex:1}
.rdy{display:flex;align-items:center;gap:12px;border:3px solid var(--bd);border-radius:8px;padding:12px;background:var(--blk);color:var(--on)}
.rdy.no{background:transparent;color:var(--ink);border-style:dashed}
.rdy b{display:block;font-size:16px}.rdy span{font-size:13px;opacity:.8}
'''
JS2 = r'''
HOOKS.push(function(ph){
 $$('.chart .bb',ph).forEach((b,i)=>{if(window.gsap&&!RM)gsap.from(b,{scaleY:0,duration:.6,delay:.1+i*.06,ease:'power3.out'})});
 $$('.ring .fg',ph).forEach(c=>{const r=+c.getAttribute('r'),L=2*Math.PI*r,p=+c.dataset.pct/100;c.style.strokeDasharray=L;c.style.strokeDashoffset=L*(1-p);if(window.gsap&&!RM)gsap.from(c,{strokeDashoffset:L,duration:1.1,ease:'power3.out',delay:.2})});
 const m=$('[data-scrollto]',ph);if(m)setTimeout(()=>{const s=$('.scr',ph);if(s)s.scrollTop=+m.dataset.scrollto},400);
 $$('[data-filter]',ph).forEach(c=>c.addEventListener('click',()=>{}));
});
'''
def bar_chart(vals, labels, ymax, goal, w=300, h=170):
    pl, pr, pt, pb = 30, 8, 10, 28
    iw, ih = w - pl - pr, h - pt - pb
    n = len(vals); bw = iw / n * .56
    Y = lambda v: pt + ih * (1 - v / ymax)
    s = f'<svg class="chart" viewBox="0 0 {w} {h}" role="img" aria-label="Hours slept each day">'
    for t in (0, 3, 6, 9):
        s += f'<line class="gl" x1="{pl}" x2="{w - pr}" y1="{Y(t):.1f}" y2="{Y(t):.1f}"/><text x="{pl - 6}" y="{Y(t) + 4:.1f}" text-anchor="end">{t}</text>'
    for i, v in enumerate(vals):
        x = pl + iw * (i + .5) / n - bw / 2
        if v is None:
            s += f'<rect class="bb rest" x="{x:.1f}" y="{Y(1.2):.1f}" width="{bw:.1f}" height="{ih * 1.2 / ymax:.1f}" rx="2"/>'
        else:
            s += f'<rect class="bb" x="{x:.1f}" y="{Y(v):.1f}" width="{bw:.1f}" height="{ih * v / ymax:.1f}" rx="2"/>'
        s += f'<text x="{x + bw / 2:.1f}" y="{h - 8}" text-anchor="middle">{labels[i]}</text>'
    return s + f'<line class="goal" x1="{pl}" x2="{w - pr}" y1="{Y(goal):.1f}" y2="{Y(goal):.1f}"/></svg>'
def macro(ic, n, a, b): return f'<div class="mac"><div class="t"><i class="im i-{ic}"></i>{n}<span>{a} / {b} g</span></div>{bar(round(a / b * 100) if b else 0)}</div>'
def ring(pct, big, small):
    return f'<div class="ring"><svg viewBox="0 0 104 104"><circle class="tr2" cx="52" cy="52" r="44"/><circle class="fg" cx="52" cy="52" r="44" data-pct="{pct}"/></svg><div class="c"><div><b class="num">{big}</b><span class="sm mut">{small}</span></div></div></div>'

S = []
def add(t, n, body, extra='', a='home', lab='', second=False):
    S.append(screen(t, n, body, (dock(a) if a else '') + extra, lab=lab, second=second))

# 1 trainees list pair
CL = [('AR', 'Alex Rivera', 'Build Muscle · Intermediate', 'Training', 'Logged today', False), ('MC', 'Maya Chen', 'Lose Fat · Beginner', 'Recovery', 'No log in 3 days', True), ('DP', 'Dev Patel', 'Athletic · Advanced', 'Recovery', 'Sleep avg 5.4 h', True), ('SO', 'Sam Ortiz', 'Maintain · Advanced', 'Training', 'Soreness 7 of 8', True), ('LK', 'Lena Kim', 'Build Habits · Beginner', 'Training', 'Logged today', False)]
def row(ini, nm, sub, sig, why, att):
    return f'<button class="tr">{av(ini)}<div class="grow"><b>{nm}</b><span class="s">{sub}</span><span class="why{" dash" if not att else ""}">{why}</span></div><span class="sig{" t" if sig == "Training" else ""}">{sig}</span></button>'
def trainees(data=True):
    h = top('Clients', back=False, right=f'<button class="sq" aria-label="Invite client">{SV["plus"]}</button>')
    req = f'<button class="row rv" style="border:3px solid var(--bd);border-radius:10px;padding:8px 12px;background:var(--sf);min-height:60px">{ib("people")}<div class="grow"><b>View client requests</b><span>Priya N., Sam O.</span></div><span class="badge" style="min-width:26px;height:26px;padding:0 7px;border:3px solid var(--bd);border-radius:999px;background:var(--blk);color:var(--on);display:grid;place-items:center;font-size:13px;font-weight:900">2</span></button>'
    if not data:
        return h + req.replace('<span class="badge"', '<span style="display:none"') + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('people', 'lg') + '<h1>No clients yet</h1><p class="mut">Clients you already train join with your invite code. New clients find you in the marketplace.</p><div style="font-family:ui-monospace,Menlo,monospace;font-weight:900;font-size:26px;letter-spacing:3px;border:3px solid var(--bd);border-radius:8px;padding:10px 12px;background:var(--sf)">COACH-7K2F</div><button class="btn">Copy code</button></div>'
    return (h + '<div class="fld rv"><input aria-label="Search clients" placeholder="Search clients"></div>' + req
            + '<div class="chips rv" data-single data-g="f">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if f == "All" else "false"}">{f}</button>' for f in ['All', 'Needs attention', 'Training', 'Recovery']) + '</div>'
            + '<div class="card rv" style="padding:4px 14px"><div class="list">' + ''.join(row(*c) for c in CL) + '</div></div><button class="btn gh rv">Load more clients</button>')
add('1 · Clients', 'The roster is a list with one reason per client, the thing that needs attention, so the first glance is who to look at. A black Training or outlined Recovery pill says what phase they are in. Client requests sit on top. The empty side shows the invite code.', trainees(True), lab='With clients')
add('x', 'x', trainees(False), lab='Empty', second=True)

# 2 client detail
def head(sub='Intermediate · Build Muscle'):
    return top('Alex Rivera', sub=sub, right=f'<button class="sq" data-open="rm" aria-label="Manage client"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="3" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="17" y="10" width="4" height="4"/></svg></button>')
def dtabs(a):
    return '<div class="dtabs"><div class="seg sx rv" data-tabs="ct">' + ''.join(f'<button data-t="{k}" aria-pressed="{"true" if k == a else "false"}">{n}</button>' for k, n in [('p', 'Progress'), ('n', 'Nutrition'), ('s', 'Sessions'), ('f', 'Notes & Files')]) + '</div></div>'
def pan(k, a, html): return f'<div data-p="ct:{k}" {"" if k == a else "hidden"} style="display:flex;flex-direction:column;gap:16px">{html}</div>'

progress = (
  '<div class="st3 rv"><div><span>Weight</span><b>172 lb</b><em>−1.4 in 8 wks</em></div><div><span>Height</span><b>5\'11"</b><em>Profile</em></div><div style="border-style:dashed;background:transparent"><span>Body fat</span><b style="font-size:14px;color:var(--mut)">No baseline yet</b><em>Add one</em></div></div>'
  + sec('Daily metrics', '<span>Today</span>') +
  '<div class="mt rv"><div><span>Sleep</span><b>7.5<small> h</small></b></div><div><span>Water</span><b>5<small> cups</small></b></div><div><span>Energy / 8</span><b>6</b></div><div><span>Soreness / 8</span><b>3</b></div><div class="no"><span>Stress / 8</span><b>No check-in yet today</b></div><div><span>Mood / 4</span><b>3</b></div></div>'
  '<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px">' + ib('workout') + '<div style="flex:1;min-width:0"><span class="gl3">Today\'s workout</span><b style="display:block;font-size:17px">Lower body strength</b><p class="sm mut">Rated 8 of 10 · Trainer notified</p></div></div>'
  '<div class="note rv"><b>Client note</b>Knee felt tight on the second set of squats, fine after warm-up.</div>'
  + sec('Trainer notes', pill('From Trainer', 'n')) + '<div class="fld rv"><textarea rows="3" aria-label="Trainer notes">Keep squats pain-free: box to parallel. Add 5 lb to RDL next week.</textarea></div><button class="btn rv">Save note</button>')
nutri = (
  '<div class="card rv" style="flex-direction:row;gap:14px;align-items:center">' + ring(71, '1,640', 'of 2,300') + f'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:9px">{macro("protein", "Protein", 118, 170)}{macro("carbs", "Carbs", 160, 250)}{macro("fats", "Fats", 48, 70)}</div></div>'
  + sec('Micronutrients', '<span>When logged</span>') + '<div class="card rv" style="padding:4px 14px"><div class="list">' + ''.join(f'<div class="fr"><div class="grow"><b>{n}</b></div><span class="k">{v}</span></div>' for n, v in [('Fiber', '22 g'), ('Sugar', '48 g'), ('Sodium', '1,840 mg'), ('Potassium', '2,600 mg')]) + '</div></div>'
  + sec('Foods logged today', '<span>4 items</span>') + '<div class="card rv" style="padding:4px 14px"><div class="list">' + ''.join(f'<div class="fr"><div class="grow"><b>{n}</b><span>{m}</span></div><span class="k">{k}</span></div>' for n, m, k in [('Greek yogurt bowl', 'Breakfast', '380'), ('Chicken rice bowl', 'Lunch', '720'), ('Almond milk', 'Lunch', '40'), ('Protein shake', 'Snack', '500')]) + '</div></div>')
nutri_empty = '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('protein', 'lg') + '<h1>No nutrition logged yet</h1><p class="mut">When your client tracks meals in the app, their daily intake shows up here automatically.</p><button class="btn gh">Remind Alex to log</button></div>'
sess = ('<div class="card rv" style="padding:4px 14px"><div class="list">' + ''.join(f'<div class="fr">{ib("schedule")}<div class="grow"><b>{a}</b><span>{b}</span></div>{c}</div>' for a, b, c in [('Today · 6:30 PM', 'Lower body · 60 min', pill('Up next')), ('Fri · 6:30 PM', 'Upper body · 60 min', ''), ('Sat · 9:00 AM', 'Monthly check-in · video', '')]) + '</div></div><button class="btn gh rv">Schedule a session</button>')
files = ('<div class="card rv" style="padding:4px 14px"><div class="list">' + ''.join(f'<button class="row">{ib(ic)}<div class="grow"><b>{a}</b><span>{b}</span></div>{SV["chev"]}</button>' for ic, a, b in [('week', 'Week 3 program', 'Spreadsheet · shared by you'), ('workout', 'Custom Workout Plan', 'Plan · 4 days'), ('checkin', 'Intake form', 'Document · shared by you'), ('picture', 'Squat video, Wed', 'Uploaded by Alex')]) + '</div></div>')
def detail(a='p', nut_empty=False):
    return head() + dtabs(a) + pan('p', a, progress) + pan('n', a, nutri_empty if nut_empty else nutri) + pan('s', a, sess) + pan('f', a, files)
add('2 · Client, progress', 'A client opens on four tabs. Progress leads with weight, height and body fat, then the six daily metrics. A metric nobody logged says so, and a missing body fat says No baseline yet. Your notes are written right on the page.', detail('p'), a=None)
add('3 · Client, nutrition', 'Nutrition is calories as a ring, protein, carbs and fat, then micronutrients and the foods logged today. The empty side is your No nutrition logged yet.', detail('n'), a=None, lab='With data')
add('x', 'x', detail('n', True), a=None, lab='Nothing logged', second=True)
add('4 · Client, notes and files', 'The last tab lists what you have shared and what they uploaded, including the spreadsheet and custom workout plan.', detail('f'), a=None)

# 5 weekly report pair
def wreport(ready=True):
    h = top('Weekly report', sub='Alex Rivera · Nov 10 to 16')
    if not ready:
        return h + '<div class="rdy no rv"><span style="width:12px;height:12px;border:3px solid var(--bd);border-radius:50%;flex:none;border-style:dashed"></span><div><b>Report not ready yet</b><span>Reports appear after check-ins and the weekly summary job.</span></div>' + pill('Not ready', 'n') + '</div><div class="card emp sq0 rv" style="gap:8px"><p class="mut">Recap appears here after your weekly summary runs. Keep logging daily for sharper trends next week.</p></div>'
    return (h + '<div class="rdy rv"><span style="width:12px;height:12px;background:var(--on);border-radius:50%;flex:none"></span><div style="flex:1;min-width:0"><b>Week in review</b><span>Updated automatically after check-ins each week</span></div>' + pill('Ready') + '</div>'
        + sec('Week averages') + '<div class="mt rv"><div><span>Avg sleep</span><b>6.9<small> h</small></b></div><div><span>Avg water</span><b>5.6<small> cups</small></b></div><div><span>Avg energy</span><b>6.2<small> / 8</small></b></div><div><span>Avg steps</span><b>7,150</b></div></div>'
        + sec('Weekly trends', '<span>Sleep rhythm</span>') + '<div class="card rv">' + bar_chart([7.5, None, 6.2, 5.8, 7.0, 7.4, 6.4], ['M', 'T', 'W', 'T', 'F', 'S', 'S'], 9, 8) + '<p class="sm mut">Seven-day breakdown from their daily check-ins. Dashed line is 8 hours.</p></div>'
        + sec('What went well', pill('Wins', 'n')) + '<div class="card rv"><div class="pc"><div class="t">Added 10 lb to box squat.</div><div class="t">Protein hit target 5 days.</div></div></div>'
        + sec('Coaching priorities', '<span>Your focus</span>') + '<div class="card flat rv"><div class="pc"><div class="t">Sleep: four nights under 7 hours.</div><div class="t">No workout logged Friday.</div></div><button class="btn gh sm2" style="width:auto;align-self:flex-start;padding:0 14px">' + SV['plus'] + ' Add a priority</button></div>'
        + sec('Sign-off') + '<div class="fld rv"><textarea rows="3" aria-label="Sign-off">Strong week, Alex. Get to bed earlier and we keep adding weight.</textarea></div>'
        '<p class="sm mut rv">Generated from logged check-ins (no AI). Keep logging daily for sharper trends next week.</p>'
        '<button class="btn rv">Send to Alex</button><button class="btn gh rv">Open weekly report</button>')
add('5 · Weekly report, trainer', 'The trainer\'s version of the report is auto-built from check-ins, then edited: a Ready state, four averages, a sleep chart, wins, priorities you can add to, and a sign-off. The not-ready side is your Report not ready yet.', wreport(True), a=None, lab='Ready')
add('x', 'x', wreport(False), a=None, lab='Not ready', second=True)

# 6 remove
rm = sheet('rm', '<span class="pill g2" style="align-self:flex-start">Unlinks Alex</span><h2>Remove client?</h2><p class="mut">They will be unlinked from you in Coach Connect. You can invite them again later if you change your mind.</p><div class="card flat" style="padding:4px 14px"><div class="list"><div class="row" style="cursor:default;min-height:48px"><div class="grow"><b>Plans and notes</b></div><span class="mut">Kept</span></div><div class="row" style="cursor:default;min-height:48px"><div class="grow"><b>New logs</b></div><span class="mut">Stop</span></div><div class="row" style="cursor:default;min-height:48px"><div class="grow"><b>Billing</b></div><span class="mut">Stops</span></div></div></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="rm" style="flex:1">Cancel</button><button class="btn" data-close="rm" style="flex:1.4">Remove from roster</button></div>')
add('6 · Remove client', 'Removing a client says what happens to plans, logs and billing, so the trainer is not guessing. Cancel is first.', detail('p'), rm.replace('data-sheet="rm"', 'data-sheet="rm" data-autoopen'), a=None)
add('7 · Client removed', 'After removing, the page confirms in one line and returns to the roster.', top('Clients', back=False) + '<div class="card blk rv" style="gap:6px"><b style="font-size:18px">Client removed</b><p style="opacity:.85">Alex is no longer on your roster. You can invite them again with your code.</p></div><div class="card rv" style="padding:4px 14px"><div class="list">' + ''.join(row(*c) for c in CL[1:]) + '</div></div>')

build('trainees-and-records.html', 'Coach Connect Trainees and Records', '', 'Trainees and records',
      'The trainer roster and a full client record: four tabs for progress, nutrition, sessions and notes and files, the auto-built weekly report you sign off, and removing a client. The roster, nutrition and report show empty or not-ready states next to the filled ones.',
      S, extra_js=JS2, extra_css=CSS2)
