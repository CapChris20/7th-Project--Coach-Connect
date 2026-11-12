from kit import *

CSS2 = r'''
.lotc{display:flex;gap:10px;align-items:center}
.oval{width:190px;height:240px;border:5px dashed var(--ink);border-radius:50%;position:relative;margin:0 auto}
.vfc{height:300px;border:3px solid var(--bd);border-radius:12px;background:repeating-linear-gradient(135deg,var(--soft) 0 12px,var(--chip) 12px 24px);display:grid;place-items:center;overflow:hidden;position:relative;box-shadow:5px 5px 0 var(--sh)}
.vfc.ok .oval{border-style:solid}
.tips{display:flex;flex-direction:column;gap:8px}
.tips .t{display:flex;gap:10px;font-size:15px;line-height:1.35}
.tips .t::before{content:"";width:10px;height:10px;margin-top:6px;flex:none;border:3px solid var(--bd);background:var(--blk)}
.vs{display:flex;gap:12px;align-items:center;min-height:64px;padding:10px 0;border-top:2px solid var(--bd)}
.vs:first-child{border-top:0}
.vs .st{width:30px;height:30px;border:3px solid var(--bd);border-radius:50%;display:grid;place-items:center;flex:none;background:var(--chip);color:var(--on)}
.vs.ok .st{background:var(--blk)}.vs.cur .st{border-style:dashed}
.vs .grow{flex:1;min-width:0}.vs .grow b{display:block;font-size:16px}.vs .grow span{font-size:13px;color:var(--mut)}
.pv{display:flex;align-items:center;gap:12px}
.pv .grow{flex:1;min-width:0}.pv b{display:block;font-size:17px}.pv .c{font-size:13px;color:var(--mut)}
.pv p{font-size:14px;margin-top:4px;line-height:1.35}
.bnav{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd);z-index:4}
.bnav .btn{flex:1}.bnav .btn.back{flex:none;width:56px;padding:0}
.big{font-size:44px;line-height:1;letter-spacing:-1.2px}
.feat{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:2px solid var(--bd)}
.feat:first-child{border-top:0}
.feat .ck{width:26px;height:26px;border:3px solid var(--bd);border-radius:6px;background:var(--blk);color:var(--on);display:grid;place-items:center;flex:none;margin-top:2px}
.feat .ck svg{width:14px;height:14px}
.feat b{display:block;font-size:15px}.feat span{font-size:13px;color:var(--mut)}
.legal{font-size:12px;line-height:1.45;color:var(--mut)}
.stripe{border:3px solid var(--bd);border-radius:10px;overflow:hidden;box-shadow:5px 5px 0 var(--sh);background:var(--sf)}
.stripe .bar2{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border-bottom:3px solid var(--bd);background:var(--soft);font-size:13px;font-weight:800}
.stripe .body{padding:14px;display:flex;flex-direction:column;gap:12px}
.eyb2{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
'''
JS2 = r'''
HOOKS.push(function(ph){
 ph.addEventListener('input',e=>{const t=e.target;const set=(a,v)=>{$$('['+a+']',ph).forEach(x=>x.textContent=v)};
  if(t.matches('.in-name'))set('data-pn',t.value||'Your name');if(t.matches('.in-city'))set('data-pc',t.value||'Your city');if(t.matches('.in-bio'))set('data-pb',t.value||'Your blurb shows here.')});
 $$('.oval',ph).forEach(o=>{if(window.gsap&&!RM)gsap.fromTo(o,{scale:.97},{scale:1.03,duration:1.2,repeat:-1,yoyo:true,ease:'sine.inOut'})});
});
'''
def chapter(frac, n, lab='Business'):
    return steps(2, 3, frac) + f'<div class="eyb rv"><span>Chapter 3 of 3 · {lab}</span><span>{n} / 8</span></div>'
def nav(label='Continue', back=True, skip=False):
    return '<div class="bnav">%s<button class="btn">%s %s</button></div>' % ('<button class="btn gh back" aria-label="Back">%s</button>' % SV['back'] if back else '', label, SV['chev'])

S = []
def add(t, n, body, extra=''): S.append(screen(t, n, body, extra))

# 1 availability
tiles = lambda items, on, cls='': ''.join(f'<button class="chip tile" aria-pressed="{"true" if i == on else "false"}">{ib(ic)}<span>{t}<small>{s}</small></span><span class="tick">{SV["check"]}</span></button>' for i, (t, ic, s) in enumerate(items))
av1 = (top('Availability') + chapter(40, 5) + '<div style="display:flex;gap:10px;align-items:center" class="rv"><div style="flex:1;min-width:0"><h1>How can clients book you?</h1><p class="sm mut" style="margin-top:6px">Set how clients can book with you.</p></div><div class="lot" data-l="time" style="width:84px;height:84px"></div></div>'
  '<div class="gl2 rv" style="font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)">Availability</div>'
  '<div class="seg rv" data-nopick><button aria-pressed="true">Available now</button><button aria-pressed="false">Waitlist</button></div>'
  '<p class="sm mut rv">Waitlist shows a badge on your card and still lets clients request you.</p>'
  '<div class="gl2 rv" style="font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)">Session format</div>'
  '<div class="chips rv" data-single data-g="fmt" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' + ''.join(f'<button class="chip tile" aria-pressed="{x}" style="min-height:92px;padding:10px">{ib(ic)}<span style="font-size:14px">{t}</span><span class="tick">{SV["check"]}</span></button>' for t, ic, x in [('Remote', 'people', 'false'), ('In-person', 'gym', 'false'), ('Both', 'journey', 'true')]) + '</div>'
  '<div class="gl2 rv" style="font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)">Best times for sessions <span style="text-transform:none;letter-spacing:0;font-weight:700"> · optional</span></div>'
  '<div class="chips rv" data-g="tod">' + ''.join(f'<button class="chip sm3" aria-pressed="{x}">{t}</button>' for t, x in [('Morning', 'false'), ('Afternoon', 'true'), ('Evening', 'true'), ('Weekends', 'false')]) + '</div>',
  nav())
add('1 · Availability and format', 'Availability is a two-way switch, session format is three tiles, and best times are optional chips. The one extra I added is the best-times row. Your app has availability and format only.', av1[:0] or '', '')
S.pop()
S.append(screen('1 · Availability and format', 'Availability is a two-way switch, session format is three tiles, and best times are optional chips. The best-times row is my addition. Your app has availability and format only.', *av1))

# 2 almost done
ad = (top('Almost done') + chapter(65, 6) + '<div><h1 class="rv">A few last details</h1><p class="sm mut rv" style="margin-top:6px">A few last details for your profile.</p></div>'
  '<div class="fld rv"><label for="n1">Full name</label><input id="n1" class="in-name" value="Jordan Reyes" placeholder="Your name as clients will see it"></div>'
  '<div class="fld rv"><label for="c1">City, state</label><input id="c1" class="in-city" value="Austin, TX" placeholder="e.g. Detroit, MI"></div>'
  '<div class="fld rv"><label for="b1">Marketplace blurb</label><textarea id="b1" class="in-bio" rows="3" placeholder="One or two sentences for your marketplace card...">Strength coach. I build plans you can repeat for years.</textarea></div>'
  '<div class="eyb2 rv">How your card looks</div><div class="card rv"><div class="pv">' + av('JR') + '<div class="grow"><b data-pn>Jordan Reyes</b><span class="c" data-pc>Austin, TX</span><p data-pb>Strength coach. I build plans you can repeat for years.</p></div></div><div style="display:flex;gap:8px;flex-wrap:wrap">' + pill('Strength') + pill('Fat loss') + pill('Mobility') + '</div></div>'
  '<div class="eyb2 rv">Identity verification</div><div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px">' + ib('checkin') + '<div style="flex:1;min-width:0"><b>Identity verification (Face ID)</b><p class="sm mut">Takes 30 seconds. Reviewed by a person.</p></div><button class="btn gh sm2" style="width:auto;padding:0 12px" data-open="cam">Start</button></div>',
  nav())
cam = sheet('cam', '<span class="pill g5" style="align-self:flex-start">Camera needed</span><h2>Allow camera access</h2><p class="mut">Allow camera access to verify your face for your trainer profile. The photo is used for review only.</p><div style="display:flex;gap:10px"><button class="btn gh" data-close="cam" style="flex:1">Cancel</button><button class="btn" data-close="cam" style="flex:1.3">Allow camera</button></div>')
S.append(screen('2 · Almost done', 'The last profile details show a live preview card of how clients will see you, so name, city and blurb are written with the result in view. Type in the fields. Identity verification is one row with a Start button.', *(ad[0], ad[1] + cam)))
S.append(screen('3 · Camera permission', 'The camera ask is a sheet that says why, using your wording, before the phone prompt.', ad[0], ad[1] + cam.replace('data-sheet="cam"', 'data-sheet="cam" data-autoopen')))

# 4 face capture
fc = (top('Verify your face') + '<div class="vfc rv"><div class="oval"></div></div>'
  '<div class="tips rv"><div class="t">Face the camera in good light.</div><div class="t">Take off hats and sunglasses.</div><div class="t">Fill the oval with your face.</div></div>', '<div class="bnav"><button class="btn gh back" aria-label="Back">' + SV['back'] + '</button><button class="btn">Take photo</button></div>')
S.append(screen('4 · Face capture', 'One viewfinder with an oval that breathes, three plain tips, and one button.', *fc))
sub = (top('Almost done') + chapter(80, 6) + '<div class="card rv" style="gap:10px"><div style="display:flex;align-items:center;gap:12px">' + ib('checkin') + '<div style="flex:1;min-width:0"><b style="font-size:17px">Identity Verification submitted</b></div>' + pill('In review', 'n') + '</div><p class="mut">Face photo uploaded for manual review. You can keep going. We will tell you when it is approved.</p></div>'
  '<div class="vfc ok rv" style="height:180px"><div class="oval" style="width:120px;height:150px"></div></div>', nav())
S.append(screen('5 · Verification submitted', 'After the photo, verification is one state card with In review. The trainer can keep going.', *sub))

# 6-8 payout
def pay(state):
    if state == 'connect':
        steps_ = [('ok', 'Identity verification', 'Submitted, in review'), ('cur', 'Payment method', 'Connect a bank account with Stripe'), ('', 'Start taking clients', 'Unlocks after payouts are active')]
        head = '<div style="display:flex;gap:10px;align-items:center" class="rv"><div style="flex:1;min-width:0"><h1>Get paid for sessions</h1><p class="sm mut" style="margin-top:6px">Connect a bank account with Stripe. It takes about five minutes.</p></div><div class="lot" data-l="rates" style="width:84px;height:84px"></div></div>'
        btn = '<button class="btn rv">Connect with Stripe</button><button class="btn gh rv" data-open="skip">Skip for now</button>'
    elif state == 'ok':
        steps_ = [('ok', 'Identity verification', 'Approved'), ('ok', 'Payment method', 'Bank account verified'), ('ok', 'Start taking clients', 'You are ready')]
        head = '<div class="card blk rv" style="gap:6px;border-radius:6px 24px 6px 6px"><span class="eyb2" style="color:var(--on);opacity:.7">Payouts</span><h1 style="color:var(--on)">Bank account verified!</h1><p style="opacity:.85">Clients can pay you and payouts go to your account on Tuesdays.</p></div>'
        btn = '<button class="btn rv">Continue</button>'
    else:
        steps_ = [('ok', 'Identity verification', 'Submitted, in review'), ('cur', 'Payment method', 'Stripe could not finish'), ('', 'Start taking clients', 'Unlocks after payouts are active')]
        head = '<div class="card emp sq0 rv" style="gap:8px"><h1>That did not finish</h1><p class="mut">Stripe still needs a detail. Try Finish setup again. Your progress is saved.</p></div>'
        btn = '<button class="btn rv">Retry</button><button class="btn gh rv" data-open="skip">Skip for now</button>'
    lst = '<div class="card rv" style="padding:4px 14px"><div>' + ''.join(f'<div class="vs {c}"><span class="st">{SV["check"] if c == "ok" else ""}</span><div class="grow"><b>{t}</b><span>{s}</span></div></div>' for c, t, s in steps_) + '</div></div>'
    return top('Payouts') + chapter(90, 7) + head + lst + btn
skp = sheet('skip', '<span class="pill g2" style="align-self:flex-start">Clients wait</span><h2>Complete payout setup to accept clients</h2><p class="mut">You can finish this any time from Settings. Until then you can build plans and share your code, but new client requests wait.</p><div style="display:flex;gap:10px"><button class="btn gh" data-close="skip" style="flex:1">Skip anyway</button><button class="btn" data-close="skip" style="flex:1.3">Finish setup</button></div>')
S.append(screen('6 · Payouts, connect', 'Payout setup is a three-step list with the current step dashed, and one button that goes to Stripe. Skip is allowed but warns what waits.', pay('connect'), skp))
S.append(screen('7 · Payouts, verified', 'When Stripe confirms, the page turns into one black confirmation with the payout day and all three steps checked.', pay('ok'), ''))
S.append(screen('8 · Payouts, retry', 'If Stripe cannot finish, the page says so in plain words, keeps the saved progress, and the button becomes Retry.', pay('retry'), skp))
S.append(screen('9 · Skip warning', 'Skipping is a sheet that says what is blocked and that it can be done later from Settings.', pay('connect'), skp.replace('data-sheet="skip"', 'data-sheet="skip" data-autoopen')))

# 10 Pro
pro = (top('Coach Connect Pro') + chapter(95, 8) + '<div class="card blk rv" style="gap:6px;border-radius:6px 24px 6px 6px"><span class="eyb2" style="color:var(--on);opacity:.7">Trainer platform subscription</span><div style="display:flex;align-items:baseline;gap:6px"><span class="num big">$19</span><b>/ month</b></div><p style="opacity:.85">14 days free. Cancel any time.</p></div>'
  '<div class="card rv" style="padding:4px 14px"><div>' + ''.join(f'<div class="feat"><span class="ck">{SV["check"]}</span><div><b>{a}</b><span>{b}</span></div></div>' for a, b in [('Take unlimited clients', 'Free plans cap how many you can accept'), ('Documents and spreadsheets', 'Intake forms, meal guides, programs'), ('Weekly reports', 'Every client, built from their logs')]) + '</div></div>'
  '<p class="legal rv">The subscription renews automatically unless it is canceled at least 24 hours before the period ends. Manage it in your store account settings.</p>',
  '<div class="bnav"><button class="btn gh">Skip</button><button class="btn">Start free trial</button></div>')
S.append(screen('10 · Pro offer', 'Pro is the last step and it is skippable. It leads with price and trial, three benefits, then one line of billing text. The price and benefits are placeholders.', *pro))

# 11 complete
done = (top('You are live', back=False) + steps(2, 3, 100).replace('stp now', 'stp done') +
  '<div class="card blk rv" style="gap:6px;border-radius:6px 24px 6px 6px"><span class="eyb2" style="color:var(--on);opacity:.7">Setup complete</span><h1 style="color:var(--on)">Welcome, Jordan.</h1><p style="opacity:.85">Your profile is in the marketplace and your invite code is ready.</p></div>'
  '<div class="card rv" style="padding:4px 14px"><div>' + ''.join(f'<div class="vs ok"><span class="st">{SV["check"]}</span><div class="grow"><b>{t}</b><span>{s}</span></div></div>' for t, s in [('Profile and rates', '$75 per session · Both'), ('Credentials', '2 verified, 1 in review'), ('Identity', 'In review'), ('Payouts', 'Verified'), ('Invite code', 'COACH-7K2F')]) + '</div></div>',
  '<div class="bnav"><button class="btn">Open my trainer home ' + SV['chev'] + '</button></div>')
S.append(screen('11 · Setup complete', 'The last screen is a checklist of what is set, with identity still In review, so nothing is claimed as done that is not.', *done))

build('trainer-setup-part-2.html', 'Coach Connect Trainer Setup Part 2', '', 'Trainer setup, part 2',
      'The rest of trainer setup after rates: availability and format, almost done with live profile preview and face verification, Stripe payouts in three states, Pro offer and the finish screen. It continues from the first trainer setup page.',
      S, lots=('time', 'rates'), extra_js=JS2, extra_css=CSS2)
