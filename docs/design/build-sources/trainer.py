from kit import *

def chips(items, on, grp, mx=5):
    return '<div class="chips" data-g="%s" data-max="%d">%s</div>' % (grp, mx, ''.join(
        '<button class="chip" aria-pressed="%s">%s<span class="tick">%s</span></button>' % ('true' if i in on else 'false', i, SV['check']) for i in items))

S = []

# 1 Specialties
spec = ['Strength','Fat loss','Mobility','Hypertrophy','Powerlifting','Boxing','Postnatal','Senior fitness','Return from injury','Sports prep','Nutrition coaching','Calisthenics']
S.append(screen('1 · Your craft', 'Chapter 1 of 3. Specialties are capped at five so clients can tell you apart. The count updates as you pick, and a sixth pick shakes the group instead of failing silently.',
 top('Set up your profile', sub='About 4 minutes') + steps(0) +
 '<div class="card hi rv" style="flex-direction:row;align-items:center;gap:10px"><div class="lot" data-l="spec"></div><div style="min-width:0"><h2>What do you coach best?</h2><p class="sm mut" style="margin-top:4px">Clients filter by these. Your first three count most.</p></div></div>' +
 sec('Specialties', '<span><b data-sum="spec" style="font-size:15px;color:var(--ink)">3</b> of 5</span>') +
 '<div class="rv">' + chips(spec, ['Strength','Fat loss','Mobility'], 'spec') + '</div>' +
 sec('Years coaching') +
 '<div class="card flat rv" style="flex-direction:row;align-items:center;justify-content:space-between"><div class="stepper"><button data-st="-1" aria-label="Fewer years">%s</button><output class="num" data-min="0" data-max="40">6</output><button data-st="1" aria-label="More years">%s</button></div><span class="pill %s">%s</span></div>' % (SV['minus'], SV['plus'], g(), 'Experienced') +
 '<div class="fld rv sr"><label for="ph1">Your coaching philosophy</label><textarea id="ph1" rows="3">Strong first, pretty second. I build programs around the lifts you can repeat for years.</textarea></div>' +
 '<button class="btn rv sr">Continue to proof %s</button>' % SV['chev']))

# 2 Certifications
def cert(n, i, st, ok):
    return ('<div class="row" style="cursor:default"><span class="cert-st">%s</span><div class="grow"><b>%s</b><span>%s</span></div>%s</div>' %
            (SV['check'] if ok else '…', n, i, pill(st) if ok else pill(st, 'n')))
S.append(screen('2 · Proof', 'Chapter 2 of 3. Credentials are rows with a status, not cards. Adding one opens a sheet that slides up inside the phone, and the upload target uses your picture icon.',
 top('Credentials') + steps(1) +
 '<div class="card sq0 rv" style="flex-direction:row;align-items:center;gap:10px"><div class="lot" data-l="cert"></div><div><h2>Show what you hold</h2><p class="sm mut" style="margin-top:4px">Clients see a badge next to each verified one.</p></div></div>' +
 sec('Your certifications', '<span>2 of 3 verified</span>') +
 '<div class="card rv"><div class="list">' +
 cert('NASM Certified Personal Trainer', 'NASM · 2019', 'Verified', True) +
 cert('Precision Nutrition Level 1', 'Precision Nutrition · 2021', 'Verified', True) +
 cert('Functional Movement Screen', 'FMS · 2024', 'In review', False) +
 '</div></div>' +
 '<button class="btn gh rv" data-open="cert">%s Add a certification</button>' % SV['plus'] +
 '<p class="sm mut rv sr">Reviews usually take one to two days. You can start taking clients while a credential is in review.</p>' +
 '<button class="btn rv sr">Continue to rates %s</button>' % SV['chev'],
 sheet('cert', '<h2>Add a certification</h2>'
  '<div class="fld"><label>Which one?</label><div class="chips" data-single data-g="c">' + ''.join('<button class="chip" aria-pressed="%s">%s</button>' % (('true' if c == 'ACE' else 'false'), c) for c in ['NASM','ACE','NSCA','ISSA','Other']) + '</div></div>'
  '<div class="fld"><label for="cy">Year earned</label><div class="stepper"><button data-st="-1" aria-label="Earlier">%s</button><output id="cy" class="num" data-min="1990" data-max="2026">2022</output><button data-st="1" aria-label="Later">%s</button></div></div>' % (SV['minus'], SV['plus']) +
  '<div class="up"><span class="ib %s"><i class="im i-picture"></i></span><div><b>Photo of your certificate</b><p class="sm mut">PNG or JPG, under 10 MB</p></div></div>'
  '<div style="display:flex;gap:10px"><button class="btn gh" data-close="cert" style="flex:1">Cancel</button><button class="btn" data-close="cert" style="flex:1.4">Submit for review</button></div>' % g())))

# 3 Rates
S.append(screen('3 · Rates', 'Chapter 3 of 3. Drag the price knob and the package totals and the client preview recalculate live. Longer packages carry a bigger discount, shown as the saving.',
 top('Your rates') + steps(2) +
 '<div class="card blk hi rv" style="gap:6px"><span class="eyb" style="color:var(--on);opacity:.7">Per one-hour session</span><div style="display:flex;align-items:baseline;gap:8px"><span class="num" style="font-size:64px;line-height:1" data-o="rate" data-v="75">$75</span><span class="mut">/ session</span></div>'
 '<div class="rng" data-min="30" data-max="200" data-step="5" data-val="75" data-out="rate"><div class="trk"><div class="fl %s"></div></div><div class="kb" aria-label="Session price"></div></div></div>' % g() +
 sec('How you train') +
 '<div class="seg rv" data-tabs="fmt"><button data-t="in" aria-pressed="false">In person</button><button data-t="on" aria-pressed="false">Online</button><button data-t="both" aria-pressed="true">Both</button></div>' +
 sec('Packages') +
 '<div class="card rv"><div class="list">' +
 ''.join('<div class="row" style="cursor:default">%s<div class="grow"><b>%s</b><span>%s</span></div><div style="text-align:right"><b class="num" style="font-size:20px;display:block" data-from="rate" data-mul="%d" data-disc="%d">$0</b></div></div>' % (
   ib(ic), nm, sub, m, d) for ic, nm, sub, m, d in [('schedule','Single session','Pay as you go',1,0),('week','4-session pack','5% off, one month',4,5),('journey','12-session pack','12% off, one quarter',12,12)]) +
 '</div></div>' +
 sec('Preview') +
 '<div class="card flat rv sr" style="flex-direction:row;align-items:center"><span class="av %s">YO</span><div class="grow" style="flex:1;min-width:0"><b>You, as clients see you</b><p class="sm mut">Strength, Fat loss, Mobility</p></div><div style="text-align:right"><span class="sm mut">from</span><b class="num" style="display:block;font-size:20px" data-from="rate" data-mul="1" data-disc="12">$0</b></div></div>' % g() +
 '<button class="btn rv sr">Get my invite code %s</button>' % SV['chev']))

# 4 Invite code
S.append(screen('4 · Invite code', 'Clients you already train join with this code instead of searching the marketplace. The three steps are a real sequence, so they are numbered.',
 top('Your trainer code') +
 '<div class="card blk sq0 rv" style="align-items:flex-start"><span class="eyb" style="color:var(--on);opacity:.7">Share this with current clients</span><div class="code" style="margin:4px 0">COACH-7K2F</div>'
 '<button class="btn gh sm2" data-copy="COACH-7K2F" style="margin-top:6px">%s <span>Copy code</span></button></div>' % SV['copy'] +
 '<div class="card flat rv" style="flex-direction:row;align-items:center"><div class="lot" data-l="code"></div><p class="sm mut" style="flex:1">Anyone who enters it is linked to you. You approve them before they see your plans.</p></div>' +
 sec('How it works') +
 '<div class="tl rv"><div class="st cur"><span class="n">1</span><div><b>You send the code</b><span>By text, email or in person</span></div></div>'
 '<div class="st"><span class="n">2</span><div><b>They enter it in the app</b><span>Under Find a trainer, Have a code</span></div></div>'
 '<div class="st"><span class="n">3</span><div><b>You approve the request</b><span>It lands in your Today timeline</span></div></div></div>' +
 sec('Send it') +
 '<div style="display:flex;gap:10px" class="rv sr"><button class="btn gh" style="flex:1">Message</button><button class="btn gh" style="flex:1" data-copy="coachconnect.app/join/COACH-7K2F"><span>Copy link</span></button></div>' +
 '<button class="btn rv sr">Review my profile %s</button>' % SV['chev']))

# 5 Review & go live
def rv(ic, n, v):
    return '<button class="row">%s<div class="grow"><b>%s</b><span>%s</span></div>%s</button>' % (ib(ic), n, v, SV['chev'])
S.append(screen('5 · Review and go live', 'One page that confirms all three chapters. Each row jumps back to edit. Going live asks once, in a sheet, and says exactly what becomes visible.',
 top('Review') +
 '<div class="card rv" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2>Profile complete</h2><span class="num" style="font-size:28px" data-count="100" data-suf="%">100%</span></div>' + bar(100) +
 '<p class="sm mut">One credential is still in review. It does not block going live.</p></div>' +
 '<div class="card rv"><div class="list">' +
 rv('muscle', 'Specialties', 'Strength, Fat loss, Mobility · 6 years') +
 rv('checkin', 'Credentials', '2 verified, 1 in review') +
 rv('scales', 'Rates', '$75 per session · 3 packages') +
 rv('people', 'Invite code', 'COACH-7K2F') + '</div></div>' +
 '<button class="btn rv" data-open="live">Go live in the marketplace</button>' +
 '<button class="btn gh rv sr">Save and finish later</button>',
 sheet('live', '<h2>Go live now?</h2><p class="mut">New clients will see this on Find a trainer:</p>'
  '<div class="list"><div class="row" style="cursor:default;min-height:48px"><span class="cert-st">%s</span><div class="grow"><b>Your name, photo and bio</b></div></div><div class="row" style="cursor:default;min-height:48px"><span class="cert-st">%s</span><div class="grow"><b>Specialties and verified badges</b></div></div><div class="row" style="cursor:default;min-height:48px"><span class="cert-st">%s</span><div class="grow"><b>Your rates</b></div></div></div>'
  '<div style="display:flex;gap:10px"><button class="btn gh" data-close="live" style="flex:1">Not yet</button><button class="btn" data-close="live" style="flex:1.3">Go live</button></div>' % (SV['check'], SV['check'], SV['check']))))

build('trainer-setup.html', 'Coach Connect Trainer Setup', '', 'Trainer setup',
      'Five screens that take a new trainer from specialties to going live. Tap, drag the price knob, open the sheets, and switch between light and dark.', S,
      lots=('spec', 'cert', 'code'))
