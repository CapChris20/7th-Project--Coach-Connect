from kit import *

CSS2 = r'''
.sr2{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 0;border-top:2px solid var(--bd);width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;font-size:16px;font-weight:700;cursor:pointer}
.list>.sr2:first-child{border-top:0}
.sr2 .grow{flex:1;min-width:0}.sr2 .grow b{display:block;font-size:16px;line-height:1.2}.sr2 .grow span{display:block;font-size:13px;color:var(--mut);font-weight:600;margin-top:2px}
.sr2 .val{font-size:14px;color:var(--mut);font-weight:700;white-space:nowrap}
.sr2.dng b{text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:4px}
.gh2{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.card.prof,.prof{display:flex;flex-direction:row;align-items:center;gap:12px}
.prof .grow{flex:1;min-width:0}.prof b{font-size:19px;display:block}.prof span{font-size:13px;color:var(--mut)}
.qa{display:flex;flex-direction:column}
.qa .q{display:flex;gap:10px;align-items:center;min-height:56px;padding:8px 0;border-top:2px solid var(--bd);width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;font-size:16px;font-weight:800;cursor:pointer;line-height:1.25}
.qa .q:first-child{border-top:0}
.qa .q span{flex:1}
.qa .a{padding:0 0 12px;font-size:15px;line-height:1.45;color:var(--mut)}
.hold{position:relative;min-height:56px;border:3px solid var(--bd);border-radius:10px;background:var(--chip);overflow:hidden;touch-action:none;cursor:pointer;display:grid;place-items:center;font-weight:900;font-size:16px;user-select:none}
.hold i{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--blk)}
.hold span{position:relative;mix-blend-mode:normal}
.hold.full{color:var(--on)}
.tag2{display:inline-flex;align-items:center;height:26px;padding:0 10px;border:2.5px solid var(--bd);border-radius:6px;font-size:12px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;background:var(--blk);color:var(--on)}
.pf{display:grid;grid-template-columns:1fr;gap:12px}
.rs{display:flex;flex-direction:column}
.rs button{display:flex;align-items:center;gap:12px;min-height:56px;border:0;border-top:2px solid var(--bd);background:none;padding:8px 0;font-size:16px;font-weight:700;text-align:left;cursor:pointer;width:100%}
.rs button:first-child{border-top:0}
.rs .rd{width:26px;height:26px;border:3px solid var(--bd);border-radius:50%;flex:none;display:grid;place-items:center}
.rs button[aria-pressed="true"] .rd{background:var(--blk)}
.rs button[aria-pressed="true"] .rd::after{content:"";width:8px;height:8px;border-radius:50%;background:var(--on)}
.doc h3{margin:0 0 4px;font-size:17px}
.doc p{font-size:15px;line-height:1.5;color:var(--mut)}
'''
JS2 = r'''
HOOKS.push(function(ph){
 $$('.rs',ph).forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$$('button',g).forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true')}));
 $$('.hold',ph).forEach(h=>{const f=$('i',h),t=$('span',h);let tw=null;
  const reset=()=>{if(tw)tw.kill();if(window.gsap)gsap.to(f,{width:'0%',duration:.25});h.classList.remove('full');t.textContent=h.dataset.label};
  const start=e=>{h.classList.add('full');if(window.gsap&&!RM){tw=gsap.to(f,{width:'100%',duration:1.6,ease:'none',onComplete:()=>{t.textContent='Confirmed (demo only)'}})}else{f.style.width='100%';t.textContent='Confirmed (demo only)'}};
  h.addEventListener('pointerdown',start);['pointerup','pointerleave','pointercancel'].forEach(ev=>h.addEventListener(ev,()=>{if(t.textContent.indexOf('Confirmed')<0)reset()}))});
 $$('.qa .q',ph).forEach(q=>q.addEventListener('click',()=>{const s=$('svg',q);if(s&&window.gsap)gsap.to(s,{rotate:q.dataset.o==='1'?0:90,duration:.25});q.dataset.o=q.dataset.o==='1'?'0':'1'}));
 const m=$('[data-scrollto]',ph);if(m)setTimeout(()=>{const s=$('.scr',ph);if(s)s.scrollTop=+m.dataset.scrollto},400);
});
'''
def row(t, val='', sub='', pl=None, dng=False, data=''):
    r = f'<span class="val">{val}</span>' if val else ''
    return f'<button class="sr2{" dng" if dng else ""}" {data}><div class="grow"><b>{t}</b>{("<span>" + sub + "</span>") if sub else ""}</div>{pl or ""}{r}{SV["chev"] if not dng else ""}</button>'
def group(label, rows):
    return f'<div class="gh2 rv">{label}</div><div class="card rv" style="padding:4px 14px"><div class="list">{rows}</div></div>'
def tog(t, sub, on=True): return f'<div class="sr2" style="cursor:default"><div class="grow"><b>{t}</b><span>{sub}</span></div><button class="sw" aria-pressed="{"true" if on else "false"}" aria-label="{t}"></button></div>'

S = []
def add(t, n, body, extra='', a='settings', mark=''):
    S.append(screen(t, n, body, (dock(a) if a else '') + extra))
def a_(s, n): return s.replace(f'data-sheet="{n}"', f'data-sheet="{n}" data-autoopen')
sc = lambda n: f'<div data-scrollto="{n}" hidden></div>'

# 1 settings client
prof = f'<div class="card rv prof">{av("AR")}<div class="grow"><b>Alex Rivera</b><span>Client · Jordan Reyes is your trainer</span></div><button class="btn gh sm2" style="width:auto;padding:0 12px">Edit</button></div>'
appear = group('Appearance', '<div style="padding:10px 0"><div class="seg rs2" data-nopick><button aria-pressed="true">Light</button><button aria-pressed="false">Dark</button><button aria-pressed="false">System</button></div></div>')
prefs = group('Preferences', tog('Workout reminders', 'Time to workout! at 6:00 PM on training days', True))
ai = group('AI features', tog('AI-powered features', 'AI Fitness Coach and workout generator are on.', True) + row('What you can use when AI is on', '', 'Coach chat, plan builder, photo feedback'))
bill = group('Billing', row('Coaching payment', '', 'Jordan Reyes · $75 per session', pill('Active')))
acct = group('Account', row('Edit profile') + row('Change password') + row('Blocked users', '0') + row('Sign out'))
sup = group('Support', row('Contact support') + row('Report a bug') + row('FAQ') + row('Terms of service') + row('Privacy policy') + row('Privacy and data rights') + row('Version', '2.4.0'))
danger = '<button class="sr2 dng rv" style="border:3px solid var(--bd);border-radius:10px;padding:8px 14px;background:var(--sf);min-height:56px" data-open="del"><div class="grow"><b>Delete account</b><span>Permanently removes your data</span></div></button>'
settings_body = lambda s=0: (sc(s) if s else '') + top('Settings') + prof + appear + prefs + ai + bill + acct + sup + danger
add('1 · Settings', 'Settings is grouped in the same order as your screen: Appearance, Preferences, AI features, Billing, Account, Support. Each group is one card of plain rows, with the status as a word on the row. Delete account is separated at the bottom.', settings_body(0))
add('2 · Settings, lower half', 'The same page scrolled to Account, Support and the delete button, so the long list is visible without a tall frame.', settings_body(760))

# 3 trainer settings
pay = group('Payments and payouts', row('Identity verification (Face ID)', '', 'Required before payouts', pill('Verified')) + row('Payment method (Stripe)', 'Visa 4242') + row('Payout account', '', 'Verification in progress', pill('In review', 'n')) + row('Earnings and payouts', '$1,240'))
pro = group('Coach Connect Pro', row('Platform subscription', '', 'Free trial ends in 9 days', pill('Trial')) + row('Restore purchases'))
tr = (top('Settings', sub='Trainer') + f'<div class="card rv prof">{av("JR")}<div class="grow"><b>Jordan Reyes</b><span>Trainer · 3 clients</span></div><button class="btn gh sm2" style="width:auto;padding:0 12px">Edit</button></div>' + pay + pro + appear + ai + group('Account', row('Edit profile') + row('Change password') + row('Blocked users', '1') + row('Sign out')))
add('3 · Settings, trainer', 'A trainer sees two more groups on top: Payments and payouts, and Coach Connect Pro. Verification and payout state are words in pills, so a stuck payout is obvious.', tr)

# 4 billing pair
def billing(data=True):
    h = top('Coaching payment')
    if not data:
        return h + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('scales', 'lg') + '<h1>No active subscription</h1><p class="mut">You pay your trainer through Coach Connect once you have one. Add a payment method now so booking is quick.</p><button class="btn">Add payment method</button></div>'
    return (h + '<div class="card blk rv" style="gap:6px;border-radius:6px 24px 6px 6px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="gh2" style="color:var(--on);opacity:.7">Coaching with Jordan Reyes</span>' + pill('Active') + '</div><div class="num" style="font-size:44px;line-height:1">$75<span style="font-size:18px;opacity:.7"> / session</span></div><p style="opacity:.8">Next charge Dec 1. Billed per completed session.</p></div>'
        '<div class="card rv" style="flex-direction:row;align-items:center;gap:12px"><div class="ib g4" style="display:grid"><i class="im i-scales"></i></div><div style="flex:1;min-width:0"><b>Visa ending 4242</b><p class="sm mut">Expires 08/28</p></div><button class="btn gh sm2" style="width:auto;padding:0 12px">Update</button></div>'
        '<div class="gh2 rv">Recent charges</div><div class="card rv" style="padding:4px 14px"><div class="list">' + ''.join(f'<div class="sr2" style="cursor:default"><div class="grow"><b>{d}</b><span>{s}</span></div><b class="num">{v}</b>{p}</div>' for d, s, v, p in [('Nov 10', 'Lower body', '$75', pill('Paid', 'n')), ('Nov 5', 'Upper body', '$75', pill('Paid', 'n')), ('Oct 31', 'Check-in call', '$75', pill('Past due', 'g2'))]) + '</div></div>')
S.append(screen('4 · Coaching payment', 'The plan is one black card with the rate and the next charge, then the card on file, then charges with a plain Paid or Past due. The empty side is the real No active subscription state.', billing(True), dock('settings'), lab='With a trainer'))
S.append(screen('x', 'x', billing(False), dock('settings'), lab='No subscription', second=True))

# 5 profile
def fldr(l, v): return f'<div class="fld"><label>{l}</label><input value="{v}"></div>'
cp = (top('Edit profile', sub='Keep your details current for a tailored experience.') +
  '<div class="seg rv" data-tabs="pf"><button data-t="c" aria-pressed="true">Your profile</button><button data-t="t" aria-pressed="false">Trainer profile</button></div>'
  '<div data-p="pf:c" class="pf">' + fldr('Full name', 'Alex Rivera') + fldr('Display name', 'Alex') +
  '<div class="card rv"><div class="list">' + ''.join(row(a, b) for a, b in [('Weight', '172 lb'), ('Height', "5'11\""), ('Gender', 'Male'), ('Fitness level', 'Intermediate'), ('Primary goal', 'Build Muscle'), ('Equipment', 'Dumbbells, pull-up bar'), ('Training frequency', '4 days')]) + '</div></div></div>'
  '<div data-p="pf:t" hidden class="pf"><div class="gh2">Trainer profile</div>' + fldr('City / region', 'Austin, TX') + '<div class="fld"><label>Public bio</label><textarea rows="3">Strength coach. I build plans you can repeat for years.</textarea></div>' + fldr('Website', 'jordanreyes.fit') + fldr('Instagram', '@jordanreyes.fit') + '<div class="fld"><label>Coaching philosophy</label><textarea rows="2">Strong first, pretty second.</textarea></div><p class="sm mut">Visible to clients on your profile.</p></div>'
  '<button class="btn rv">Save changes</button>')
add('5 · Edit profile', 'One profile screen with a tab for the trainer profile. The details that drive plans are rows you tap to change, and the text fields are real inputs. The page says what each part is for.', cp, '', a=None)

# 6 change password
pw = (top('Change password') + '<div class="fld rv"><label for="p1">Current password</label><input id="p1" type="password" value="oldpass12"></div><div class="fld rv"><label for="p2">New password</label><input id="p2" type="password" value="newpass345"></div><div class="fld rv"><label for="p3">Confirm new password</label><input id="p3" type="password" value="newpass345"></div>'
  '<div class="card flat rv" style="gap:6px"><b>Password updated successfully.</b><p class="sm mut">This is the success message, shown after saving.</p></div><button class="btn rv">Update password</button>')
add('6 · Change password', 'Three fields and one button. The success message is quoted from your app and appears on the same page.', pw, '', a=None)

# 7 FAQ
faq = [('How do I generate a workout?', 'Open Workout, tap New plan, check the facts from your profile, then Generate plan. You get a limited number each month.'),
       ('How do clients pay their trainer?', 'Through Coach Connect once you have a trainer. Your trainer sets the rate and you see every charge under Coaching payment.'),
       ('Is this medical advice?', 'No. For medical concerns, talk to a licensed professional.'),
       ('How do I delete my account?', 'Settings, Delete account, then hold the confirm button. Your account and data are permanently deleted.'),
       ('Can I watch exercise videos without internet?', 'No. Videos come from search results and need a connection.'),
       ('How does progress tracking actually work?', 'Your logs feed charts and a weekly report that builds itself from what you log.')]
fq = top('FAQ') + '<div class="fld rv"><input aria-label="Search" placeholder="Search questions"></div><div class="card rv" style="padding:4px 14px"><div class="qa">' + ''.join(f'<button class="q" data-toggle="f{i}"><span>{q}</span>{SV["chev"]}</button><div class="a" data-p="f{i}" {"" if i == 0 else "hidden"}>{a}</div>' for i, (q, a) in enumerate(faq)) + '</div></div>' + \
     '<div class="card flat rv" style="gap:8px"><b>More common questions</b><p class="mut">Still stuck? Tell us what you were doing.</p><button class="btn">Contact support</button></div>'
add('7 · FAQ', 'Questions are an accordion with the answer opening under the question. Tap a question. Answers here are my short versions of the topics in your FAQ.', fq, '', a=None)

# 8 contact
topics = ['Signing in', 'Using the app', 'Payments and billing', 'AI Coach', 'Privacy']
ct = (top('Contact support', sub='Coach Connect support') + '<div class="gh2 rv">What is it about?</div><div class="chips rv" data-single data-g="tp">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if t == "Signing in" else "false"}">{t}</button>' for t in topics) + '</div>'
  '<p class="sm mut rv">For sign-in issues, try Forgot password first.</p><div class="fld rv"><label for="sj">Subject</label><input id="sj" value="Cannot sign in on a new phone"></div><div class="fld rv"><label for="ms">Message</label><textarea id="ms" rows="5">I installed the app on my new phone and it says the email is not found. It worked on my old phone.</textarea></div><button class="btn rv">Send message</button><button class="btn gh rv">Email us instead</button>')
add('8 · Contact support', 'The topic is a chip row so your message is routed before it is written. Subject and message are required, like your validation messages.', ct, '', a=None)

# 9 bug
bg = (top('Report a bug', sub='Help us make it better.') + '<div class="fld rv"><label for="b1">What you were trying to do</label><textarea id="b1" rows="2">Log my lunch with a barcode.</textarea></div><div class="fld rv"><label for="b2">What happened instead</label><textarea id="b2" rows="3">The scanner opened, found the product, then the app closed.</textarea></div><div class="fld rv"><label for="b3">Rough date and time</label><input id="b3" value="Today, about 12:30 PM"></div><div class="fld rv"><label for="b4">Device (optional)</label><input id="b4" value="iPhone 15"></div>'
  '<div class="up rv" style="display:flex;align-items:center;gap:12px;min-height:72px;padding:12px;border:3px dashed var(--bd);border-radius:10px">' + ib('picture') + '<div><b>Screenshots if something looks wrong</b><p class="sm mut">Optional. Up to 3 images</p></div></div><button class="btn rv">Send bug report</button>')
add('9 · Report a bug', 'Four short fields, with the two that matter first. Device is optional. Screenshots are an upload row, not a hidden option.', bg, '', a=None)

# 10 terms
sections = ['Your account', 'The service', 'Content you upload', 'Acceptable use', 'Human trainers', 'Not medical advice', 'Limitation of liability', 'Changes', 'Contact']
tm = (top('Terms of service', sub='Updated September 23, 2026') + '<div class="card blk rv doc" style="gap:6px"><span class="gh2" style="color:var(--on);opacity:.7">Plain summary</span><p style="color:var(--on);opacity:.9">These terms explain the rules for using Coach Connect. If you use the app, you agree to them. We keep them friendly and plain.</p></div>'
  '<div class="card rv" style="padding:4px 14px"><div class="qa">' + ''.join(f'<button class="q" data-toggle="t{i}"><span>{s}</span>{SV["chev"]}</button><div class="a" data-p="t{i}" {"" if i == 0 else "hidden"}>{"Keep your login private. Tell us if you think someone else accessed your account." if i == 0 else "Section text goes here."}</div>' for i, s in enumerate(sections)) + '</div></div>')
add('10 · Terms of service', 'A plain-language summary comes first in a black block, then each section is a collapsed row. Only Your account is open so the first screen shows what the document looks like.', tm, '', a=None)

# 11 privacy
pv = (top('Privacy and data rights') + '<div class="card rv doc" style="gap:8px"><h3>What you can do with your data</h3><p>Ask for a copy, correct it, or delete it. Privacy questions or requests about your data go to Coach Connect support.</p></div>'
  + group('Your data', row('Export my data', '', 'A copy of your logs and plans') + row('Privacy policy', 'May 9, 2026')) + group('AI features', tog('AI-powered features', 'Your answers are sent to the AI provider to personalize replies.', True)) +
  '<button class="sr2 dng rv" style="border:3px solid var(--bd);border-radius:10px;padding:8px 14px;background:var(--sf);min-height:56px" data-open="del"><div class="grow"><b>Delete account</b><span>Permanently removes your data</span></div></button>')
delsheet = sheet('del', '<span class="pill g2" style="align-self:flex-start">Cannot be undone</span><h2>Delete account?</h2><p class="mut">Your account and data will be permanently deleted. Press and hold the button to confirm.</p><div class="hold" data-label="Hold to confirm"><i></i><span>Hold to confirm</span></div><button class="btn gh" data-close="del">Cancel</button>')
add('11 · Privacy and data rights', 'Data rights are three things you can do, with the AI switch repeated here so it is not hidden. Delete account is the same black-outlined row as in Settings.', pv, delsheet, a=None)
add('12 · Delete account', 'Deleting needs a press and hold, not a tap. Press and hold the button: the fill crosses the button over about a second and a half, and letting go resets it. It cannot be done by accident.', pv, a_(delsheet, 'del'), a=None)

# 13 blocked + report
def brow(i, n, s): return f'<div class="sr2" style="cursor:default">{av(i)}<div class="grow"><b>{n}</b><span>{s}</span></div><button class="btn gh sm2" style="width:auto;padding:0 12px" data-open="unb">Unblock</button></div>'
bl = (top('Blocked users') + '<div class="card rv" style="padding:4px 14px"><div class="list">' + brow('RT', 'Riley T.', 'Blocked Oct 28 · Harassment or bullying') + '</div></div><p class="sm mut rv">Blocked people cannot message you or see your profile. You can unblock anyone here.</p>'
      '<button class="btn gh rv" data-open="rep">Report or block someone (example)</button>')
unb = sheet('unb', '<h2>Unblock this user?</h2><p class="mut">Riley T. will be able to message you and see your profile again.</p><div style="display:flex;gap:10px"><button class="btn gh" data-close="unb" style="flex:1">Cancel</button><button class="btn" data-close="unb" style="flex:1.2">Unblock</button></div>')
rep = sheet('rep', '<h2>Why are you reporting?</h2><div class="rs">' + ''.join(f'<button aria-pressed="{"true" if i == 0 else "false"}"><span class="rd"></span>{t}</button>' for i, t in enumerate(['Harassment or bullying', 'Inappropriate content', 'Spam or scam', 'Something else'])) + '</div><div class="card flat" style="flex-direction:row;align-items:center;gap:12px"><div style="flex:1"><b>Also block this person</b><p class="sm mut">They will not be able to message you</p></div><button class="sw" aria-pressed="true" aria-label="Also block"></button></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="rep" style="flex:1">Cancel</button><button class="btn" data-close="rep" style="flex:1.3">Send report</button></div>')
add('13 · Blocked users', 'Blocked users are rows with the reason and an Unblock button that asks first. A short line says what blocking does.', bl, unb + rep, a=None)
add('14 · Report or block', 'Reporting is a single choice list plus a switch to block at the same time, so one sheet does both jobs.', bl, rep.replace('data-sheet="rep"', 'data-sheet="rep" data-autoopen') + unb, a=None)

# 15 remove trainer
rt = (top('Your trainer') + '<div class="card rv prof">' + av('JR') + '<div class="grow"><b>Jordan Reyes</b><span>Your trainer since Sep 3</span></div></div><button class="btn gh rv" data-open="rm">Remove trainer</button>')
rm = sheet('rm', '<span class="pill g2" style="align-self:flex-start">Ends coaching</span><h2>Remove Jordan as your trainer?</h2><p class="mut">Why are you leaving? This helps other clients and Jordan.</p><div class="chips" data-single data-g="rr">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if t == "Not seeing results" else "false"}">{t}</button>' for t in ['Found a different trainer', 'Not seeing results', 'Poor communication', 'Scheduling issues', 'Too expensive', 'Other']) + '</div>'
  '<div class="card flat" style="gap:6px"><b>What changes</b><p class="sm mut">Your plans stay on your phone. Jordan stops seeing new logs. Billing for future sessions stops.</p></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="rm" style="flex:1">Keep Jordan</button><button class="btn" data-close="rm" style="flex:1.3">Remove trainer</button></div>')
add('15 · Remove trainer', 'Removing a trainer asks why, with your six reasons as chips, and says exactly what changes before the button.', rt, a_(rm, 'rm'), a=None)

build('settings-and-profile.html', 'Coach Connect Settings and Profile', '', 'Settings and profile',
      'Settings for clients and trainers in the same order as your app, plus payment, profile, help, contact, bug report, terms, privacy, delete account with press and hold, blocked users, report and block, and remove trainer.',
      S, extra_js=JS2, extra_css=CSS2)
