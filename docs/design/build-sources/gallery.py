import re, os, io, contextlib
from kit import *
with contextlib.redirect_stdout(io.StringIO()):
    import coach as C, workouts as W, home as H, thome as T

def css_of(name):
    src = open(os.path.join(B, name + '.py')).read()
    return re.search(r"CSS2 = r'''(.*?)'''", src, re.S).group(1)
def js_of(name):
    src = open(os.path.join(B, name + '.py')).read()
    return re.search(r"JS2 = r'''(.*?)'''", src, re.S).group(1)

CSS = css_of('coach') + css_of('workouts') + css_of('home') + css_of('thome') + r'''
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.vt.emp{border-style:dashed;box-shadow:none;background:transparent}
.vt.emp .l{color:var(--mut)}
.ring.z .fg{stroke:transparent}
.etxt{display:flex;flex-direction:column;gap:6px}
.codebox{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;font-size:30px;letter-spacing:3px;border:3px solid var(--bd);border-radius:8px;padding:10px 12px;text-align:center;background:var(--sf)}
.wr div.e b{color:var(--mut)}
'''
JS = js_of('coach') + js_of('workouts') + js_of('home') + js_of('thome')

def empty_card(title, text, btns=''):
    return f'<div class="card emp rv"><div class="etxt"><b style="font-size:17px">{title}</b><p class="mut">{text}</p></div>{btns}</div>'

# ---------- client dashboard ----------
def e_dash():
    hdr = f'<div class="hi rv">{av("AR")}<div class="grow"><small>Day 1</small><b>Welcome, Alex</b></div><button class="sq" aria-label="Notifications">{SV["bell"]}</button></div>'
    wel = '<div class="welcome rv"><div><span class="eyb">Daily motivation</span><div class="q">Keep showing up.</div><p>Log your first workout to start your week.</p></div><div class="lot" data-l="zlifter"></div></div>'
    week = (sec('Your week') +
            f'<div class="card emp rv" style="flex-direction:row;gap:14px;align-items:center"><div class="ring z"><svg viewBox="0 0 104 104"><circle class="tr" cx="52" cy="52" r="44"/><circle class="fg" cx="52" cy="52" r="44" data-pct="0"/></svg><div class="c"><div><b class="num">0</b><div class="sm mut">of 0</div></div></div></div>'
            f'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:10px"><b style="font-size:17px">No plan yet</b><p class="sm mut">A plan gives your week its sessions.</p><button class="btn sm2" style="width:100%">Build a plan</button></div></div>')
    nums = (sec("Today's numbers", '<span>Tap to log</span>') + '<div class="hs2 rv">' + ''.join(
        f'<button class="vt emp">{ib(ic)}<span class="l">{l}</span><span class="tap">Tap to log</span></button>' for ic, l in [('sleeping', 'Sleep'), ('hydration', 'Water'), ('scales', 'Weight'), ('workout', 'Steps')]) + '</div>')
    nut = sec('Nutrition today') + empty_card('No meals logged yet', 'Set your targets, then log your first meal.', '<button class="btn sm2" style="width:100%">Log a meal</button>')
    lg = sec('Workouts today') + empty_card('No workout logged yet', 'Add an exercise and its sets. Your trainer is told when you save.', f'<button class="btn gh sm2" style="width:100%">{SV["plus"]} Add exercise</button>')
    ck = sec('Daily check-in') + empty_card('Not logged yet', 'Soreness, energy, stress and mood open after your first workout.')
    return hdr + wel + H.no_trainer() + week + nums + nut + lg + ck + H.go_block()

# ---------- trainer home ----------
def e_th():
    needs = (sec('Needs you', '<span class="cnt">1</span>') +
             '<div class="card need rv"><div class="blockr"><b style="font-size:17px">Complete payout setup to accept clients</b><p class="sm" style="opacity:.8">You can share your invite code now. Clients wait until this is done.</p><button class="btn">Set up payouts</button></div></div>')
    cl = (sec('Your clients', '<span>0 of 0</span>') +
          f'<div class="card emp rv" style="gap:12px"><div class="etxt"><b style="font-size:17px">No clients yet</b><p class="mut">Clients you already train join with your invite code. New clients find you in the marketplace.</p></div><div class="codebox">COACH-7K2F</div><div style="display:flex;gap:8px"><button class="btn gh sm2" style="flex:1">{SV["copy"]} Copy code</button><button class="btn sm2" style="flex:1">List me</button></div></div>')
    wk = (sec('Weekly report') + '<div class="card emp rv" style="gap:12px"><div class="etxt"><b style="font-size:17px">Starts after your first week</b><p class="mut">Sessions, client logs and plan adherence show up here once a client is training with you.</p></div>'
          '<div class="wr"><div class="e"><b>0</b><span>Sessions done</span></div><div class="e"><b>0 / 0</b><span>Clients logged</span></div></div></div>')
    return T.header() + needs + cl + T.tools() + wk

# ---------- workouts ----------
def e_wk():
    return (top('My workout plan', sub='No plan yet') +
            f'<div class="card emp sq0 rv" style="align-items:flex-start;gap:12px">{ib("workout", "lg")}<h1>No plan saved yet.</h1><p class="mut">Build one from your profile with AI, or ask your trainer to write it.</p><button class="btn">Build with AI</button><button class="btn gh">Ask my trainer</button></div>'
            f'<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px"><div style="flex:1;min-width:0"><b>3 AI plans a month</b><p class="sm mut">You have used 0 so far</p></div>{pill("3 left")}</div>'
            f'<button class="row rv" style="border:3px solid var(--bd);border-radius:10px;padding:8px 12px;background:var(--sf);min-height:64px">{ib("journey")}<div class="grow"><b>Browse exercise videos</b><span>Works without a plan</span></div>{SV["chev"]}</button>')

# ---------- coach ----------
def e_coach():
    return (top('Ask your coach', back=False) +
            '<div class="hero2 rv"><div><span class="eyb">Fitness only</span><div class="q">What should we work on?</div><p>Log something and I can start using it.</p></div><div class="lot" data-l="robot"></div></div>' +
            sec('The coach sees today') + '<div class="hs3 rv"><span class="seec emp" style="border-style:dashed">Nothing logged yet</span></div>' +
            sec('Do it for me', '<span>One tap</span>') + '<div class="t4 rv">' + ''.join(f'<button class="tl4">{ib(ic)}<b>{t}</b><span>{s}</span></button>' for ic, t, s in C.tiles) + '</div>' +
            sec('Or try asking') + '<div class="hs3 rv pr">' + ''.join(f'<button class="pc2"><span>{q}</span>{SV["chev"]}</button>' for q in C.prompts[:3]) + '</div>')

S = []
def pair(title, note, empty_body, data_body, a, elab='Empty · first day', dlab='With data'):
    S.append(screen(title, note, empty_body, dock(a, ai=(a == "ai")), lab=elab))
    S.append(screen('x', 'x', data_body, dock(a, ai=(a == "ai")), lab=dlab, second=True))

pair('1 · Client dashboard', 'On day one the dashboard keeps every block but swaps numbers for one clear action each: build a plan, tap to log, log a meal. Dashed outlines mark what is empty.', e_dash(), H.dashboard(True), 'home')
pair('2 · Trainer home', 'With no clients, the carousel becomes the invite code and a way to list yourself. The weekly report says when it starts instead of showing zeros alone.', e_th(), T.home('p'), 'home')
pair('3 · My workout plan', 'No plan is the real No plan saved yet state, with the two ways to get one. With a plan, the week strip and the current session take over.', e_wk(), W.plan_home('p')[0], 'workout')
pair('4 · AI coach home', 'A new coach has nothing to see yet, so that strip says so. The resume card and personal prompts appear once there are logs and chats.', e_coach(), C.body1, 'ai')

build('empty-vs-data.html', 'Coach Connect Empty and Filled States', '', 'Empty and with data',
      'The same screens twice: on day one with nothing logged, and with a week of data. Scroll inside each phone to see the whole screen.',
      S, lots=('zlifter', 'zboxer', 'robot'), extra_js=JS, extra_css=CSS, mode='light')
