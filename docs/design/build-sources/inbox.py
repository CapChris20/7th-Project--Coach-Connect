from kit import *

CSS2 = r'''
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.th{display:flex;align-items:center;gap:12px;min-height:72px;padding:10px 0;border-top:2px solid var(--bd);width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;cursor:pointer}
.list>.th:first-child{border-top:0}
.th .grow{flex:1;min-width:0}.th .grow b{display:block;font-size:16px;line-height:1.2}
.th .grow span{display:block;font-size:14px;color:var(--mut);margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.th .meta{display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:12px;font-weight:800;color:var(--mut)}
.th.un .grow span{color:var(--ink);font-weight:700}
.badge{min-width:26px;height:26px;padding:0 7px;border:3px solid var(--bd);border-radius:999px;background:var(--blk);color:var(--on);display:grid;place-items:center;font-size:13px;font-weight:900}
.pres{position:relative;flex:none}
.pres::after{content:"";position:absolute;right:-5px;bottom:-5px;width:15px;height:15px;border-radius:50%;border:3px solid var(--bd);background:var(--chip)}
.pres.on::after{background:var(--blk)}
.msgs{display:flex;flex-direction:column;gap:10px}
.m{max-width:82%;padding:10px 12px;font-size:15px;line-height:1.4;border:3px solid var(--bd);position:relative}
.m.me{align-self:flex-end;background:var(--blk);color:var(--on);border-radius:14px 14px 4px 14px;box-shadow:4px 4px 0 var(--sh);font-weight:700}
.m.th2{align-self:flex-start;background:var(--sf);border-radius:14px 14px 14px 4px;box-shadow:4px 4px 0 var(--sh)}
.tm{font-size:12px;font-weight:800;color:var(--mut);margin-top:-4px}
.tm.r{align-self:flex-end}
.dv{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut)}
.dv::before,.dv::after{content:"";flex:1;height:3px;background:var(--bd)}
.sc2{align-self:flex-start;width:88%;border:3px solid var(--bd);border-radius:10px;background:var(--sf);box-shadow:4px 4px 0 var(--sh);padding:12px;display:flex;flex-direction:column;gap:10px}
.ph2{align-self:flex-start;width:70%;aspect-ratio:4/3;border:3px solid var(--bd);border-radius:10px;background:repeating-linear-gradient(135deg,var(--soft) 0 10px,var(--chip) 10px 20px);display:grid;place-items:end start;padding:8px;font-size:12px;font-weight:900;box-shadow:4px 4px 0 var(--sh)}
.fc{align-self:flex-end;width:78%;border:3px solid var(--bd);border-radius:10px;background:var(--sf);padding:10px;display:flex;flex-direction:column;gap:10px;box-shadow:4px 4px 0 var(--sh)}
.cmp{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;align-items:flex-end;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd);z-index:4}
.cmp .tf{flex:1;min-width:0;min-height:48px;border:3px solid var(--bd);border-radius:10px;background:var(--sf);padding:12px;font-size:15px;font-weight:700;display:flex;align-items:center;color:var(--mut)}
.cmp .sq.go{background:var(--blk);color:var(--on)}
.swr{position:relative;overflow:hidden;border-top:2px solid var(--bd)}
.swr:first-child{border-top:0}
.swd{position:absolute;right:0;top:0;bottom:0;width:88px;background:var(--blk);color:var(--on);border:0;font-weight:900;font-size:14px;cursor:pointer}
.swi{position:relative;background:var(--sf);display:flex;gap:12px;align-items:flex-start;min-height:76px;padding:12px 0;touch-action:pan-y;cursor:grab}
.swi .grow{flex:1;min-width:0}.swi b{display:block;font-size:15px;line-height:1.25}.swi .t{font-size:12px;font-weight:800;color:var(--mut);white-space:nowrap}
.swi p{font-size:14px;color:var(--mut);margin-top:2px;line-height:1.35}
.udot{width:12px;height:12px;border-radius:50%;background:var(--blk);border:2px solid var(--bd);flex:none;margin-top:5px}
.gl3{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.trial{display:flex;flex-direction:column;gap:10px;border:3px solid var(--bd);border-radius:6px 20px 6px 6px;background:var(--sf);box-shadow:5px 5px 0 var(--sh);padding:12px 14px}
.trial.blk{background:var(--blk);color:var(--on)}
.trial.blk .btn{background:var(--on);color:var(--blk);border-color:var(--on);box-shadow:none}
.feat{display:flex;gap:12px;align-items:flex-start;min-height:0;padding:10px 0;border-top:2px solid var(--bd)}
.feat:first-child{border-top:0}
.feat .ck{width:26px;height:26px;border:3px solid var(--bd);border-radius:6px;background:var(--blk);color:var(--on);display:grid;place-items:center;flex:none;margin-top:2px}
.feat .ck svg{width:14px;height:14px}
.feat b{display:block;font-size:15px}.feat span{font-size:13px;color:var(--mut)}
.feat.lock .ck{background:transparent;color:var(--ink);border-style:dashed}
.legal{font-size:12px;line-height:1.45;color:var(--mut)}
.legal b{color:var(--ink)}
.price{font-size:48px;line-height:1;letter-spacing:-1.5px}
.hi{display:flex;align-items:center;gap:12px}
.hi .grow{flex:1;min-width:0}
.seg.sx{overflow-x:auto;scrollbar-width:none}.seg.sx::-webkit-scrollbar{display:none}.seg.sx button{flex:none;padding:0 16px}
'''
JS2 = r'''
HOOKS.push(function(ph){
 $$('.swi',ph).forEach(el=>{if(!(window.gsap&&window.Draggable))return;
  Draggable.create(el,{type:'x',bounds:{minX:-88,maxX:0},edgeResistance:.9,onDragEnd(){gsap.to(el,{x:this.x<-44?-88:0,duration:.35,ease:'back.out(1.6)'})}})});
 $$('.swd',ph).forEach(b=>b.addEventListener('click',()=>{const r=b.closest('.swr');if(window.gsap&&!RM)gsap.to(r,{height:0,opacity:0,duration:.3,onComplete:()=>r.remove()});else r.remove()}));
 const m=$('[data-bottom]',ph);if(m)setTimeout(()=>{const s=$('.scr',ph);if(s)s.scrollTop=s.scrollHeight},450);
 const t=$('[data-scrollto]',ph);if(t)setTimeout(()=>{const s=$('.scr',ph);if(s)s.scrollTop=+t.dataset.scrollto},400);
});
'''

def thread(ini, name, prev, time, unread=0, online=False, pin=False):
    badge = f'<span class="badge">{unread}</span>' if unread else ''
    return (f'<button class="th{" un" if unread else ""}"><span class="pres{" on" if online else ""}">{av(ini)}</span><div class="grow"><b>{name}</b><span>{prev}</span></div>'
            f'<div class="meta"><span>{time}</span>{badge}</div></button>')

S = []
def add(t, n, body, extra='', a='files', lab='', second=False):
    S.append(screen(t, n, body, (dock(a) if a else '') + extra, lab=lab, second=second))

# 1 trainer inbox
def tinbox(data=True):
    h = top('Messages', back=False, right=f'<button class="sq" aria-label="New message">{SV["plus"]}</button>')
    if not data:
        return h + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('people', 'lg') + '<h1>No messages yet</h1><p class="mut">Message a client from your roster, or add someone new from a chat.</p><button class="btn">Open my roster</button></div>'
    return (h + '<div class="fld rv"><input aria-label="Search messages" placeholder="Search clients"></div>'
            '<div class="card rv" style="padding:4px 14px"><div class="list">'
            + thread('DP', 'Dev Patel', 'Can we move Saturday to 10?', '12 min', 2, True)
            + thread('MC', 'Maya Chen', 'Sent a photo', '1 h', 1, True)
            + thread('AR', 'Alex Rivera', 'Knee felt tight on the second set', '2 h', 0, False)
            + thread('SO', 'Sam Ortiz', 'Thanks, see you Friday', 'Yesterday', 0, False)
            + thread('PN', 'Priya Nair', 'Request: Build Muscle, evenings', 'Mon', 0, False)
            + '</div></div><button class="btn gh rv sr">Load earlier messages</button>')
add('1 · Messages, trainer', 'The trainer inbox is a list of clients, with unread threads set apart by a black count and bolder preview. A ring on the avatar says who is online. The empty side uses your real message about adding someone from a chat.', tinbox(True), lab='With messages')
add('x', 'x', tinbox(False), lab='Empty', second=True)

# 2 client inbox
def cinbox(has=True):
    h = top('Message your coach', back=False)
    if not has:
        return h + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('people', 'lg') + '<h1>No coach yet</h1><p class="mut">Find a trainer in the app to start messaging.</p><button class="btn">Find a trainer</button><button class="btn gh">I have an invite code</button></div>'
    return (h + '<div class="card rv" style="padding:4px 14px"><div class="list">' + thread('JR', 'Jordan Reyes', 'Keep squats pain-free. Box to parallel.', '12 min', 1, True) + '</div></div>'
            '<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px">' + ib('energy') + '<div style="flex:1;min-width:0"><b>Notifications from your AI Fitness Coach</b><p class="sm mut">Reminders and tips. Manage in Settings.</p></div></div>')
add('2 · Messages, client', 'A client has one thread, so the inbox is that thread plus a note about AI coach notifications. With no trainer it says so and offers the two ways to get one.', cinbox(True), lab='With a coach')
add('x', 'x', cinbox(False), lab='No coach yet', second=True)

# 3 chat
def header(sub='Online now'):
    return (f'<header class="top rv"><button class="sq" aria-label="Back">{SV["back"]}</button><span class="pres on">{av("JR")}</span><div class="tt"><h1 style="font-size:19px">Jordan Reyes</h1><p class="sub">{sub}</p></div><button class="sq" aria-label="More"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="3" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="17" y="10" width="4" height="4"/></svg></button></header>')
chat = ('<div data-bottom hidden></div>' + header() + '<button class="btn gh sm2 rv" style="align-self:center;width:auto;padding:0 14px">Load earlier messages</button><div class="msgs rv">'
  '<div class="dv">Yesterday</div><div class="m me">Left knee was a bit sore after squats.</div><div class="tm r">6:41 PM</div>'
  '<div class="m th2">Thanks for telling me. Keep squats pain-free: box to parallel, stop short of the ache.</div><div class="tm">7:02 PM</div>'
  '<div class="dv">Today</div><div class="ph2">Squat, set 2</div><div class="tm">9:15 AM</div>'
  '<div class="sc2"><div style="display:flex;justify-content:space-between;align-items:center">' + pill('Session scheduled') + '<span class="sm mut">Jordan</span></div><div><b style="font-size:17px">Lower body · Fri, 6:30 PM</b><p class="sm mut">60 min · Gym</p></div><div style="display:flex;gap:8px"><button class="btn gh sm2" style="flex:1;padding:0 8px">Change time</button><button class="btn sm2" style="flex:1;padding:0 8px">Confirm</button></div></div>'
  '<div class="m me">Friday works. Sending my week 3 notes now.</div><div class="fc"><div style="display:flex;align-items:center;gap:10px">' + ib('week') + '<div style="flex:1;min-width:0"><b style="display:block;font-size:15px">Week 3 notes.pdf</b><span class="sm mut">240 KB</span></div></div><button class="btn gh sm2" style="width:100%">Download</button></div><div class="tm r">Just now</div></div>')
cmp_ = f'<div class="cmp"><button class="sq" data-open="att" aria-label="Attach">{SV["plus"]}</button><div class="tf">Message Jordan</div><button class="sq go" aria-label="Send">{SV["send"]}</button></div>'
att = sheet('att', '<h2>Attach</h2><div class="list"><button class="row">' + ib('picture') + '<div class="grow"><b>Photo / Video</b><span>From your library or camera</span></div>' + SV['chev'] + '</button><button class="row">' + ib('week') + '<div class="grow"><b>File</b><span>PDF, spreadsheet or document</span></div>' + SV['chev'] + '</button></div><button class="btn gh" data-close="att">Cancel</button>')
add('3 · Chat', 'A chat is bubbles for text, plus real cards for the things that happen in coaching: a photo, a session to confirm, and a file with Download. Your messages are black and theirs are outlined, so no color is needed to tell them apart.', chat, cmp_ + att, a=None)
add('4 · Attach', 'Attach has two choices, as in your app: Photo / Video and File.', chat, cmp_ + att.replace('data-sheet="att"', 'data-sheet="att" data-autoopen'), a=None)
blk = (header('Blocked') + '<div class="msgs rv"><div class="dv">Oct 28</div><div class="m th2">See you Friday.</div></div><div class="card blk rv" style="gap:6px"><b style="font-size:17px">You blocked this person</b><p style="opacity:.8">They cannot message you. Unblock to chat again.</p></div>')
add('5 · Chat, blocked', 'A blocked chat replaces the composer with one black card that says what blocking means and how to undo it.', blk, '<div class="cmp"><button class="btn" style="flex:1">Unblock</button></div>', a=None)

# 6 notifications
def nrow(ic, t, p, tm, un=False):
    return f'<div class="swr"><button class="swd">Clear</button><div class="swi">{"<span class=\"udot\"></span>" if un else "<span style=\"width:12px;flex:none\"></span>"}{ib(ic)}<div class="grow"><b>{t}</b><p>{p}</p></div><span class="t">{tm}</span></div></div>'
def notifs(data=True):
    h = top('Notifications', back=False, right='<button class="btn gh sm2" style="width:auto;padding:0 12px">Mark all read</button>')
    bn = '<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px"><span class="cert" style="width:28px;height:28px;border:3px solid var(--bd);border-radius:50%;background:var(--blk);color:var(--on);display:grid;place-items:center">' + SV['check'] + '</span><b>Notifications are enabled.</b></div>'
    seg = '<div class="seg sx rv" data-nopick><button aria-pressed="true">All</button><button aria-pressed="false">Sessions</button><button aria-pressed="false">Messages</button><button aria-pressed="false">Files</button></div>'
    if not data:
        return h + bn + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('checkin', 'lg') + '<h1>You are all caught up</h1><p class="mut">Session changes, messages, shared files and coach reminders show up here.</p></div>'
    return (h + bn + seg + '<div class="gl3 rv">Today</div><div class="card rv" style="padding:4px 14px"><div>'
        + nrow('people', 'New client request', 'Priya Nair wants to train with you.', '9:40 AM', True)
        + nrow('schedule', 'Session scheduled', 'Lower body, Friday at 6:30 PM.', '9:12 AM', True)
        + nrow('week', 'Shared something new in Notes & Files.', 'Jordan added Week 3 program.', '8:05 AM') + '</div></div>'
        '<div class="gl3 rv">Earlier</div><div class="card rv" style="padding:4px 14px"><div>'
        + nrow('schedule', 'Your session was updated.', 'Monday moved to 7:00 PM.', 'Tue')
        + nrow('injury', 'A scheduled session was cancelled.', 'Saturday check-in call.', 'Mon')
        + nrow('energy', 'Time to workout!', 'Your daily workout reminder.', 'Mon') + '</div></div>'
        '<p class="sm mut rv">Drag a notification left to clear it.</p>')
add('6 · Notifications', 'Notifications are one list grouped by day. Unread ones have a black dot. Drag a row left to clear it, and the row collapses. Messages use your real notification wording. The empty side says what will show up here.', notifs(True), lab='With notifications')
add('x', 'x', notifs(False), lab='Empty', second=True)

# 7 trial banner states + trainer home slice
def banner(kind):
    if kind == 'trial':
        return ('<div class="trial rv"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:16px">Free trial active</b>' + pill('9 days left') + '</div>' + bar(35) + '<div style="display:flex;gap:8px;align-items:center"><p class="sm mut" style="flex:1">Full Pro access until Nov 22.</p><button class="btn sm2" style="width:auto;padding:0 14px">Subscribe</button></div></div>')
    if kind == 'last':
        return ('<div class="trial blk rv"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:16px">Free trial ends in 2 days</b>' + pill('2 days left') + '</div>' + bar(90) + '<div style="display:flex;gap:8px;align-items:center"><p class="sm" style="flex:1;opacity:.8">Subscribe to keep taking clients.</p><button class="btn sm2" style="width:auto;padding:0 14px">Subscribe</button></div></div>')
    return ('<div class="trial rv" style="border-style:dashed"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:16px">Subscription expired</b>' + pill('Expired', 'g2') + '</div><p class="sm mut">New client requests are paused until you renew.</p><button class="btn sm2" style="width:100%">Renew Coach Connect Pro</button></div>')
bn = (top('Free trial banner', sub='Three states, top of trainer home') + '<div class="gl3 rv">Trial running</div>' + banner('trial') + '<div class="gl3 rv">Last two days</div>' + banner('last') + '<div class="gl3 rv">Expired</div>' + banner('exp') + '<div class="card flat rv" style="flex-direction:row;gap:12px;align-items:center">' + ib('settings') + '<p class="sm mut">Trial shown here is a sample length. The banner sits above Needs you on trainer home.</p></div>')
add('7 · Free trial banner', 'The banner changes weight as time runs out: outlined while the trial is fine, black in the last two days, dashed once it has expired. Each state has one action.', bn, '', a='home')

# 8 offer sheet
home_bg = top('Trainer home', back=False) + '<div class="card rv"><b>Complete payout setup to accept clients</b></div>' + banner('trial')
offer = sheet('off', '<span class="pill g4" style="align-self:flex-start">Coach Connect Pro</span><h2>Trainer platform subscription</h2><div style="display:flex;align-items:baseline;gap:6px"><span class="num price">$19</span><b>/ month</b></div><p class="mut">Start free for 14 days. Cancel any time in your store account.</p>'
  '<div class="feat"><span class="ck">' + SV['check'] + '</span><div><b>Take unlimited clients</b></div></div><div class="feat"><span class="ck">' + SV['check'] + '</span><div><b>Documents and spreadsheets</b></div></div><div class="feat"><span class="ck">' + SV['check'] + '</span><div><b>Weekly reports for every client</b></div></div>'
  '<button class="btn" data-close="off">Start free trial</button><button class="btn gh" data-close="off">Not now</button>')
add('8 · Upgrade offer', 'The offer opens as a sheet over trainer home, so a trainer never loses their place. It leads with the price and the trial, then three things Pro gives.', home_bg, offer.replace('data-sheet="off"', 'data-sheet="off" data-autoopen'), a='home')

# 9 upgrade screen
feats = [('Take unlimited clients', 'Free plans cap how many you can accept'), ('Documents and spreadsheets', 'Intake forms, meal guides and programs'), ('Weekly reports', 'Every client, built from their logs'), ('Priority support', 'Replies from a person')]
up = (top('Coach Connect Pro', sub='Trainer platform subscription') +
  '<div class="card blk rv" style="gap:6px;border-radius:6px 24px 6px 6px"><span class="gl3" style="color:var(--on);opacity:.7">Full Pro access</span><div style="display:flex;align-items:baseline;gap:6px"><span class="num price" style="color:var(--on)">$19</span><b>/ month</b></div><p style="opacity:.8">14 days free, then billed monthly.</p></div>'
  '<div class="card rv" style="padding:4px 14px"><div>' + ''.join(f'<div class="feat"><span class="ck">{SV["check"]}</span><div><b>{a}</b><span>{b}</span></div></div>' for a, b in feats) + '</div></div>'
  '<button class="btn rv">Start free trial</button><button class="btn gh rv">Restore purchases</button>'
  '<p class="legal rv"><b>How billing works.</b> Payment is charged to your store account at the end of the free trial. The subscription renews automatically unless it is canceled at least 24 hours before the period ends. Manage or cancel in your store account settings. <b>Terms of Service</b> and <b>Privacy Policy</b>.</p>')
add('9 · Upgrade screen', 'The full upgrade page has the same price block in black, the four benefits as a checklist, Start free trial, Restore purchases, and the legal footer in readable 12 pixel text. Billing wording is standard store language and is a placeholder for your final legal text.', up, '', a=None)

# 10 expired
ex = (top('Subscription expired', back=False) + '<div class="card emp sq0 rv" style="gap:10px;align-items:flex-start">' + ib('injury', 'lg') + '<h1>Your Pro subscription ended</h1><p class="mut">Your clients, plans and messages are safe. A few things are paused until you renew.</p></div>'
  '<div class="card rv" style="padding:4px 14px"><div><div class="feat lock"><span class="ck">' + SV['x'] + '</span><div><b>New client requests</b><span>Paused</span></div></div><div class="feat lock"><span class="ck">' + SV['x'] + '</span><div><b>Documents and spreadsheets</b><span>View only</span></div></div><div class="feat"><span class="ck">' + SV['check'] + '</span><div><b>Messages and current clients</b><span>Still working</span></div></div></div></div>'
  '<button class="btn rv">Renew Coach Connect Pro</button><button class="btn gh rv">Restore purchases</button><button class="btn gh rv">Contact support</button>')
add('10 · Subscription expired', 'Expired says what is paused and what still works, so a trainer does not worry about their clients. The renew button is first. Restore purchases and Contact support follow.', ex, '', a=None)

build('inbox-and-money.html', 'Coach Connect Inbox and Money', '', 'Inbox and money',
      'Messages for trainers and clients, chat with session and file cards, notifications you can clear with a drag, and the Pro plan: free trial banner, upgrade offer, upgrade page and the expired state. Inboxes and notifications show empty and filled side by side.',
      S, extra_js=JS2, extra_css=CSS2)
