from kit import *

CSS2 = r'''
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.gl3{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.splash{position:absolute;inset:0;z-index:6;margin:0;background:var(--blk);color:var(--on);display:flex;flex-direction:column;justify-content:space-between;padding:70px 22px 48px}
.splash .wm b{display:block;font-size:62px;line-height:.92;letter-spacing:-3px;font-weight:900}
.splash .wm b+b{letter-spacing:-2px}
.splash p{font-size:15px;opacity:.8;margin-top:12px;font-style:italic;font-weight:800}
.dots{display:flex;gap:10px;align-items:flex-end;height:30px}
.dots i{width:14px;height:14px;background:var(--on);display:block}
.lbar{height:14px;border:3px solid var(--on);border-radius:7px;overflow:hidden;position:relative}
.lbar i{position:absolute;left:0;top:0;bottom:0;width:38%;background:var(--on)}
.sk{background:repeating-linear-gradient(135deg,var(--soft) 0 8px,var(--chip) 8px 16px);border:3px solid var(--bd);border-radius:8px}
.sk.ln{height:16px;border-radius:5px}
.sk.av2{width:44px;height:44px;border-radius:50%;flex:none}
.sk.bl{height:120px}
.skc{border:3px solid var(--bd);border-radius:10px;background:var(--sf);padding:14px;display:flex;flex-direction:column;gap:12px;box-shadow:5px 5px 0 var(--sh)}
.off{display:flex;align-items:center;gap:12px;background:var(--blk);color:var(--on);border:3px solid var(--bd);border-radius:8px;padding:10px 12px;box-shadow:4px 4px 0 var(--sh)}
.off .dot{width:12px;height:12px;border:3px solid var(--on);border-radius:50%;border-style:dashed;flex:none}
.off b{display:block;font-size:15px}.off span{font-size:13px;opacity:.8}
.off .btn{width:auto;min-height:44px;padding:0 14px;background:var(--on);color:var(--blk);border-color:var(--on);box-shadow:none;font-size:14px;margin-left:auto}
.errc{display:flex;flex-direction:column;gap:8px}
.errc .gl3{display:block}
.toast{display:flex;align-items:center;gap:12px;border:3px solid var(--bd);border-radius:8px;background:var(--sf);box-shadow:4px 4px 0 var(--sh);padding:10px 12px}
.toast.k{background:var(--blk);color:var(--on)}
.toast .t{flex:1;min-width:0}.toast b{display:block;font-size:15px}.toast span{font-size:13px;opacity:.8}
.toast .btn{width:auto;min-height:44px;padding:0 14px;font-size:14px;box-shadow:none}
.toast.k .btn{background:var(--on);color:var(--blk);border-color:var(--on)}
.msg{display:flex;gap:8px;align-items:flex-start;font-size:13px;font-weight:700;line-height:1.3}
.msg i{width:18px;height:18px;flex:none;border-radius:50%;background:var(--blk);color:var(--on);display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:900;margin-top:1px}
.fld.err input{border-style:dashed}
.big{font-size:56px;line-height:1;letter-spacing:-2px}
.vs{display:flex;gap:12px;align-items:center;min-height:56px;padding:8px 0;border-top:2px solid var(--bd)}
.vs:first-child{border-top:0}
.vs .st{width:28px;height:28px;border:3px solid var(--bd);border-radius:50%;display:grid;place-items:center;flex:none;background:var(--chip);color:var(--on)}
.vs.ok .st{background:var(--blk)}.vs.cur .st{border-style:dashed}
.vs .grow{flex:1;min-width:0}.vs .grow b{display:block;font-size:15px}.vs .grow span{font-size:13px;color:var(--mut)}
.spin{width:22px;height:22px;border:4px solid var(--soft);border-top-color:var(--ink);border-radius:50%;display:inline-block}
.btn .spin{border-color:rgba(128,128,128,.4);border-top-color:currentColor;width:18px;height:18px;border-width:3px}
.row2{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 0;border-top:2px solid var(--bd)}
.row2:first-child{border-top:0}
'''
JS2 = r'''
HOOKS.push(function(ph){
 if(window.gsap&&!RM){
  $$('.dots i',ph).forEach((d,i)=>gsap.to(d,{y:-12,duration:.4,repeat:-1,yoyo:true,delay:i*.14,ease:'sine.inOut'}));
  $$('.lbar i',ph).forEach(b=>gsap.fromTo(b,{x:'-100%'},{x:'270%',duration:1.3,repeat:-1,ease:'power1.inOut'}));
  $$('.sk',ph).forEach((s,i)=>gsap.to(s,{opacity:.55,duration:.9,repeat:-1,yoyo:true,delay:(i%5)*.12,ease:'sine.inOut'}));
  $$('.spin',ph).forEach(s=>gsap.to(s,{rotate:360,duration:.8,repeat:-1,ease:'none'}));
 }
 ph.addEventListener('click',e=>{const b=e.target.closest('[data-retry]');if(!b||b.dataset.busy)return;b.dataset.busy='1';const old=b.innerHTML;b.innerHTML='<span class="spin"></span> Trying';const sp=$('.spin',b);if(window.gsap&&!RM)gsap.to(sp,{rotate:360,duration:.8,repeat:-1,ease:'none'});setTimeout(()=>{b.innerHTML=old;delete b.dataset.busy},1400)});
});
'''
def spin(): return '<span class="spin"></span>'

S = []
def add(t, n, body, extra='', a=None, nodock=False):
    S.append(screen(t, n, body, (dock(a) if a else '') + extra, nodock=nodock))

# 1 splash
spl = ('<div class="splash"><div class="wm"><b>COACH</b><b>CONNECT</b><p>One Day or Day One!</p></div><div style="display:flex;flex-direction:column;gap:18px"><div class="dots"><i></i><i></i><i></i></div><div class="lbar"><i></i></div><span style="font-size:13px;font-weight:800;opacity:.8">Loading your plan and logs</span></div></div>')
add('1 · Startup', 'The first screen is the poster from the welcome page with three bouncing squares and a bar that slides, so the wait is the same brand and nothing stays still. The words say what is loading.', spl, nodock=True)

# 2 skeleton dashboard
sk = (f'<div class="rv" style="display:flex;gap:12px;align-items:center"><div class="sk av2"></div><div style="flex:1;display:flex;flex-direction:column;gap:8px"><div class="sk ln" style="width:40%"></div><div class="sk ln" style="width:70%"></div></div></div>'
  '<div class="sk bl rv" style="height:140px;border-radius:6px 26px 6px 6px"></div>'
  '<div class="gl3 rv">Your week</div><div class="skc rv"><div style="display:flex;gap:14px;align-items:center"><div class="sk" style="width:96px;height:96px;border-radius:50%"></div><div style="flex:1;display:flex;flex-direction:column;gap:10px"><div class="sk ln" style="width:60%"></div><div class="sk ln"></div><div class="sk ln" style="width:80%"></div></div></div></div>'
  '<div class="gl3 rv">Today\'s numbers</div><div style="display:flex;gap:12px" class="rv"><div class="sk" style="height:150px;flex:1"></div><div class="sk" style="height:150px;flex:1"></div></div>'
  '<div class="gl3 rv">Nutrition today</div><div class="skc rv"><div class="sk ln"></div><div class="sk ln" style="width:90%"></div><div class="sk ln" style="width:75%"></div></div>')
add('2 · Dashboard loading', 'Loading keeps the real layout: hatched blocks in the exact places the welcome card, week ring, number cards and nutrition will land. They pulse softly, with no shimmer or glow, and nothing jumps when data arrives.', sk, a='home')

# 3 list loading + inline
def skrow(): return '<div class="row2"><div class="sk av2"></div><div style="flex:1;display:flex;flex-direction:column;gap:8px"><div class="sk ln" style="width:45%"></div><div class="sk ln" style="width:80%"></div></div></div>'
lst = (top('Messages', back=False) + '<div class="card rv" style="padding:4px 14px"><div>' + skrow() * 5 + '</div></div>'
  '<div class="gl3 rv">Small loaders</div><div class="card flat rv" style="gap:14px"><div style="display:flex;align-items:center;gap:12px">' + spin() + '<b>Loading more clients</b></div>'
  '<button class="btn"><span class="spin"></span> Saving</button><button class="btn gh"><span class="spin"></span> Sending report</button></div>')
add('3 · List and button loading', 'Lists load as rows with an avatar and two lines. Buttons that wait keep their size and swap the label for a spinner and a present-tense word, so they never look broken or disabled.', lst, a='files')

# 4 certificate verification states
def certv(k):
    if k == 'p':
        return ('<div class="card rv" style="gap:12px;align-items:flex-start"><div style="display:flex;align-items:center;gap:12px">' + spin() + '<b style="font-size:17px">Verifying your certificate</b></div><div class="lbar" style="border-color:var(--bd)"><i style="background:var(--blk)"></i></div><p class="mut">Usually finishes in under a minute. You can keep going.</p></div>')
    if k == 'r':
        return ('<div class="card rv" style="gap:12px;align-items:flex-start">' + pill('Under review', 'n') + '<h2>A person is checking it</h2><p class="mut">The photo needs a closer look. You can keep taking clients while it is reviewed.</p></div>')
    if k == 'x':
        return ('<div class="card emp sq0 rv" style="gap:10px;align-items:flex-start">' + pill('Rejected', 'g2') + '<h2>We could not read it</h2><p class="mut">Upload a clearer photo of your certificate to try again.</p><button class="btn">Upload a new photo</button></div>')
    return ('<div class="card emp sq0 rv" style="gap:10px;align-items:flex-start">' + pill('Timed out', 'n') + '<h2>Verification timed out</h2><p class="mut">Your connection may be slow. Nothing was lost.</p><button class="btn" data-retry>Try again</button></div>')
def pan(k, a): return f'<div data-p="cv:{k}" {"" if k == a else "hidden"} style="display:flex;flex-direction:column;gap:16px">{certv(k)}</div>'
cv = (top('Certificate') + '<div class="seg sx rv" data-tabs="cv" style="overflow-x:auto"><button data-t="p" aria-pressed="true" style="flex:none;padding:0 14px">Checking</button><button data-t="r" aria-pressed="false" style="flex:none;padding:0 14px">Under review</button><button data-t="x" aria-pressed="false" style="flex:none;padding:0 14px">Rejected</button><button data-t="t" aria-pressed="false" style="flex:none;padding:0 14px">Timed out</button></div>'
  '<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px">' + ib('checkin') + '<div style="flex:1"><b>NASM Certified Personal Trainer</b><p class="sm mut">2019 · photo uploaded</p></div></div>'
  + ''.join(pan(k, 'p') for k in 'prxt'))
add('4 · Certificate check', 'A waiting task has four honest states: checking with a spinner and a promise of under a minute, under review by a person, rejected with what to do, and timed out with Try again. Tap the four tabs and press Try again.', cv, a=None)

# 5 offline
dash = ('<div class="off rv"><span class="dot"></span><div><b>You are offline</b><span>Showing what was saved on this phone</span></div><button class="btn" data-retry>Retry</button></div>'
  '<div class="hi rv" style="display:flex;gap:12px;align-items:center">' + av('AR') + '<div style="flex:1"><b style="font-size:19px">Good evening, Alex</b></div></div>'
  '<div class="card rv" style="flex-direction:row;gap:14px;align-items:center"><div style="flex:1"><span class="gl3">Your week</span><div class="num" style="font-size:36px;line-height:1.1">3 of 4</div><p class="sm mut">sessions done · saved 6:12 PM</p></div></div>'
  '<div class="card rv" style="gap:8px"><b>Workouts today</b><p class="mut">You can log sets now. They sync when you are back online.</p><button class="btn gh">Log a workout</button></div>'
  '<div class="toast rv"><div class="t"><b>2 changes waiting</b><span>Water and a note will send when you are online.</span></div></div>')
add('5 · Offline', 'Offline is a black bar that says what is true, the data on screen is still the last saved copy with its time, and anything you do is queued with a visible count. Press Retry to see the working state.', dash, a='home')

# 6 cannot reach
cr = (top('Workout plan') + '<div class="card emp sq0 rv errc" style="gap:12px"><span class="gl3">Could not reach Coach Connect API</span><h1>We could not load this.</h1><p class="mut">Check your connection, then try again. Your logs on this phone are safe.</p><button class="btn" data-retry>Try again</button><button class="btn gh">Contact support</button></div>')
add('6 · Cannot reach the server', 'The full-screen failure names the problem in one line, says your data is safe, and offers Try again first and support second.', cr, a='workout')

# 7 not found
nf = (top('Not found') + '<div class="card emp sq0 rv errc"><span class="gl3">Could not find that workout plan.</span><b style="font-size:18px">This plan was deleted or moved.</b><p class="mut">Open Saved plans to see the ones you have.</p><button class="btn gh">Saved plans</button></div>'
  '<div class="card emp sq0 rv errc"><span class="gl3">Trainer not found.</span><b style="font-size:18px">This trainer is no longer listed.</b><p class="mut">Go back to Find a trainer to pick someone else.</p><button class="btn gh">Find a trainer</button></div>'
  '<div class="card emp sq0 rv errc"><span class="gl3">Spreadsheet unavailable</span><b style="font-size:18px">Could not load this spreadsheet.</b><p class="mut">Your coach may have removed it. The copy you saved is still on your phone.</p><button class="btn gh" data-retry>Try again</button></div>')
add('7 · Not found states', 'Three real not-found cases from your app, each saying what is missing, why it may be, and one next step.', nf, a=None)

# 8 form and toast
fe = (top('Edit rate') + '<div class="fld err rv"><label for="rt">Rate per session</label><input id="rt" value="0"><div class="msg"><i>!</i><span>Enter a rate of at least $1.</span></div></div>'
  '<button class="btn rv">Save rate</button><div class="gl3 rv">Failed save</div><div class="toast k rv"><div class="t"><b>Could not update</b><span>Your rate was not saved. Nothing changed.</span></div><button class="btn" data-retry>Try again</button></div>'
  '<div class="gl3 rv">Partial failure</div><div class="toast rv"><div class="t"><b>Some files may not have been deleted.</b><span>Try again to finish.</span></div><button class="btn gh" data-retry>Try again</button></div>')
add('8 · Form errors and failed saves', 'Field errors sit under the field with a dashed border and a plain sentence. A failed save is a black toast that says nothing changed and puts Try again on the toast itself. Partial failures say which part did not finish.', fe, a=None)

# 9 session expired
exp = sheet('se', '<span class="pill g5" style="align-self:flex-start">Signed out</span><h2>Please sign in again.</h2><p class="mut">Your session ended. Your logs on this phone are kept and will sync after you sign in.</p><button class="btn" data-close="se">Sign in</button>')
add('9 · Session ended', 'When a sign-in expires, a sheet says so and keeps the page behind it, instead of throwing the person out.', dash, exp.replace('data-sheet="se"', 'data-sheet="se" data-autoopen'), a='home')

# 10 crash
cc = (top('Coach Connect', back=False) + '<div class="card blk rv" style="gap:8px;border-radius:6px 24px 6px 6px"><span class="gl3" style="color:var(--on);opacity:.7">Crash caught</span><div class="num big">:(</div><h1 style="color:var(--on)">Something went wrong</h1><p style="opacity:.85">The app hit a problem and stopped that screen. A report was sent so we can fix it. Nothing you saved was lost.</p></div>'
  '<button class="btn rv" data-retry>Try again</button><button class="btn gh rv">Open CoachConnect</button><div class="card flat rv" style="gap:6px"><b>What was sent</b><p class="sm mut">The error and which screen you were on. Not your messages, photos or logs.</p></div>')
add('10 · Crash screen', 'If a screen crashes, one black block names it plainly, says it was reported and what was and was not sent, and offers Try again. Press Try again to see the working state. The report text is my wording.', cc, nodock=True)

# 11 sign out
so = (top('Settings', back=False) + '<div class="card rv" style="padding:4px 14px"><div class="list"><div class="row" style="cursor:default"><div class="grow"><b>Edit profile</b></div>' + SV['chev'] + '</div><div class="row" style="cursor:default"><div class="grow"><b>Change password</b></div>' + SV['chev'] + '</div><button class="row" data-open="so"><div class="grow"><b>Sign Out</b></div></button></div></div>')
sos = sheet('so', '<h2>Sign Out</h2><p class="mut">Are you sure you want to sign out?</p><div class="card flat" style="gap:6px"><b>On this phone</b><p class="sm mut">Saved logs and downloaded files are cleared. They stay on your account.</p></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="so" style="flex:1">Cancel</button><button class="btn" style="flex:1.2" data-retry>Sign Out</button></div>')
add('11 · Sign out', 'Signing out asks once, says what is cleared from the phone and what stays on the account, and the button shows a spinner while it clears data. Press Sign Out to see it work.', so, sos.replace('data-sheet="so"', 'data-sheet="so" data-autoopen'), a='settings')

build('loading-and-errors.html', 'Coach Connect Loading and Errors', '', 'Loading and errors',
      'How the app waits and how it fails: the startup screen, skeleton loading in the real layout, button and list loaders, certificate check states, offline, cannot reach the server, not found, failed saves, session ended, the crash screen and sign out. Try the Retry and Try again buttons.',
      S, extra_js=JS2, extra_css=CSS2)
