from kit import *

CSS2 = r'''
.quote{display:grid;grid-template-columns:1fr 84px;gap:8px;align-items:center;background:var(--blk);color:var(--on);border:3px solid var(--bd);border-radius:6px 24px 6px 6px;box-shadow:6px 6px 0 var(--sh);padding:14px 12px 14px 16px;min-height:130px}
.quote p{font-size:17px;line-height:1.3;font-weight:800;letter-spacing:-.2px}
.quote small{display:block;margin-top:8px;font-size:12px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;opacity:.7}
.quote .lot{width:84px;height:84px}
.hi{display:flex;align-items:center;gap:12px}
.hi .grow{flex:1;min-width:0}.hi small{display:block;color:var(--mut);font-size:13px}.hi b{font-size:19px;letter-spacing:-.3px}
.need{border-radius:6px;overflow:hidden;padding:0;gap:0}
.need .blockr{background:var(--blk);color:var(--on);padding:14px;display:flex;flex-direction:column;gap:10px}
.need .blockr .btn{background:var(--on);color:var(--blk);border-color:var(--on);box-shadow:none}
.need .row{padding:10px 14px;border-top:2px solid var(--bd)}
.cnt{min-width:30px;height:30px;padding:0 8px;border:3px solid var(--bd);border-radius:999px;display:grid;place-items:center;font-weight:900;font-size:14px;background:var(--blk);color:var(--on);flex:none}
.hs3{display:flex;gap:12px;overflow-x:auto;margin:0 -16px;padding:2px 16px 12px;scrollbar-width:none;scroll-snap-type:x mandatory;scroll-padding:0 16px}
.hs3::-webkit-scrollbar{display:none}
.chip.cc{flex:none;width:196px;min-height:168px;scroll-snap-align:start;display:flex;flex-direction:column;align-items:flex-start;gap:8px;white-space:normal;border-radius:10px;padding:12px;text-align:left;font-size:15px;line-height:1.2;box-shadow:4px 4px 0 var(--sh)}
.chip.cc:nth-child(even){border-radius:10px 26px 10px 10px}
.chip.cc[aria-pressed="true"]{box-shadow:4px 4px 0 var(--sh)}
.cc .top2{display:flex;align-items:center;gap:10px;width:100%}
.cc .top2 b{font-size:16px;display:block}.cc .top2 span.s{font-size:12px;font-weight:700;opacity:.75}
.cc .why{display:inline-flex;align-items:center;height:26px;padding:0 8px;border:2.5px solid currentColor;border-radius:6px;font-size:12px;font-weight:900;background:transparent;white-space:nowrap}
.cc .st{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%}
.cc .st div{border:2.5px solid currentColor;border-radius:6px;padding:4px 6px;font-size:12px;font-weight:800;line-height:1.15}
.cc .st div b{display:block;font-size:15px}
.cc[aria-pressed="true"] .av{border-color:var(--on)}
.seg.sx{overflow-x:auto;scrollbar-width:none}.seg.sx::-webkit-scrollbar{display:none}.seg.sx button{flex:none;padding:0 16px}
.rd{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 0;border-top:2px solid var(--bd)}
.rd:first-child{border-top:0}
.rd .grow{flex:1;min-width:0}.rd .grow span{display:block;font-size:13px;color:var(--mut)}.rd .grow b{font-size:15px}
.rd .v{font-size:20px;text-align:right;white-space:nowrap}
.rd .v small{font-size:13px;color:var(--mut);letter-spacing:0;font-weight:800}
.rd.no .v{font-size:13px;color:var(--mut);letter-spacing:0}
.spk{display:flex;align-items:flex-end;gap:3px;height:26px}
.spk i{width:6px;border:2px solid var(--bd);background:var(--blk);display:block}
.ring{width:96px;height:96px;flex:none;position:relative}
.ring svg{width:96px;height:96px;transform:rotate(-90deg)}
.ring .tr{fill:none;stroke:var(--soft);stroke-width:12}.ring .fg{fill:none;stroke:var(--blk);stroke-width:12}
.ring .c{position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1.05}
.ring .c b{font-size:20px;letter-spacing:-.5px}
.mac{display:flex;flex-direction:column;gap:5px}
.mac .t{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800}
.mac .t .im{width:20px;height:20px}.mac .t span{margin-left:auto;color:var(--mut);font-weight:700;font-variant-numeric:tabular-nums}
.mac .bar{height:12px;border-width:2.5px;border-radius:6px}
.tools{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tools .chip.tile{min-height:92px;box-shadow:3px 3px 0 var(--sh)}
.blk2{background:var(--blk);color:var(--on);border:3px solid var(--bd);border-radius:6px 24px 6px 6px;box-shadow:6px 6px 0 var(--sh);padding:16px;display:flex;flex-direction:column;gap:6px}
.blk2 .eyb{color:var(--on);opacity:.7}
.wr{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.wr div{border:3px solid var(--bd);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;background:var(--chip)}
.wr div b{font-size:24px;letter-spacing:-.6px;line-height:1}.wr div span{font-size:12px;font-weight:800;color:var(--mut);letter-spacing:.6px;text-transform:uppercase}
.note{background:var(--soft);border:3px solid var(--bd);border-radius:2px 14px 14px 14px;padding:12px;font-size:15px;line-height:1.4}
.note b{display:block;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);margin-bottom:4px}
.cap2{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
'''
JS2 = r'''
HOOKS.push(function(ph){
 $$('.ring .fg',ph).forEach(c=>{const r=+c.getAttribute('r'),L=2*Math.PI*r,p=+c.dataset.pct/100;c.style.strokeDasharray=L;c.style.strokeDashoffset=L*(1-p);
  if(window.gsap&&!RM)gsap.from(c,{strokeDashoffset:L,duration:1.1,ease:'power3.out',delay:.2})});
 ph.addEventListener('click',e=>{const c=e.target.closest('.chip.cc');if(c){const n=c.dataset.name;$$('[data-selname]',ph).forEach(x=>x.textContent=n)}});
 const m=$('[data-scrollto]',ph);if(m)setTimeout(()=>{const s=$('.scr',ph);if(s)s.scrollTop=+m.dataset.scrollto},400);
});
'''

def spk(vals): return '<div class="spk">' + ''.join(f'<i style="height:{max(4, int(v * 22))}px"></i>' for v in vals) + '</div>'
def rd(ic, lab, sub, val, small='', vals=None, no=False):
    right = f'<span class="num v">{val}<small>{small}</small></span>' if not no else f'<span class="v">{val}</span>'
    return f'<div class="rd{" no" if no else ""}">{ib(ic)}<div class="grow"><b>{lab}</b><span>{sub}</span></div>{spk(vals) if vals else ""}{right}</div>'
def macro(ic, n, a, b):
    return f'<div class="mac"><div class="t"><i class="im i-{ic}"></i>{n}<span>{a} / {b} g</span></div>{bar(round(a / b * 100))}</div>'

def header():
    return (f'<div class="hi rv">{av("JR")}<div class="grow"><small>Thursday evening</small><b>Good evening, Jordan</b></div><button class="sq" aria-label="Notifications">{SV["bell"]}</button></div>'
     '<div class="quote rv"><div><p>Exercise is king. Nutrition is queen. Put them together and you have got a kingdom.</p><small>Daily motivation</small></div><div class="lot" data-l="zboxer"></div></div>')

def needs():
    return (sec('Needs you', '<span class="cnt">4</span>') +
     f'<div class="card need rv"><div class="blockr"><b style="font-size:17px">Complete payout setup to accept clients</b><p class="sm" style="opacity:.8">Two new requests are waiting on this.</p><button class="btn" data-open="payout">Set up payouts</button></div>'
     f'<button class="row">{ib("journey")}<div class="grow"><b>2 new client requests</b><span>Priya N., Sam O.</span></div><span class="cnt">2</span></button>'
     f'<button class="row">{ib("injury")}<div class="grow"><b>Maya needs your help</b><span>Check her workout progress</span></div>{SV["chev"]}</button>'
     f'<button class="row">{ib("people")}<div class="grow"><b>New client message</b><span>Dev P. · 12 min ago</span></div>{SV["chev"]}</button></div>')

CL = [('AR', 'Alex Rivera', 'Build Muscle', 'Intermediate', 'Logged today', '7.5 h', '6,420'),
      ('MC', 'Maya Chen', 'Lose Fat', 'Beginner', 'No log in 3 days', '6.1 h', '2,880'),
      ('DP', 'Dev Patel', 'Athletic', 'Advanced', 'Sleep avg 5.4 h', '5.4 h', '9,150'),
      ('SO', 'Sam Ortiz', 'Maintain', 'Advanced', 'Soreness 7 of 8', '7.0 h', '7,400')]
def carousel():
    cards = ''
    for i, (ini, nm, goal, lvl, why, sl, st) in enumerate(CL):
        cards += (f'<button class="chip cc" data-name="{nm}" aria-pressed="{"true" if i == 0 else "false"}"><div class="top2">{av(ini)}<div style="min-width:0"><b>{nm}</b><span class="s">{goal} · {lvl}</span></div></div>'
                  f'<span class="why">{why}</span><div class="st"><div>Sleep<b>{sl}</b></div><div>Steps<b>{st}</b></div></div></button>')
    return sec('Your clients', f'<span>{len(CL)} of 9 · swipe</span>') + f'<div class="hs3 rv" data-single>{cards}</div>'

def tabs(tab):
    return ('<div class="seg sx rv" data-tabs="ct">' + ''.join(f'<button data-t="{k}" aria-pressed="{"true" if k == tab else "false"}">{n}</button>' for k, n in [('p', 'Progress'), ('n', 'Nutrition'), ('s', 'Sessions'), ('f', 'Notes & Files')]) + '</div>')
def pan(k, tab, html): return f'<div data-p="ct:{k}" {"" if k == tab else "hidden"} style="display:flex;flex-direction:column;gap:16px">{html}</div>'

progress = ('<div class="card rv"><div class="list">'
  + rd('sleeping', 'Sleep hours', 'Last 7 nights', '7.5', ' h', [.7, .75, .6, .8, .7, .65, .75])
  + rd('workout', 'Steps today', 'Goal 8,000', '6,420')
  + rd('hydration', 'Water intake', 'Goal 8 cups', '5', ' cups')
  + rd('energy', 'Energy level', 'Rated this morning', '6', ' / 8')
  + rd('injury', 'Soreness level', 'Left knee noted', '3', ' / 8')
  + rd('stress', 'Stress level', 'Stress not logged yet', 'Remind', no=True)
  + '</div></div>'
  f'<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px">{ib("dumbbells")}<div style="flex:1;min-width:0"><b>Lower body strength</b><p class="sm mut">Yesterday · rated 8 of 10</p></div>{pill("Trainer notified", "n")}</div>'
  f'<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px">{ib("picture")}<div style="flex:1;min-width:0"><b>Progress photos</b><p class="sm mut">3 new this month</p></div>{SV["chev"]}</div>')
nutri = ('<div class="card rv" style="flex-direction:row;gap:14px;align-items:center"><div class="ring"><svg viewBox="0 0 96 96"><circle class="tr" cx="48" cy="48" r="40"/><circle class="fg" cx="48" cy="48" r="40" data-pct="71"/></svg><div class="c"><div><b class="num">1,640</b><div class="sm mut">of 2,300</div></div></div></div>'
  f'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:9px">{macro("protein", "Protein", 118, 170)}{macro("carbs", "Carbs", 160, 250)}{macro("fats", "Fats", 48, 70)}</div></div>'
  '<div class="card rv"><div class="list">'
  + ''.join(f'<div class="row" style="cursor:default">{ib(ic)}<div class="grow"><b>{n}</b><span>{s}</span></div><b class="num" style="font-size:17px">{k}</b></div>' for ic, n, s, k in [('protein', 'Greek yogurt bowl', 'Breakfast', '380'), ('carbs', 'Chicken rice bowl', 'Lunch', '720'), ('fats', 'Protein shake', 'Snack', '540')])
  + '<div class="row" style="cursor:default;min-height:52px"><div class="grow"><b style="color:var(--mut)">Dinner</b><span>No meals logged yet</span></div></div></div></div>')
sess = ('<div class="card rv"><div class="list">' + ''.join(f'<div class="row" style="cursor:default">{ib("schedule")}<div class="grow"><b>{a}</b><span>{b}</span></div>{c}</div>' for a, b, c in [('Today · 6:30 PM', 'Lower body · 60 min', pill('Up next')), ('Fri · 6:30 PM', 'Upper body · 60 min', ''), ('Mon · 6:30 PM', 'Lower body · 60 min', '')]) + '</div></div>'
        '<button class="btn gh rv">Schedule a session</button>')
files = ('<div class="card rv"><div class="list">' + ''.join(f'<button class="row">{ib(ic)}<div class="grow"><b>{a}</b><span>{b}</span></div>{SV["chev"]}</button>' for ic, a, b in [('checkin', 'Intake form', 'Document · shared by you'), ('week', 'Week 3 program', 'Spreadsheet · shared by you'), ('picture', 'Squat video, Wed', 'Uploaded by Alex')]) + '</div></div>'
         '<div class="note rv"><b>Note from Alex</b>Knee felt tight on the second set of squats, fine after warm-up.</div>')

def client_panel(tab):
    return (f'<div class="eyb rv"><span><span data-selname>Alex Rivera</span> · today</span></div>' + tabs(tab) + pan('p', tab, progress) + pan('n', tab, nutri) + pan('s', tab, sess) + pan('f', tab, files))

def tools():
    return (sec('Tools') + '<div class="tools rv" data-nopick>' + ''.join(f'<button class="chip tile" aria-pressed="false" {x}>{ib(ic)}<span>{t}</span></button>' for ic, t, x in
        [('workout', 'Workout plans', ''), ('people', 'Messages', ''), ('checkin', 'Document maker', 'data-open="create"'), ('week', 'Spreadsheet creator', 'data-open="create"'), ('picture', 'Progress photos', ''), ('journey', 'Client notes & files', '')]) + '</div>')

def weekly():
    return (sec('Weekly report', '<button class="chip sm3" style="font-size:13px;padding:0 12px">Open report</button>') +
     '<div class="card rv" style="gap:12px"><div class="wr"><div><b data-count="14">14</b><span>Sessions done</span></div><div><b>7 / 9</b><span>Clients logged</span></div><div><b>142 g</b><span>Avg protein</span></div><div><b>6.7 h</b><span>Avg sleep</span></div></div>'
     f'<div class="mac"><div class="t"><span class="cap2" style="margin:0">Plan adherence</span><span>82%</span></div>{bar(82)}</div></div>')

def home(tab='p', scroll=0, sheets='', carousel_on=True):
    mk = f'<div data-scrollto="{scroll}" hidden></div>' if scroll else ''
    return mk + header() + needs() + carousel() + client_panel(tab) + tools() + weekly()

S = []
DK = lambda a='home': dock(a)
def add(t, n, body, extra='', a='home'): S.append(screen(t, n, body, dock(a) + extra))
def auto(s, n): return s.replace(f'data-sheet="{n}"', f'data-sheet="{n}" data-autoopen')

payout = sheet('payout', f'<span class="pill {g()}" style="align-self:flex-start">Payout verification in progress</span><h2>Finish payout setup</h2><p class="mut">You need this to accept clients and get paid for sessions.</p>'
  '<div class="tl"><div class="st"><span class="n">' + SV['check'] + '</span><div><b>Identity</b><span>Verified</span></div></div><div class="st"><span class="n">' + SV['check'] + '</span><div><b>Bank account</b><span>Added</span></div></div><div class="st cur"><span class="n">3</span><div><b>Verification</b><span>Under review. Try Refresh status in a minute.</span></div></div></div>'
  '<div style="display:flex;gap:10px"><button class="btn gh" data-close="payout" style="flex:1">Refresh status</button><button class="btn" data-close="payout" style="flex:1.2">Finish setup</button></div>')
create = sheet('create', '<h2>Create something</h2><div class="eyb"><span>Document maker</span></div><div class="list"><button class="row">' + ib('checkin') + '<div class="grow"><b>Rich-text editor</b><span>Meal guides, intake forms, handouts</span></div>' + SV['chev'] + '</button></div>'
  '<div class="eyb"><span>Spreadsheet creator</span></div><div class="list"><button class="row">' + ib('week') + '<div class="grow"><b>Blank grid</b><span>Start from empty cells</span></div>' + SV['chev'] + '</button><button class="row">' + ib('workout') + '<div class="grow"><b>Custom program</b><span>Weeks by days, with sets and reps</span></div>' + SV['chev'] + '</button></div>')

add('1 · Home', 'Same order as your trainer home: welcome card with the quote and your boxer animation, what needs you (payout and requests), then a client carousel you swipe from the left, with the four tabs under it for whichever client is selected. Tools and the weekly report follow.', home('p'))
add('2 · Home, client tabs', 'Tap a client card and the tabs below show their data. Here Nutrition is open: calories, macros and meals, with a missing dinner called out as not logged.', home('n', 560))
add('3 · Home, tools and report', 'Further down: the six tool cards (documents, spreadsheets, plans, messages, photos, notes and files) and the weekly report.', home('p', 1750))
add('4 · Payout setup', 'Payout setup stays a sheet. It shows which of three steps is still open.', home('p'), auto(payout, 'payout'))
add('5 · Create sheet', 'Document maker and spreadsheet creator open one launcher, with what each starting point gives you.', home('p'), auto(create, 'create'))

req = (top('New requests', right=pill('2 waiting'), back=True) +
 '<div class="card sq0 rv" style="gap:8px;flex-direction:row;align-items:center"><div style="flex:1;min-width:0"><b>Complete payout setup to accept clients</b></div><button class="btn sm2" data-open="payout" style="padding:0 12px">Set up</button></div>'
 f'<div class="card rv" style="gap:12px"><div style="display:flex;gap:12px;align-items:center">{av("PN")}<div style="flex:1;min-width:0"><h2>Priya Nair</h2><p class="sm mut">Beginner · Evenings · Home</p></div>{pill("Build Muscle")}</div>'
 '<div class="seg" data-tabs="rq"><button data-t="d" aria-pressed="true">Request details</button><button data-t="m" aria-pressed="false">Message</button></div>'
 '<div data-p="rq:d" class="kv"><div class="list">' + ''.join(f'<div class="row" style="cursor:default;min-height:48px"><div class="grow"><span style="margin:0">{k}</span></div><b>{v}</b></div>' for k, v in [('Age', '31'), ('Weight', '158 lb'), ('Height', "5'6\""), ('Equipment', 'Dumbbells'), ('Injuries', 'None')]) + '</div></div>'
 '<div data-p="rq:m" hidden><div class="note">Hi Jordan, my friend Maya trains with you. I am new to lifting and can only train evenings at home. Can you build me a plan?</div></div>'
 '<div style="display:flex;gap:10px"><button class="btn gh" style="flex:1">Reject</button><button class="btn" style="flex:1.4" data-open="payout">Accept client</button></div></div>'
 f'<button class="row rv" style="border:3px solid var(--bd);border-radius:10px;padding:8px 12px;background:var(--sf);min-height:64px">{av("SO")}<div class="grow"><b>Sam Ortiz</b><span>Advanced · Mornings · Gym</span></div>{SV["chev"]}</button>')
add('6 · New requests', 'A request is one expanded card with details and the message they wrote. Accept goes to payout setup when that is unfinished, so it never fails silently.', req, auto(payout, 'payout').replace('data-autoopen', ''))

earn = (top('Money') +
 '<div class="blk2 rv"><span class="eyb">Available balance</span><span class="num" style="font-size:56px;line-height:1" data-count="1240" data-pre="$">$1,240</span><p style="opacity:.8">Next payout Tuesday. $150 pending.</p></div>'
 '<div class="card rv" style="gap:12px"><div style="display:flex;align-items:center;gap:12px"><div style="flex:1;min-width:0"><b style="font-size:17px">Billing is on</b><p class="sm mut">Clients are charged per session</p></div><button class="sw" aria-pressed="true" aria-label="Billing"></button></div>'
 '<div style="display:flex;align-items:center;justify-content:space-between;border-top:2px solid var(--bd);padding-top:12px"><div><span class="sm mut">Your rate</span><div class="num" style="font-size:30px">$75 <span class="sm mut" style="letter-spacing:0">/ session</span></div></div><button class="btn gh sm2" data-open="rate">Edit rate</button></div></div>'
 + sec('Clients', '<button class="chip sm3" style="font-size:13px;padding:0 12px">Refresh status</button>') +
 '<div class="card rv"><div class="list">' + ''.join(f'<div class="row" style="cursor:default">{av(i)}<div class="grow"><b>{n}</b><span>{s}</span></div>{p}</div>' for i, n, s, p in [('AR', 'Alex Rivera', '4 sessions this month', pill('Paid up')), ('MC', 'Maya Chen', '6 sessions this month', pill('Awaiting pay', 'n')), ('DP', 'Dev Patel', '2 sessions this month', pill('Past due', 'g2'))]) + '</div></div>'
 '<p class="sm mut rv sr">Stripe still asking for info? Try Finish setup.</p>')
rate = sheet('rate', '<h2>Edit rate</h2><div style="display:flex;align-items:baseline;gap:8px"><span class="num" style="font-size:56px;line-height:1" data-o="rate" data-v="75">$75</span><span class="mut">per session</span></div>'
  f'<div class="rng" data-min="30" data-max="200" data-step="5" data-val="75" data-out="rate"><div class="trk"><div class="fl {g()}"></div></div><div class="kb" aria-label="Rate"></div></div>'
  '<div style="display:flex;gap:10px"><button class="btn gh" data-close="rate" style="flex:1">Cancel</button><button class="btn" data-close="rate" style="flex:1.6">Save and turn billing on</button></div>')
add('7 · Money', 'Earnings lead with the balance, then billing and rate. Client payment status uses words so it never depends on color.', earn, '', a=None)
add('8 · Edit rate', 'The rate sheet reuses the slider from trainer setup.', earn, auto(rate, 'rate'), a=None)

build('trainer-home.html', 'Coach Connect Trainer Home', '', 'Trainer home',
      'The trainer home in your structure: welcome card with the quote and Lottie, requests, a client carousel you swipe from the left with four tabs under it, then the tool cards and weekly report. The bottom bar is your five-slot bar in the new look.',
      S, lots=('zboxer',), extra_js=JS2, extra_css=CSS2)
