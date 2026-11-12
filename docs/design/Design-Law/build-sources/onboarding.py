from kit import *

CSS2 = r'''
.chip.tile{display:flex;flex-direction:column;align-items:flex-start;gap:10px;white-space:normal;border-radius:10px;min-height:96px;padding:12px;text-align:left;width:100%;position:relative;font-size:15px;line-height:1.15}
.chip.tile .tick{position:absolute;top:10px;right:10px}
.chip.tile small{display:block;font-weight:600;font-size:13px;opacity:.78;margin-top:3px;line-height:1.25}
.chip.tile[aria-pressed="true"] .ib{border-color:var(--on)}
.chip.tile.wide{flex-direction:row;align-items:center;min-height:64px;gap:12px}
.chip.tile.wide>span:last-child{flex:1;min-width:0}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tiles.one{grid-template-columns:1fr}
.tiles .span{grid-column:1/-1}
.bnav{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd);z-index:4}
.bnav .btn{flex:1}.bnav .btn.back{flex:none;width:56px;padding:0}
.stat{display:flex;flex-direction:column;gap:2px}
.stat .hd2{display:flex;align-items:center;gap:12px}
.stat .hd2 .grow{flex:1;min-width:0}
.stat .hd2 b{font-size:12px;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut);font-weight:900}
.stat .val{font-size:34px;line-height:1;white-space:nowrap}
.stat .val small{font-size:13px;color:var(--mut);letter-spacing:0;margin-left:4px}
.card .stat+.stat{border-top:2px solid var(--bd);padding-top:10px}
.days{display:flex;gap:6px}
.days i{flex:1;height:34px;border:3px solid var(--bd);border-radius:6px;background:var(--chip)}
.days i.on{background:var(--blk)}
.codein{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px!important;letter-spacing:4px;text-align:center;text-transform:uppercase}
.sv{display:flex;flex-direction:column;gap:10px}
.sv .seg button{font-size:13px;min-height:44px}
.cnt{font-size:12px;font-weight:800;color:var(--mut);text-align:right;font-variant-numeric:tabular-nums}
.chip.sm3{min-height:44px}
.chip .im.s{width:22px;height:22px}
'''
JS2 = r'''
HOOKS.push(function(ph){
 const upd=()=>{$$('.days',ph).forEach(d=>{const o=$('output',d.parentElement.parentElement)||$('output',ph);const v=+(o&&o.textContent)||0;$$('i',d).forEach((c,i)=>c.classList.toggle('on',i<v))})};
 ph.addEventListener('click',e=>{
  if(e.target.closest('[data-st]'))setTimeout(upd,0);
  const nl=e.target.closest('[data-nolim]');if(nl){setTimeout(()=>{const on=nl.getAttribute('aria-pressed')==='true';$$('[data-pa]',ph).forEach(x=>x.hidden=on);$$('[data-pb]',ph).forEach(x=>x.hidden=!on)},0)}
 });
 ph.addEventListener('input',e=>{if(e.target.matches('.story')){const c=$('[data-cnt]',ph);if(c)c.textContent=e.target.value.length+' / 600'}});
 upd();const s=$('.story',ph),c=$('[data-cnt]',ph);if(s&&c)c.textContent=s.value.length+' / 600';
 const big=$('.pop',ph);if(big&&window.gsap&&!RM)gsap.from(big,{scale:.5,duration:.8,ease:'elastic.out(1,.5)',clearProps:'transform'});
});
'''
SAFE = ''
def chapter(i, frac, lab, n, total=7):
    return steps(i, 3, frac) + '<div class="eyb rv"><span>Chapter %d of 3 · %s</span><span>%d / %d</span></div>' % (i + 1, lab, n, total)

def nav(label='Continue', back=True):
    return '<div class="bnav">%s<button class="btn">%s %s</button></div>' % ('<button class="btn gh back" aria-label="Back">%s</button>' % SV['back'] if back else '', label, SV['chev'])

def tile(label, ic, on=False, sub='', wide=False, cls=''):
    return ('<button class="chip tile%s%s" aria-pressed="%s">%s%s<span class="tick">%s</span></button>' %
            (' wide' if wide else '', ' ' + cls if cls else '', 'true' if on else 'false', ib(ic),
             '<span>%s%s</span>' % (label, '<small>%s</small>' % sub if sub else ''), SV['check']))

def stat(ic, lab, key, mn, mx, val, fmt='', suf='', cls=''):
    return ('<div class="stat">%s<div class="rng" data-min="%d" data-max="%d" data-step="1" data-val="%d" data-out="%s"><div class="trk"><div class="fl %s"></div></div><div class="kb" aria-label="%s"></div></div></div>' %
            ('<div class="hd2">%s<div class="grow"><b>%s</b></div><span class="num val" data-o="%s" data-pre="" %s%s>0</span></div>' % (ib(ic), lab, key, ('data-fmt="%s"' % fmt) if fmt else '', (' data-suf="%s"' % suf) if suf else ''),
             mn, mx, val, key, g(), lab))

S = []

# 1 basics
S.append(screen('1 · The basics', 'Weight, height and age are sliders with the live value beside them, so nobody types "5\'11" in the wrong format. Gender stays four plain choices.',
 top('About you') + chapter(0, 40, 'You', 1) +
 '<div style="display:flex;gap:10px;align-items:center" class="rv"><div style="flex:1;min-width:0"><h1>Tell us about yourself</h1><p class="sm mut" style="margin-top:6px">This helps us personalize your experience.</p></div><div class="lot" data-l="pers"></div></div>' +
 '<div class="card rv" style="gap:14px">' + stat('scales', 'Weight', 'w', 90, 400, 172, suf=' lbs') + stat('height', 'Height', 'h', 48, 84, 71, fmt='ftin') + stat('age', 'Age', 'a', 13, 90, 29, suf=' yrs') + '</div>' +
 sec('Gender') +
 '<div class="chips rv" data-single data-g="gen">' + ''.join('<button class="chip" aria-pressed="%s"><i class="im s i-%s"></i>%s</button>' % (('true' if t == 'Female' else 'false'), ic, t) for t, ic in [('Male', 'male'), ('Female', 'female'), ('Other', 'other'), ('Prefer not to say', 'pns')]) + '</div>',
 nav('Continue', back=False)))

# 2 goal + level
goals = [('Lose Fat', 'scales'), ('Build Muscle', 'muscle'), ('Maintain Health', 'hydration'), ('Athletic Performance', 'energy'), ('Improve Mental Health', 'stress'), ('Build Consistency & Habits', 'schedule')]
S.append(screen('2 · Goal and level', 'Two questions that used to be two screens. The goal is a tile grid with your icon art, and experience is three stacked rows because each one needs a description.',
 top('Your goal') + chapter(0, 85, 'You', 2) +
 '<div style="display:flex;gap:10px;align-items:center" class="rv"><h1 style="flex:1">What is your main goal?</h1><div class="lot" data-l="goal" style="width:84px;height:84px"></div></div>' +
 '<div class="tiles rv" data-single data-g="goal">' + ''.join(tile(n, ic, n == 'Build Muscle') for n, ic in goals) + '</div>' +
 sec('Fitness experience') +
 '<div class="tiles one rv" data-single data-g="exp">' + tile('Beginner', 'beginner', False, 'New to working out', True) + tile('Intermediate', 'inter', True, 'Work out regularly', True) + tile('Advanced', 'adv', False, 'Experienced athlete', True) + '</div>',
 nav()))

# 3 training setup
S.append(screen('3 · How you train', 'Equipment, place, days and time of day share one screen. The days stepper fills a seven-cell week so the number is something you can see.',
 top('Your setup') + chapter(1, 40, 'How you train', 3) +
 '<h1 class="rv">What can you train with?</h1>' +
 '<div class="tiles rv" data-g="eq">' + tile('Full Gym', 'gym', False) + tile('Dumbbells', 'dumbbells', True) + tile('Resistance Bands', 'bands', False) + tile('Pull-up Bar', 'pullup', True) + tile('Bodyweight Only', 'body', False, '', True, 'span') + '</div>' +
 sec('Where do you prefer to train?') +
 '<div class="seg rv"><button aria-pressed="true">Home</button><button aria-pressed="false">Gym</button><button aria-pressed="false">Both</button></div>' +
 sec('Days per week') +
 '<div class="card flat rv" style="gap:12px"><div style="display:flex;align-items:center;justify-content:space-between"><div class="stepper"><button data-st="-1" aria-label="Fewer days">%s</button><output class="num" data-min="1" data-max="7">4</output><button data-st="1" aria-label="More days">%s</button></div><span class="pill %s">sessions</span></div><div class="days"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>' % (SV['minus'], SV['plus'], g()) +
 sec('Best time of day') +
 '<div class="tiles rv" data-single data-g="tod">' + ''.join('<button class="chip tile" style="min-height:76px" aria-pressed="%s"><span>%s<small>%s</small></span><span class="tick">%s</span></button>' % (('true' if n == 'Evening' else 'false'), n, s, SV['check']) for n, s in [('Morning', '5am – 12pm'), ('Afternoon', '12pm – 5pm'), ('Evening', '5pm – 10pm'), ('No preference', 'Anytime works')]) + '</div>',
 nav()))

# 4 health
dis = ['Burpees', 'Running', 'Lunges', 'Deadlifts', 'Pull-ups', 'Jumping', 'Planks', 'Overhead press']
S.append(screen('4 · Injuries and limits', 'One switch removes the whole form when there is nothing to report, so the screen never asks for an empty answer. Dislikes are chips because they are a pick-from-list.',
 top('Health') + chapter(1, 85, 'How you train', 4) +
 '<div style="display:flex;gap:10px;align-items:center" class="rv"><div style="flex:1;min-width:0"><h1>Any injuries or limitations?</h1><p class="sm mut" style="margin-top:6px">We will help you work around them safely.</p></div><div class="lot" data-l="inj" style="width:84px;height:84px"></div></div>' +
 '<div class="card rv" style="gap:12px"><div style="display:flex;align-items:center;gap:12px">' + ib('injury') + '<b style="flex:1;font-size:16px">I have no limitations</b><button class="sw" data-nolim aria-pressed="false" aria-label="No limitations"></button></div>'
 '<div data-pa class="fld" style="gap:8px"><label for="inj1">Injuries or physical limitations</label><textarea id="inj1" rows="3" placeholder="e.g., lower back pain, knee issues, shoulder injury...">Left knee, sore on deep squats since March. Lower back is fine.</textarea><p class="sm mut">Be specific: area, movements that bother you, and whether it is recent or chronic.</p></div>'
 '<p data-pb hidden class="mut">Nothing noted. You can add limitations later from your profile.</p></div>' +
 sec('Exercises you would rather skip') +
 '<div class="chips rv" data-g="dis" data-max="8">' + ''.join('<button class="chip" aria-pressed="%s">%s<span class="tick">%s</span></button>' % ('true' if d in ('Burpees', 'Lunges') else 'false', d, SV['check']) for d in dis) + '</div>' +
 '<div class="fld rv sr"><label for="sup1">Supplements you take</label><input id="sup1" placeholder="e.g., creatine, protein, multivitamin..."></div>',
 nav()))

# 5 trainer
S.append(screen('5 · Your trainer', 'The yes/no is a switch between two panels, not two screens. A valid code shows who it matched before you continue.',
 top('Your trainer') + chapter(2, 25, 'Support', 5) +
 '<h1 class="rv">Do you have a trainer?</h1>'
 '<div class="seg rv" data-tabs="tr"><button data-t="y" aria-pressed="true">Yes, I have a code</button><button data-t="n" aria-pressed="false">Not yet</button></div>'
 '<div data-p="tr:y" style="display:flex;flex-direction:column;gap:16px"><div class="card flat" style="flex-direction:row;align-items:center;gap:8px"><div class="lot" data-l="code" style="width:84px;height:84px"></div><p class="sm mut" style="flex:1">Ask your trainer for their Coach Connect invite code. They approve you once it is entered.</p></div>'
 '<div class="fld"><label for="tc1">Trainer invite code</label><input id="tc1" class="codein" value="K7M-204" placeholder="ABC-123"></div>'
 '<div class="card" style="flex-direction:row;align-items:center">%s<div style="flex:1;min-width:0"><b>Jordan Reyes</b><p class="sm mut">Strength and mobility coach</p></div>%s</div><p class="sm mut">Sample match. Names here are demo data.</p></div>' % (av('JR'), pill('Code matched')) +
 '<div data-p="tr:n" hidden style="display:flex;flex-direction:column;gap:12px"><div class="card flat"><b>No problem.</b><p class="mut">You can browse trainers any time from Find a trainer. Until then the AI coach can guide your first weeks.</p></div></div>',
 nav()))

# 6 situation
def lvl(ic, lab, opts, on):
    return ('<div class="sv"><div style="display:flex;align-items:center;gap:12px">%s<b style="font-size:16px">%s</b></div><div class="seg">%s</div></div>' %
            (ib(ic), lab, ''.join('<button aria-pressed="%s">%s</button>' % ('true' if o == on else 'false', o) for o in opts)))
S.append(screen('6 · Your situation', 'The optional vitals are four quick segmented rows. The story field is the only required one on the screen, and its counter says how much room is left.',
 top('Your situation') + chapter(2, 60, 'Support', 6) +
 '<div><h1 class="rv">Describe your situation</h1><p class="sm mut rv" style="margin-top:6px">Vitals are optional. Your story is required.</p></div>' +
 sec('Optional vitals', pill('Optional', 'n')) +
 '<div class="card rv" style="gap:16px">' + lvl('stress', 'Stress level', ['Low', 'Moderate', 'High'], 'Moderate') + lvl('sleeping', 'Sleep quality', ['Poor', 'Fair', 'Good'], 'Fair') + lvl('energy', 'Energy', ['Low', 'Moderate', 'High'], 'Low') + lvl('hydration', 'Water per day', ['Under 4 cups', '4–8', '8+'], '4–8') + '</div>' +
 sec('Your story', pill('Required')) +
 '<div class="fld rv"><textarea class="story" id="st1" rows="5" aria-label="Your story">Desk job, two kids, and I have dropped training twice this year. I want to get back to lifting three days a week without burning out.</textarea><div class="cnt" data-cnt>0 / 600</div></div>',
 nav()))

# 7 AI
S.append(screen('7 · AI features', 'Permission is a full screen with the trade stated up front, and Not now is a real button with the same weight as the yes.',
 top('AI coach') + chapter(2, 95, 'Support', 7) +
 '<div class="card sq0 rv" style="align-items:center;padding:8px"><div class="lot lg" data-l="robot" style="width:100%%;height:170px"></div></div>'
 '<h1 class="rv">Turn on AI features?</h1>'
 '<div class="card flat rv"><div class="list">'
 '<div class="row" style="cursor:default">%s<div class="grow"><b>Ask the coach anything</b><span>Training, food and recovery questions</span></div></div>' % ib('people') +
 '<div class="row" style="cursor:default">%s<div class="grow"><b>Plan changes you approve</b><span>Nothing changes until you tap apply</span></div></div>' % ib('workout') +
 '<div class="row" style="cursor:default">%s<div class="grow"><b>Your answers personalize it</b><span>Sent to the AI provider to tailor replies</span></div></div></div></div>' % ib('checkin') +
 '<p class="sm mut rv">Replies are suggestions, not medical advice. You can switch this off any time in Settings.</p>',
 '<div class="bnav"><button class="btn gh">Not now</button><button class="btn">Turn on</button></div>'))

# 8 done
S.append(screen('8 · You are set', 'The last screen is a summary of what the plan will be built from, with counts that tick up. It confirms the choices instead of celebrating with confetti.',
 top('All set') + steps(2, 3, 100).replace('stp now', 'stp done') +
 '<div class="card blk hi rv pop" style="gap:4px"><span class="eyb" style="color:var(--on);opacity:.7">Your plan starts with</span><div style="display:flex;align-items:baseline;gap:8px"><span class="num" style="font-size:72px;line-height:1" data-count="4">4</span><b style="font-size:20px">days a week</b></div><p class="mut">Evenings, at home, for building muscle.</p></div>'
 '<div class="card rv"><div class="list">'
 '<div class="row" style="cursor:default">%s<div class="grow"><b>Intermediate</b><span>Goal: Build Muscle</span></div></div>' % ib('muscle') +
 '<div class="row" style="cursor:default">%s<div class="grow"><b>Dumbbells, pull-up bar</b><span>Training at home</span></div></div>' % ib('dumbbells') +
 '<div class="row" style="cursor:default">%s<div class="grow"><b>Left knee flagged</b><span>Burpees and lunges skipped</span></div></div>' % ib('injury') +
 '<div class="row" style="cursor:default">%s<div class="grow"><b>Trainer: Jordan Reyes</b><span>Waiting for approval</span></div></div></div></div>' % ib('people') +
 '<div class="lot" data-l="diet" style="width:100%;height:120px"></div>',
 '<div class="bnav"><button class="btn">Open my Today %s</button></div>' % SV['chev']))

build('client-onboarding.html', 'Coach Connect Client Onboarding', '', 'Client onboarding',
      'Eight screens in three chapters replace nine single-question steps. Drag the sliders, pick tiles, flip the no-limitations switch and the trainer tabs.',
      S, lots=('pers', 'goal', 'inj', 'code', 'robot', 'diet'), extra_js=JS2, extra_css=CSS2)
