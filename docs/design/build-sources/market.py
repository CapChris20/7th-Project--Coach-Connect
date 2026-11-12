from kit import *

CSS2 = r'''
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.gl3{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.tc{display:flex;flex-direction:column;gap:10px;padding:14px;border:3px solid var(--bd);border-radius:10px;background:var(--sf);box-shadow:5px 5px 0 var(--sh);width:100%;text-align:left;cursor:pointer}
.tc:nth-child(even){border-radius:10px 26px 10px 10px}
.tc .top{display:flex;gap:12px;align-items:center}
.tc .top .grow{flex:1;min-width:0}.tc .top b{display:flex;align-items:center;gap:6px;font-size:17px;line-height:1.2}.tc .top span.s{font-size:13px;color:var(--mut)}
.tc .ft{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:2px solid var(--bd);padding-top:10px}
.tc .ft .pr{font-size:20px;font-weight:900;letter-spacing:-.5px;font-variant-numeric:tabular-nums}.tc .ft .pr small{font-size:12px;color:var(--mut);font-weight:800;letter-spacing:0}
.vf2{display:inline-grid;place-items:center;width:20px;height:20px;border:2.5px solid var(--bd);border-radius:50%;background:var(--blk);color:var(--on);flex:none}
.vf2 svg{width:11px;height:11px}
.pl{display:flex;gap:6px;flex-wrap:wrap}
.seg.sx{overflow-x:auto;scrollbar-width:none}.seg.sx::-webkit-scrollbar{display:none}.seg.sx button{flex:none;padding:0 16px}
.chips.sx2{flex-wrap:nowrap;overflow-x:auto;margin:0 -16px;padding:2px 16px 8px;scrollbar-width:none}
.chips.sx2::-webkit-scrollbar{display:none}.chips.sx2 .chip{flex:none}
.map{position:relative;height:420px;border:3px solid var(--bd);border-radius:12px;background:repeating-linear-gradient(0deg,var(--soft) 0 44px,var(--chip) 44px 88px);box-shadow:5px 5px 0 var(--sh);overflow:hidden}
.map::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 59px,var(--bd) 59px 62px);opacity:.25}
.pin{position:absolute;z-index:2;min-width:52px;height:36px;padding:0 10px;border:3px solid var(--bd);border-radius:999px;background:var(--sf);display:grid;place-items:center;font-weight:900;font-size:13px;box-shadow:3px 3px 0 var(--sh)}
.pin.on{background:var(--blk);color:var(--on)}
.wg{display:flex;gap:12px;align-items:center;min-height:56px;padding:6px 0;border-top:2px solid var(--bd)}
.wg:first-child{border-top:0}.wg b{font-size:15px}
.fbar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:12px;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd);z-index:4}
.fbar .pr{font-size:26px;font-weight:900;letter-spacing:-.8px;line-height:1;font-variant-numeric:tabular-nums}.fbar .pr small{display:block;font-size:12px;color:var(--mut);font-weight:800;letter-spacing:0;margin-top:2px}
.fbar .btn{flex:1}
.stp{display:flex;flex-direction:column}
.tl{display:flex;flex-direction:column;padding-left:4px}
.tl .st{display:flex;gap:14px;position:relative;padding-bottom:14px}
.tl .st:last-child{padding-bottom:0}
.tl .st::before{content:"";position:absolute;left:15px;top:32px;bottom:0;width:3px;background:var(--bd)}
.tl .st:last-child::before{display:none}
.tl .n{width:34px;height:34px;flex:none;border:3px solid var(--bd);border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:14px;background:var(--chip)}
.tl .st.cur .n{background:var(--blk);color:var(--on)}
.tl .st div b{display:block;font-size:15px;margin-top:5px}.tl .st div span{font-size:13px;color:var(--mut)}
.banner{display:grid;grid-template-columns:1fr 84px;gap:8px;align-items:center;background:var(--blk);color:var(--on);border:3px solid var(--bd);border-radius:6px 24px 6px 6px;box-shadow:6px 6px 0 var(--sh);padding:14px}
.banner h2{color:var(--on);font-size:22px;line-height:1.05}.banner p{opacity:.85;font-size:14px;margin-top:6px}
.fin{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fin .fld input{min-height:48px}
'''
JS2 = r'''
HOOKS.push(function(ph){
 $$('[data-fcount]',ph).forEach(()=>{});
 ph.addEventListener('click',e=>{if(e.target.closest('.sheet .chip,.sheet .sw')){const n=$$('.sheet .chip[aria-pressed="true"]',ph).length+$$('.sheet .sw[aria-pressed="true"]',ph).length;const o=$('[data-ncount]',ph);if(o)o.textContent=Math.max(1,18-n*2)}});
});
'''
CK = f'<span class="vf2">{SV["check"]}</span>'
TR = [('JR', 'Jordan Reyes', 'Austin, TX', ['Strength', 'Mobility', 'Fat loss'], '6 yrs', '$240', True, 'Available', 'g1'),
      ('MO', 'Maya Ortiz', 'Denver, CO', ['Yoga', 'Mobility'], '4 yrs', '$180', True, 'Waitlist', 'g3'),
      ('SM', 'Shane Marion', 'Remote', ['Powerlifting', 'Nutrition'], '9 yrs', '$320', False, 'Available', 'g4'),
      ('PK', 'Priya Kapoor', 'Chicago, IL', ['HIIT', 'Weight Loss'], '2 yrs', 'Rate on request', False, 'Available', 'g7')]
def card(t):
    ini, nm, city, sp, yrs, pr, ver, av_, _ = t
    price = f'<span class="pr">{pr}<small> / mo</small></span>' if pr.startswith('$') else '<span class="pr" style="font-size:15px">Rate on request</span>'
    return (f'<button class="tc"><div class="top">{av(ini)}<div class="grow"><b>{nm}{CK if ver else ""}</b><span class="s">{city} · {yrs} coaching</span></div>{pill(av_, "n" if av_ == "Waitlist" else None)}</div>'
            f'<div class="pl">' + ''.join(f'<span class="pill n">{s}</span>' for s in sp) + f'</div><div class="ft">{price}<span class="sm" style="font-weight:800">View profile {SV["chev"]}</span></div></button>')

S = []
def add(t, n, body, extra='', a='home'): S.append(screen(t, n, body, (dock(a) if a else '') + extra))

# 1 entry banner
ent = ('<div class="hi rv" style="display:flex;align-items:center;gap:12px">' + av('AR') + '<div style="flex:1"><small style="display:block;color:var(--mut);font-size:13px">Thursday evening</small><b style="font-size:19px">Good evening, Alex</b></div></div>'
  '<div class="banner rv"><div><span class="gl3" style="color:var(--on);opacity:.7">No trainer yet</span><h2>Find Your Perfect Trainer</h2><p>Custom workouts, direct messaging, progress tracking and session booking.</p></div><div class="lot" data-l="zcoach" style="width:84px;height:84px"></div></div>'
  '<button class="btn rv">Find a Trainer</button><button class="btn gh rv">I have an invite code</button>')
add('1 · Entry on home', 'A client without a trainer sees one black banner on the dashboard with the four things a trainer gives, and one button into the marketplace.', ent)

# 2 list
lst = (top('Find a Trainer', back=True, right='<button class="sq" data-open="fl" aria-label="Filter"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 6h16M7 12h10M10 18h4"/></svg></button>') +
  '<div class="fld rv"><input aria-label="Search" placeholder="Search trainers, cities…"></div>'
  '<div class="chips sx2 rv" data-single data-g="sp">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if s == "All" else "false"}">{s}</button>' for s in ['All', 'Strength', 'Weight Loss', 'Bodybuilding', 'HIIT', 'Mobility', 'Nutrition']) + '</div>'
  '<div style="display:flex;justify-content:space-between;align-items:center" class="rv"><span class="gl3">14 trainers</span><div style="display:flex;gap:8px"><button class="chip sm3" style="font-size:13px;padding:0 12px">Newest</button><button class="chip sm3" style="font-size:13px;padding:0 12px" data-open="fl">Filter · 2</button></div></div>'
  + ''.join('<div class="rv">' + card(t) + '</div>' for t in TR))
fl = sheet('fl', '<div style="display:flex;align-items:center;gap:10px"><h2 style="flex:1">Filter</h2><button class="lnk" style="background:none;border:0;font-weight:900;font-size:15px;text-decoration:underline;min-height:44px;cursor:pointer;color:var(--ink)">Reset</button></div>'
  '<div class="gl3">Sort by</div><div class="seg" data-nopick><button aria-pressed="true">Newest</button><button aria-pressed="false">Price: Low</button><button aria-pressed="false">Price: High</button></div>'
  '<div class="gl3">Specialty</div><div class="chips" data-g="s">' + ''.join(f'<button class="chip sm3" aria-pressed="{x}">{n}</button>' for n, x in [('Strength', 'true'), ('Bodybuilding', 'false'), ('HIIT', 'false'), ('Cardio', 'false'), ('Yoga', 'false'), ('Pilates', 'false'), ('CrossFit', 'false')]) + '</div>'
  '<div class="gl3">Session type</div><div class="seg" data-nopick><button aria-pressed="false">Remote</button><button aria-pressed="false">In-person</button><button aria-pressed="true">Both</button></div>'
  '<div class="gl3">Experience</div><div class="chips" data-single data-g="x">' + ''.join(f'<button class="chip sm3" aria-pressed="{x}">{n}</button>' for n, x in [('Any', 'true'), ('1-2 years', 'false'), ('3-5 years', 'false'), ('5-8 years', 'false')]) + '</div>'
  '<div class="gl3">Price per month</div><div class="fin"><div class="fld"><input aria-label="Min" placeholder="Min $/mo"></div><div class="fld"><input aria-label="Max" placeholder="Max $/mo" value="300"></div></div>'
  '<div class="gl3">Availability</div><div class="chips" data-single data-g="a">' + ''.join(f'<button class="chip sm3" aria-pressed="{x}">{n}</button>' for n, x in [('Available', 'true'), ('Waitlist', 'false')]) + '</div>'
  '<div class="card flat" style="padding:4px 14px"><div class="list"><div class="row" style="cursor:default"><div class="grow"><b>Verified</b><span>Credentials checked</span></div><button class="sw" aria-pressed="true" aria-label="Verified"></button></div><div class="row" style="cursor:default"><div class="grow"><b>Available only</b><span>Hide waitlists</span></div><button class="sw" aria-pressed="false" aria-label="Available only"></button></div></div></div>'
  '<button class="btn" data-close="fl">Show <span data-ncount>14</span> trainers</button>')
add('2 · Find a Trainer', 'The list is search, one scroll of specialty chips, a count, and cards that carry what a client decides on: name, a verified tick, city, years, specialties, price per month and availability. Filter opens from the top button or the chip with a count.', lst, fl)
add('3 · Filters', 'Filters use your real fields: sort, specialty, session type, experience, price per month, availability, and Verified and Available only. The button says how many trainers will show.', lst, fl.replace('data-sheet="fl"', 'data-sheet="fl" data-autoopen'))

# 4 map
pins = [(30, 60, '$240', True), (150, 130, '$180', False), (70, 230, '$320', False), (200, 290, '$150', False), (220, 70, '$210', False)]
mp = (top('Find a Trainer', right='<button class="sq" aria-label="List">' + SV['back'] + '</button>') + '<div class="seg rv" data-nopick><button aria-pressed="false">List</button><button aria-pressed="true">Map</button></div>'
  '<div class="map rv">' + ''.join(f'<span class="pin{" on" if on else ""}" style="left:{x}px;top:{y}px">{p}</span>' for x, y, p, on in pins) + '</div>' + card(TR[0]).replace('class="tc"', 'class="tc" style="margin-top:0"'))
add('4 · Map view (concept)', 'A map with price pins, and the nearest trainer as a card under it. Your repo shows city text on trainers but I did not find a map screen, so treat this as an idea to confirm. The map is a hatched placeholder.', mp)

# 5 no results
nr = (top('Find a Trainer') + '<div class="fld rv"><input aria-label="Search" value="Powerlifting Fargo"></div><div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('journey', 'lg') + '<h1>No coaches match</h1><p class="mut">Try fewer filters or a wider price range. Remote trainers work from anywhere.</p><button class="btn">Clear filters</button><button class="btn gh">Show remote trainers</button></div>')
add('5 · No results', 'When nothing matches, the page says so and offers two ways out: clear filters, or widen to remote trainers.', nr)

# 6 profile
def feat(ic, t): return f'<div class="wg">{ib(ic)}<b>{t}</b></div>'
prof = (top('Trainer profile', right='<button class="sq" data-open="rp" aria-label="More"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="3" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="17" y="10" width="4" height="4"/></svg></button>') +
  '<div class="card hi rv" style="gap:12px;flex-direction:row;align-items:center;border-radius:6px 24px 6px 6px">' + av('JR') + '<div style="flex:1;min-width:0"><h2>Jordan Reyes</h2><p class="sm mut" style="display:flex;gap:6px;align-items:center;margin-top:4px">' + CK + ' Verified · Austin, TX</p><div style="margin-top:8px">' + pill('Available') + '</div></div></div>'
  '<div class="gl3 rv">About</div><p class="rv">Strength coach. I build plans you can repeat for years, and I coach around old injuries without making them the whole story.</p>'
  '<div class="gl3 rv">Specialties</div><div class="pl rv">' + ''.join(f'<span class="pill {g()}">{s}</span>' for s in ['Strength', 'Mobility', 'Fat loss']) + '</div>'
  '<div class="st3 rv" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="card flat" style="gap:2px"><span class="gl3">Years coaching</span><b class="num" style="font-size:28px">6</b></div><div class="card flat" style="gap:2px"><span class="gl3">Format</span><b style="font-size:20px">Remote and in person</b></div></div>'
  '<div class="gl3 rv">What you get</div><div class="card rv" style="padding:4px 14px"><div>' + feat('workout', 'Custom workouts') + feat('people', 'Direct messaging') + feat('progress', 'Progress tracking') + feat('schedule', 'Session booking') + '</div></div>'
  '<div class="card blk rv" style="gap:6px"><span class="gl3" style="color:var(--on);opacity:.7">Free trial period: 3–5 days</span><p style="opacity:.9">Try the coaching first. You pay after your trial.</p><span class="gl3" style="color:var(--on);opacity:.7;margin-top:4px">After your trial</span><div class="num" style="font-size:30px">$240<span style="font-size:14px;opacity:.7"> / month</span></div></div>',
  '<div class="fbar"><div class="pr">$240<small>per month</small></div><button class="btn" data-open="rq">Start your free trial</button></div>')
add('6 · Trainer profile', 'The profile reads top to bottom as the decision: who, about, specialties, years and format, what you get, then the trial and the price in one black block. The bar at the bottom pins the price and the action so they never scroll away.', prof[0], prof[1], a=None)

# 7 no bio
nb = (top('Trainer profile') + '<div class="card rv" style="flex-direction:row;align-items:center;gap:12px;border-radius:6px 24px 6px 6px">' + av('PK') + '<div style="flex:1;min-width:0"><h2>Priya Kapoor</h2><p class="sm mut">Chicago, IL</p></div>' + pill('Available') + '</div>'
  '<div class="card emp sq0 rv" style="gap:8px"><b style="font-size:18px">No bio yet.</b><p class="mut">This coach is setting up their profile. Message them to learn more about their coaching style.</p><button class="btn">Send message</button></div>'
  '<div class="card flat rv" style="gap:6px"><span class="gl3">Investment</span><b style="font-size:20px">Rate on request</b></div>')
add('7 · Profile, no bio', 'A thin profile still works: it says the coach is setting up, shows Rate on request, and the primary action becomes Send message instead of Start your free trial.', nb, a=None)

# 8-10 request
rq = sheet('rq', '<h2>Say hello to Jordan</h2><p class="mut">A short note helps Jordan say yes. They see your goal and level.</p><div class="card flat" style="flex-direction:row;align-items:center;gap:10px">' + pill('Build Muscle') + pill('Intermediate', 'n') + '</div><div class="fld"><label for="rm">Message</label><textarea id="rm" rows="4">Hi Jordan, I want to build muscle around a sore left knee. I can train evenings.</textarea></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="rq" style="flex:1">Cancel</button><button class="btn" data-close="rq" style="flex:1.4">Continue</button></div>')
cf = sheet('cf', '<h2>Confirm your request</h2><div class="tl"><div class="st cur"><span class="n">1</span><div><b>You send the request</b><span>Jordan sees your goals and message</span></div></div><div class="st"><span class="n">2</span><div><b>Jordan accepts</b><span>Usually within a day</span></div></div><div class="st"><span class="n">3</span><div><b>3–5 day free trial</b><span>Then $240 per month. Cancel any time.</span></div></div></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="cf" style="flex:1">Cancel</button><button class="btn" data-close="cf" style="flex:1.4">Confirm</button></div>')
sent = sheet('sn', '<span class="pill g4" style="align-self:flex-start">Request sent</span><h2>Jordan has your request</h2><p class="mut">You are told as soon as they reply. Until then you can keep browsing.</p><button class="btn" data-close="sn">Got it</button>')
add('8 · Say hello', 'The first step is a short message with your goal and level attached, so Jordan sees who is asking.', prof[0], prof[1] + rq.replace('data-sheet="rq"', 'data-sheet="rq" data-autoopen'), a=None)
add('9 · Confirm your request', 'Confirm is a timeline of what happens next, in order: send, accept, trial, then the price. It is a real sequence, so it is numbered.', prof[0], prof[1] + cf.replace('data-sheet="cf"', 'data-sheet="cf" data-autoopen'), a=None)
add('10 · Request sent', 'The last sheet confirms in two lines and sends you back to browsing.', prof[0], prof[1] + sent.replace('data-sheet="sn"', 'data-sheet="sn" data-autoopen'), a=None)

# 11 error
er = (top('Trainer profile') + '<div class="card emp sq0 rv" style="gap:10px;align-items:flex-start"><span class="gl3">Unable to connect</span><h1>Connection requests are not available right now.</h1><p class="mut">Nothing was sent. Try again in a minute, or message the coach directly.</p><button class="btn" data-retry>Try again</button><button class="btn gh">Send message</button></div>')
add('11 · Unable to connect', 'If a request cannot be sent, the page says nothing was sent and offers Try again or a direct message.', er, a=None)

# 12 report
rp = sheet('rp', '<h2>Jordan Reyes</h2><div class="list"><button class="row"><div class="grow"><b>Report</b><span>Spam, inappropriate content, harassment</span></div>' + SV['chev'] + '</button><button class="row"><div class="grow"><b>Block</b><span>They cannot message you</span></div>' + SV['chev'] + '</button></div><button class="btn gh" data-close="rp">Cancel</button>')
add('12 · Report or block', 'Report and block sit behind the three-dot menu, not on the profile itself, so the page stays about the decision.', prof[0], prof[1] + rp.replace('data-sheet="rp"', 'data-sheet="rp" data-autoopen'), a=None)

build('marketplace-new.html', 'Coach Connect Find a Trainer', '', 'Find a trainer',
      'The marketplace rebuilt in the new system with your real filter fields: the home banner, list, filters, map idea, no results, profile with trial and price, request, confirm, sent and error states. Tap the chips, filter switches and Try again.',
      S, lots=('zcoach',), extra_js=JS2, extra_css=CSS2)
