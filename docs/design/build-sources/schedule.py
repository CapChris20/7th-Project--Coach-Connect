from kit import *

CSS2 = r'''
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.gl3{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.wk7{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.wk7 button{min-height:66px;border:3px solid var(--bd);border-radius:8px;background:var(--chip);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-weight:800;font-size:12px;color:var(--mut);cursor:pointer;padding:0}
.wk7 button b{font-size:18px;color:var(--ink);font-variant-numeric:tabular-nums}
.wk7 button i{width:8px;height:8px;border-radius:50%;border:2px solid var(--bd);display:block}
.wk7 button.has i{background:var(--blk)}
.wk7 button.on{background:var(--blk);color:var(--on);box-shadow:3px 3px 0 var(--sh)}.wk7 button.on b{color:var(--on)}
.wk7 button.on i{border-color:var(--on)}.wk7 button.on.has i{background:var(--on)}
.mo{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.mo .h{font-size:12px;font-weight:900;color:var(--mut);text-align:center;padding:2px 0}
.mo button{min-height:44px;border:2.5px solid var(--bd);border-radius:6px;background:var(--chip);font-weight:800;font-size:15px;color:var(--ink);cursor:pointer;padding:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-variant-numeric:tabular-nums}
.mo button.off{border-style:dashed;color:var(--mut);opacity:.7}
.mo button.has::after{content:"";width:6px;height:6px;border-radius:50%;background:var(--blk)}
.mo button.on{background:var(--blk);color:var(--on);box-shadow:3px 3px 0 var(--sh)}.mo button.on.has::after{background:var(--on)}
.mo button.today{border-width:4px}
.card.ss,.ss{display:flex;flex-direction:row;gap:12px;align-items:stretch}
.ss .tm{width:68px;flex:none;display:flex;flex-direction:column;gap:2px;padding-right:12px;border-right:3px solid var(--bd);justify-content:center}
.ss .tm b{font-size:18px;font-variant-numeric:tabular-nums;line-height:1.05}.ss .tm span{font-size:12px;color:var(--mut);font-weight:700}
.ss .bd{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.ss .bd .tp{display:flex;align-items:center;gap:10px}
.ss .bd .tp b{font-size:16px;display:block;line-height:1.2}.ss .bd .tp span.s{font-size:13px;color:var(--mut)}
.ss .bd .ft{display:flex;gap:8px;flex-wrap:wrap}
.mini{display:inline-flex;align-items:center;height:26px;padding:0 8px;border:2.5px solid var(--bd);border-radius:6px;font-size:12px;font-weight:900;background:var(--soft);white-space:nowrap}
.st2{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border:2.5px solid var(--bd);border-radius:999px;font-size:12px;font-weight:900;white-space:nowrap}
.st2.c{background:var(--blk);color:var(--on)}.st2.p{background:transparent;border-style:dashed}.st2.d{background:var(--soft);text-decoration:line-through}
.slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.slots .chip{justify-content:center;padding:0 6px}
.seg.sx{overflow-x:auto;scrollbar-width:none}.seg.sx::-webkit-scrollbar{display:none}.seg.sx button{flex:none;padding:0 16px}
.mh{display:flex;align-items:center;gap:10px}
.mh .mid{flex:1;text-align:center}.mh .mid b{font-size:19px}
.bnav{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd);z-index:4}
.bnav .btn{flex:1}
.dgl{font-size:13px;font-weight:900;letter-spacing:.5px;color:var(--ink);padding:4px 0}
'''
JS2 = r'''
HOOKS.push(function(ph){
 $$('.wk7',ph).forEach(w=>w.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$$('button',w).forEach(x=>x.classList.remove('on'));b.classList.add('on');if(window.gsap&&!RM)gsap.fromTo(b,{scale:.88},{scale:1,duration:.4,ease:'back.out(3)'})}));
 $$('.mo',ph).forEach(w=>w.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.classList.contains('h'))return;$$('button',w).forEach(x=>x.classList.remove('on'));b.classList.add('on')}));
});
'''
def sess(time, ap, mins, ini, name, title, where, status, note='', who=True):
    st = {'Confirmed': 'c', 'Pending': 'p', 'Declined': 'd'}[status]
    return (f'<div class="card ss rv"><div class="tm"><b>{time}</b><span>{ap}</span><span>{mins} min</span></div><div class="bd"><div class="tp">{av(ini)}<div style="min-width:0"><b>{name}</b><span class="s">{title}</span></div></div>'
            f'<div class="ft"><span class="st2 {st}">{status}</span><span class="mini">{where}</span></div>' + (f'<p class="sm mut">{note}</p>' if note else '') + '</div></div>')

W = [('S', 9, 0), ('M', 10, 1), ('T', 11, 0), ('W', 12, 1), ('T', 13, 1), ('F', 14, 1), ('S', 15, 0)]
def strip(): return '<div class="wk7 rv">' + ''.join(f'<button class="{"on" if n == 13 else ""} {"has" if h else ""}">{l}<b>{n}</b><i></i></button>' for l, n, h in W) + '</div>'
def month_hdr():
    return '<div class="mh rv"><button class="sq" aria-label="Previous month">' + SV['back'] + '</button><div class="mid"><b>November 2025</b></div><button class="sq" aria-label="Next month">' + SV['chev'] + '</button></div>'
SEGCAL = lambda a: '<div class="seg rv" data-nopick><button aria-pressed="%s">Calendar</button><button aria-pressed="%s">List</button></div>' % (('true', 'false') if a == 'c' else ('false', 'true'))

S = []
def add(t, n, body, extra='', a='home', lab='', second=False):
    S.append(screen(t, n, body, (dock(a) if a else '') + extra, lab=lab, second=second))

# 1 calendar pair
def cal(data=True):
    h = top('Trainer scheduling', back=False, right=f'<button class="sq" aria-label="New session">{SV["plus"]}</button>')
    if not data:
        return (h + SEGCAL('c') + month_hdr() + '<div class="wk7 rv">' + ''.join(f'<button class="{"on" if n == 13 else ""}">{l}<b>{n}</b><i></i></button>' for l, n, _ in W) + '</div>'
                '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('schedule', 'lg') + '<h1>Schedule your first session.</h1><p class="mut">Tap a day on the calendar to see sessions. Add one and your client gets an invite.</p><button class="btn">New session</button></div>')
    return (h + SEGCAL('c') + month_hdr() + strip() + '<div style="display:flex;justify-content:space-between;align-items:center" class="rv"><span class="dgl">Thursday, Nov 13</span><button class="chip sm3" style="font-size:13px;padding:0 12px" data-open="x">Month view</button></div>'
            + sess('12:15', 'PM', 30, 'DP', 'Dev Patel', 'Check-in call', 'Video link attached', 'Confirmed')
            + sess('6:30', 'PM', 60, 'AR', 'Alex Rivera', 'Lower body strength', 'In person', 'Confirmed', 'Focus on box squat depth.')
            + sess('8:00', 'PM', 45, 'PN', 'Priya Nair', 'Intro session', 'In person', 'Pending'))
add('1 · Scheduling, calendar', 'A week strip with a dot on each day that has sessions, and the chosen day\'s sessions as an agenda underneath. The month is one tap away, not the starting view. Each session says who, what, where, and whether it is confirmed.', cal(True), lab='With sessions')
add('x', 'x', cal(False), lab='Empty', second=True)

# 2 month view
cells = []
dnum = [26, 27, 28, 29, 30, 31] + list(range(1, 31)) + [1, 2, 3, 4, 5, 6]
has = {3, 5, 6, 10, 12, 13, 14, 17, 19, 20, 24, 26}
mo = '<div class="mo rv">' + ''.join(f'<span class="h">{d}</span>' for d in 'SMTWTFS') + ''.join(
    f'<button class="{"off" if (i < 6 or i >= 36) else ""} {"has" if (6 <= i < 36 and n in has) else ""} {"on" if (6 <= i < 36 and n == 13) else ""} {"today" if (6 <= i < 36 and n == 13) else ""}">{n}</button>' for i, n in enumerate(dnum[:42])) + '</div>'
mv = (top('Trainer scheduling', back=False, right=f'<button class="sq" aria-label="New session">{SV["plus"]}</button>') + SEGCAL('c') + month_hdr() + mo
      + '<div class="dgl rv">Thursday, Nov 13 · 3 sessions</div>' + sess('6:30', 'PM', 60, 'AR', 'Alex Rivera', 'Lower body strength', 'In person', 'Confirmed'))
add('2 · Month view', 'The month grid is the same calendar opened up: dots for days with sessions, the chosen day filled, today outlined heavier, and the agenda still under it.', mv)

# 3 list pair
def lst(data=True):
    h = top('Trainer scheduling', back=False, right=f'<button class="sq" aria-label="New session">{SV["plus"]}</button>')
    if not data:
        return h + SEGCAL('l') + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('schedule', 'lg') + '<h1>No upcoming sessions.</h1><p class="mut">Sessions you schedule show up here in date order.</p><button class="btn">New session</button></div>'
    return (h + SEGCAL('l') + '<div class="dgl rv">Today · Thu, Nov 13</div>' + sess('6:30', 'PM', 60, 'AR', 'Alex Rivera', 'Lower body strength', 'In person', 'Confirmed') + sess('8:00', 'PM', 45, 'PN', 'Priya Nair', 'Intro session', 'In person', 'Pending')
            + '<div class="dgl rv">Fri, Nov 14</div>' + sess('7:00', 'AM', 60, 'MC', 'Maya Chen', 'Strength', 'In person', 'Confirmed') + sess('12:15', 'PM', 30, 'DP', 'Dev Patel', 'Check-in call', 'Video link attached', 'Declined', 'Asked for Saturday instead.')
            + '<div class="dgl rv">Sat, Nov 15</div>' + sess('9:00', 'AM', 30, 'AR', 'Alex Rivera', 'Monthly check-in', 'Video link attached', 'Confirmed'))
add('3 · Scheduling, list', 'The List tab is every upcoming session in date order, with a day header. Declined sessions are struck through and carry the client\'s reason. The empty side is your No upcoming sessions.', lst(True), lab='With sessions')
add('x', 'x', lst(False), lab='Empty', second=True)

# 4 new session
slots = ['5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM']
ns = (top('New session') + '<div class="gl3 rv">Client</div><div class="chips rv" data-single data-g="cl">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if n == "Alex Rivera" else "false"}">{n}</button>' for n in ['Alex Rivera', 'Maya Chen', 'Dev Patel', 'Priya Nair']) + '</div>'
  '<div class="gl3 rv">Session</div><div class="chips rv" data-single data-g="ty">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if n == "Lower body" else "false"}">{n}</button>' for n in ['Lower body', 'Upper body', 'Full body', 'Check-in call', 'Custom']) + '</div>'
  '<div class="gl3 rv">Start time</div><div class="wk7 rv">' + ''.join(f'<button class="{"on" if n == 14 else ""}">{l}<b>{n}</b><i></i></button>' for l, n, _ in W) + '</div>'
  '<div class="slots rv" data-single data-g="sl">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if s == "6:30 PM" else "false"}">{s}</button>' for s in slots) + '</div>'
  '<div class="gl3 rv">Length</div><div class="seg rv" data-nopick><button aria-pressed="false">30</button><button aria-pressed="false">45</button><button aria-pressed="true">60</button><button aria-pressed="false">90 min</button></div>'
  '<div class="gl3 rv">Where</div><div class="seg rv" data-nopick><button aria-pressed="true">In person</button><button aria-pressed="false">Video link</button></div>'
  '<div class="fld rv"><label for="sn">Notes</label><textarea id="sn" rows="3" placeholder="Focus, equipment, what to bring">Box squat depth. Bring a resistance band.</textarea></div>'
  '<p class="sm mut rv">Alex gets: You have a new scheduled session.</p>', '<div class="bnav"><button class="btn gh" style="flex:none;width:56px;padding:0">' + SV['back'] + '</button><button class="btn">Send invite</button></div>')
S.append(screen('4 · New session', 'The form is ordered by how a trainer thinks: who, what, when, how long, where, notes. Times are tappable slots in a grid, so there is no wheel picker. Fields use your labels: Session, Start time, Length, Where.', *ns))

# 5 session detail
detail = (top('Trainer scheduling', back=False) + SEGCAL('c') + month_hdr() + strip() + sess('6:30', 'PM', 60, 'AR', 'Alex Rivera', 'Lower body strength', 'In person', 'Confirmed', 'Focus on box squat depth.'))
ds = sheet('ds', f'<div style="display:flex;gap:12px;align-items:center">{av("AR")}<div style="flex:1;min-width:0"><h2>Alex Rivera</h2><p class="sm mut">Lower body strength</p></div><span class="st2 c">Confirmed</span></div>'
  '<div class="card flat" style="padding:4px 14px"><div class="list"><div class="row" style="cursor:default;min-height:48px"><div class="grow"><b>When</b></div><b>Thu, Nov 13 · 6:30 PM</b></div><div class="row" style="cursor:default;min-height:48px"><div class="grow"><b>Length</b></div><b>60 min</b></div><div class="row" style="cursor:default;min-height:48px"><div class="grow"><b>Where</b></div><b>In person</b></div></div></div>'
  '<div class="note2" style="background:var(--soft);border:3px solid var(--bd);border-radius:2px 14px 14px 14px;padding:12px"><b style="display:block;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut)">Notes</b>Focus on box squat depth.</div>'
  '<div style="display:flex;gap:10px"><button class="btn gh" style="flex:1">Message</button><button class="btn" style="flex:1">Reschedule</button></div><button class="btn gh" data-open="del">Delete Session</button>')
dl = sheet('del', '<span class="pill g2" style="align-self:flex-start">Alex is told</span><h2>Delete Session</h2><p class="mut">Are you sure? Alex gets a note that this session was cancelled.</p><div style="display:flex;gap:10px"><button class="btn gh" data-close="del" style="flex:1">Keep it</button><button class="btn" data-close="del" style="flex:1.2">Delete</button></div>')
add('5 · Session detail', 'Tapping a session opens its details as a sheet with the three facts, the notes, and the actions. Delete Session is last.', detail, ds.replace('data-sheet="ds"', 'data-sheet="ds" data-autoopen') + dl)
add('6 · Delete session', 'The confirm uses your wording and adds what the client is told.', detail, ds + dl.replace('data-sheet="del"', 'data-sheet="del" data-autoopen'))

# 7 client sessions pair
def csess(data=True):
    h = top('My sessions', sub='With your trainer, Jordan Reyes')
    if not data:
        return h + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('schedule', 'lg') + '<h1>No upcoming sessions.</h1><p class="mut">Ask Jordan for a time and it shows up here.</p><button class="btn">Request a session</button></div>'
    pend = ('<div class="card ss rv"><div class="tm"><b>8:00</b><span>PM</span><span>45 min</span></div><div class="bd"><div class="tp">' + av('JR') + '<div style="min-width:0"><b>Your trainer</b><span class="s">Form check</span></div></div><div class="ft"><span class="st2 p">Pending</span><span class="mini">Video link attached</span></div><div style="display:flex;gap:8px"><button class="btn gh sm2" style="flex:1;padding:0 8px">Decline</button><button class="btn sm2" style="flex:1;padding:0 8px">Confirm</button></div></div></div>')
    return (h + '<div class="dgl rv">Today · Thu, Nov 13</div>' + sess('6:30', 'PM', 60, 'JR', 'Your trainer', 'Lower body strength', 'In person', 'Confirmed', 'Focus on box squat depth.') + pend
            + '<div class="dgl rv">Sat, Nov 15</div>' + sess('9:00', 'AM', 30, 'JR', 'Your trainer', 'Monthly check-in', 'Video link attached', 'Confirmed')
            + '<button class="btn gh rv">Request a session</button>')
add('7 · My sessions, client', 'A client sees the same cards. A pending one carries Confirm and Decline right on it, so replying takes one tap. The empty side is your No upcoming sessions.', csess(True), lab='With sessions', a='home')
add('x', 'x', csess(False), lab='Empty', second=True, a='home')

# 8 request
rq = (top('Request a session', sub='Open times from Jordan') + '<div class="wk7 rv">' + ''.join(f'<button class="{"on" if n == 14 else ""} {"has" if h else ""}">{l}<b>{n}</b><i></i></button>' for l, n, h in [('S', 9, 0), ('M', 10, 0), ('T', 11, 1), ('W', 12, 0), ('T', 13, 1), ('F', 14, 1), ('S', 15, 1)]) + '</div>'
  '<p class="sm mut rv">A dot means Jordan has open times that day.</p><div class="gl3 rv">Fri, Nov 14</div><div class="slots rv" data-single data-g="rs">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if s == "6:30 PM" else "false"}">{s}</button>' for s in ['7:00 AM', '12:15 PM', '5:30 PM', '6:30 PM', '7:30 PM']) + '</div>'
  '<div class="gl3 rv">Length</div><div class="seg rv" data-nopick><button aria-pressed="false">30</button><button aria-pressed="false">45</button><button aria-pressed="true">60 min</button></div>'
  '<div class="gl3 rv">Where</div><div class="seg rv" data-nopick><button aria-pressed="true">In person</button><button aria-pressed="false">Video link</button></div>'
  '<div class="fld rv"><label for="rn">Notes</label><textarea id="rn" rows="2" placeholder="Focus, equipment, what to bring">Want to check squat depth.</textarea></div><button class="btn rv">Request session</button><p class="sm mut rv">Jordan confirms or suggests another time. You are told either way.</p>')
add('8 · Request a session', 'A client asks from Jordan\'s open times: a week strip, time slots, length, where. The request says what happens next, so it never feels sent into nothing.', rq, '', a='home')

build('scheduling.html', 'Coach Connect Scheduling', '', 'Scheduling',
      'Trainer scheduling as a week strip with a day agenda, a month view, a list, a new-session form, session details and delete, plus the client side with confirm or decline and a request flow. Calendar and list show empty and filled together.',
      S, extra_js=JS2, extra_css=CSS2)
