from kit import *

CSS2 = r'''
.cmp{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;align-items:flex-end;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd);z-index:4}
.cmp .tf{flex:1;min-width:0;min-height:48px;border:3px solid var(--bd);border-radius:10px;background:var(--sf);padding:12px;font-size:15px;font-weight:700;display:flex;align-items:center;color:var(--mut)}
.cmp .sq{flex:none}
.cmp .sq.go{background:var(--blk);color:var(--on)}
.bub{align-self:flex-end;max-width:86%;background:var(--blk);color:var(--on);border:3px solid var(--bd);border-radius:16px 16px 4px 16px;padding:12px 14px;font-size:15px;line-height:1.4;font-weight:700;box-shadow:4px 4px 0 var(--sh)}
.who{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.reply{display:flex;flex-direction:column;gap:12px;max-width:100%}
.reply h3{margin:0;font-size:19px;letter-spacing:-.3px;font-weight:900}
.reply p{font-size:15px;line-height:1.5}
.reply ul{margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.reply li{list-style:none;display:flex;gap:10px;font-size:15px;line-height:1.4}
.reply li::before{content:"";width:10px;height:10px;margin-top:6px;flex:none;border:3px solid var(--bd);background:var(--blk)}
.reply b{font-weight:900}
.tools{display:flex;gap:8px;flex-wrap:wrap}
.tools .chip{min-height:44px;font-size:13px;padding:0 12px}
.sugg{display:flex;flex-direction:column}
.sugg button{display:flex;gap:10px;align-items:center;min-height:52px;padding:10px 0;border:0;border-top:2px solid var(--bd);background:none;text-align:left;font-size:15px;font-weight:700;cursor:pointer;line-height:1.3}
.sugg button:first-child{border-top:0}
.sugg button span{flex:1;min-width:0}
.src{display:flex;flex-direction:column;gap:6px;padding:12px;background:var(--sf);border:3px solid var(--bd);border-radius:10px;box-shadow:4px 4px 0 var(--sh);text-align:left;width:100%;cursor:pointer}
.src .dm{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}
.src b{font-size:15px;line-height:1.25}
.src span.s{font-size:13px;color:var(--mut);line-height:1.35}
.cat{display:flex;flex-direction:column;gap:10px}
.cat .ct{display:flex;align-items:center;gap:10px}
.cat .ct b{font-size:16px}
.ph{width:76px;height:96px;flex:none;border:3px solid var(--bd);border-radius:8px;position:relative;background:repeating-linear-gradient(135deg,var(--soft) 0 8px,var(--chip) 8px 16px);display:grid;place-items:end start;padding:4px 6px;font-size:12px;font-weight:900}
.ph button{position:absolute;top:-10px;right:-10px;width:30px;height:30px;border-radius:50%;border:3px solid var(--bd);background:var(--blk);color:var(--on);display:grid;place-items:center;padding:0;cursor:pointer}
.ph button svg{width:12px;height:12px}
.hrow{display:flex;gap:12px;padding-top:8px}
.swr{position:relative;overflow:hidden;border-top:2px solid var(--bd)}
.swr:first-of-type{border-top:0}
.swd{position:absolute;right:0;top:0;bottom:0;width:88px;background:var(--blk);color:var(--on);border:0;font-weight:900;font-size:14px;cursor:pointer}
.swi{position:relative;background:var(--sf);display:flex;gap:10px;align-items:center;min-height:56px;padding:8px 0;touch-action:pan-y;cursor:grab}
.swi .grow{flex:1;min-width:0}
.swi b{display:block;font-size:15px;line-height:1.25}
.swi span{font-size:13px;color:var(--mut)}
.gl{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut);padding-top:10px}
.ib.sm0{width:30px;height:30px;border-width:2.5px;border-radius:8px}.ib.sm0 .im{width:20px;height:20px}
.hero2{background:var(--blk);color:var(--on);border:3px solid var(--bd);border-radius:6px 26px 6px 6px;box-shadow:6px 6px 0 var(--sh);padding:14px 10px 14px 16px;display:grid;grid-template-columns:1fr 110px;gap:4px;align-items:center;overflow:hidden}
.hero2 .eyb{color:var(--on);opacity:.72}
.hero2 .q{font-size:28px;line-height:1;letter-spacing:-.9px;font-weight:900;margin:6px 0 8px}
.hero2 p{font-size:14px;opacity:.82;color:var(--on)}
.hero2 .lot{width:110px;height:110px;background:var(--on);border-radius:50%;border:3px solid var(--on)}
.hs3{display:flex;gap:10px;overflow-x:auto;margin:0 -16px;padding:2px 16px 8px;scrollbar-width:none;scroll-snap-type:x mandatory;scroll-padding:0 16px}
.hs3::-webkit-scrollbar{display:none}
.seec{flex:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px 0 8px;border:3px solid var(--bd);border-radius:999px;background:var(--sf);font-weight:800;font-size:14px;white-space:nowrap;scroll-snap-align:start}
.t4{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tl4{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-height:130px;padding:12px;border:3px solid var(--bd);border-radius:10px;background:var(--sf);box-shadow:4px 4px 0 var(--sh);text-align:left;cursor:pointer}
.tl4:nth-child(2){border-radius:10px 24px 10px 10px}.tl4:nth-child(3){border-radius:10px 10px 10px 24px}
.tl4 b{font-size:16px;line-height:1.15}.tl4 span{font-size:13px;color:var(--mut)}
.t2{display:flex;flex-direction:column;gap:12px}
.wide1{display:flex;align-items:center;gap:14px;min-height:80px;padding:12px;border:3px solid var(--bd);border-radius:10px;background:var(--blk);color:var(--on);text-align:left;cursor:pointer;box-shadow:4px 4px 0 var(--sh)}
.wide1+.wide1{background:var(--sf);color:var(--ink)}
.wide1 b{display:block;font-size:16px;line-height:1.2}.wide1 span{font-size:13px;opacity:.75}
.wide1 .ib{border-color:var(--on)}.wide1+.wide1 .ib{border-color:var(--bd)}
.ib.big0{width:52px;height:52px;border-radius:14px}.ib.big0 .im{width:34px;height:34px}
.resume{flex-direction:row;align-items:center;gap:12px;cursor:pointer;width:100%}
.pc2{flex:none;width:210px;min-height:120px;display:flex;flex-direction:column;justify-content:space-between;gap:10px;padding:12px;border:3px solid var(--bd);border-radius:10px;background:var(--soft);text-align:left;font-weight:700;font-size:15px;line-height:1.3;cursor:pointer;scroll-snap-align:start}
.typing{display:flex;gap:6px;align-items:center;height:20px}
.typing i{width:10px;height:10px;background:var(--blk);border:2.5px solid var(--bd);display:block}
'''
JS2 = r'''
HOOKS.push(function(ph){
 $$('.swi',ph).forEach(el=>{if(!(window.gsap&&window.Draggable))return;
  Draggable.create(el,{type:'x',bounds:{minX:-88,maxX:0},edgeResistance:.9,onDragEnd(){gsap.to(el,{x:this.x<-44?-88:0,duration:.35,ease:'back.out(1.6)'})}})});
 $$('.typing i',ph).forEach((d,i)=>{if(window.gsap&&!RM)gsap.to(d,{y:-5,duration:.35,repeat:-1,yoyo:true,delay:i*.12,ease:'sine.inOut'})});
});
'''
def composer(txt='Ask your coach anything', go=False, attach=True):
    return (f'<div class="cmp"><button class="sq" aria-label="Add photo or text" data-open="photo">{SV["plus"]}</button>'
            f'<div class="tf">{txt}</div><button class="sq go" aria-label="Send">{SV["send"]}</button></div>')

def coachtag(): return f'<div class="who">{ib("people")}<span>Coach</span></div>'.replace('class="ib', 'class="ib sm0 ib', 1)

def drawer(autoopen=True, extra=''):
    rows = [('Today', [('Fix my sleep this week', '8 messages'), ('Protein on training days', '5 messages')]), ('Yesterday', [('Deload or push on?', '12 messages'), ('Knee tight on squats', '6 messages')]), ('Earlier', [('Build me a 4-day split', '21 messages'), ('Creatine: what to expect', '4 messages')])]
    h = ''
    for lab, items in rows:
        h += f'<div class="gl">{lab}</div>'
        for t, s in items:
            h += f'<div class="swr"><button class="swd" data-open="del">Delete</button><div class="swi"><div class="grow"><b>{t}</b><span>{s}</span></div></div></div>'
    return (f'<div class="scrim" data-scrim="hist"></div><section class="sheet drawer" data-sheet="hist"{" data-autoopen" if autoopen else ""} style="gap:10px"><div style="display:flex;gap:10px;align-items:center"><h2 style="flex:1">Past chats</h2><button class="sq" data-close="hist" aria-label="Close">{SV["x"]}</button></div>'
            f'<button class="btn">{SV["plus"]} New chat</button><div class="fld"><input aria-label="Search chats" placeholder="Search your chats"></div><div style="overflow-y:auto;flex:1">{h}</div><p class="sm mut">Swipe a chat left to delete it.</p></section>')

S = []
CONV = (top('Your coach', right=f'<button class="sq" data-open="hist" aria-label="Past chats"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 7h16M4 12h16M4 17h10"/></svg></button>', back=True))

# 1 home
cats = [('Dashboard tools with one tap', 'workout', ['Can you log that I slept 8 hours last night?', 'Can you record my protein intake for today?', 'Can you show me my data and context?']),
        ('Form check or physique feedback', 'picture', ['Check my form in this photo and give coaching cues', 'Give me physique feedback from this progress photo']),
        ('Fitness web research', 'journey', ['Compare full-body vs PPL for busy schedules: what does evidence favor?', 'Given my training, how should I use creatine and what should I expect?'])]
body1 = (top('Ask your coach', right=f'<button class="sq" data-open="hist" aria-label="Past chats"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 7h16M4 12h16M4 17h10"/></svg></button>', back=False) +
 '<div class="card hi rv" style="flex-direction:row;align-items:center;gap:6px;padding:10px"><div class="lot" data-l="robot" style="width:92px;height:92px"></div><div style="flex:1;min-width:0"><h2>What do you want to work on?</h2><div style="margin-top:8px">' + pill('Fitness only') + '</div></div></div>' +
 ''.join(f'<div class="cat rv"><div class="ct">{ib(ic)}<b>{t}</b></div><div class="card flat" style="padding:4px 12px"><div class="sugg">' + ''.join(f'<button><span>{q}</span>{SV["chev"]}</button>' for q in qs) + '</div></div></div>' for t, ic, qs in cats))
tiles = [('sleeping', 'Log my sleep', 'Hours and quality'), ('stress', 'Log my mood', 'One tap, one note'), ('hydration', 'Log my water', 'Cups for today'), ('progress', 'Show my data', 'What the coach sees')]
sees = [('sleeping', 'Sleep 5.8 h avg'), ('protein', 'Protein 118 / 170 g'), ('injury', 'Left knee noted'), ('dumbbell', 'Lower body at 6:30')]
prompts = ['Based on my recent sleep, what should I change tonight?', 'Build me a 4-day split with clear progression for the next 2 weeks', 'Am I eating enough protein for my training load?', 'Help me improve my recovery this week']
body1 = (top('Ask your coach', right=f'<button class="sq" data-open="hist" aria-label="Past chats"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 7h16M4 12h16M4 17h10"/></svg></button>', back=False) +
 '<div class="hero2 rv"><div><span class="eyb">Fitness only</span><div class="q">What should we work on?</div><p>I can see your logs, your plan and your goals.</p></div><div class="lot" data-l="robot"></div></div>' +
 sec('The coach sees today') +
 '<div class="hs3 rv">' + ''.join(f'<span class="seec">{ib(ic).replace("class=\"ib ", "class=\"ib sm0 ")}{t}</span>' for ic, t in sees) + '</div>' +
 sec('Do it for me', '<span>One tap</span>') +
 '<div class="t4 rv">' + ''.join(f'<button class="tl4">{ib(ic)}<b>{t}</b><span>{s}</span></button>' for ic, t, s in tiles) + '</div>' +
 sec('Show it a photo or ask the web') +
 '<div class="t2 rv"><button class="wide1"><span class="ib g1 big0"><i class="im i-picture"></i></span><div><b>Form check or physique feedback</b><span>Send a photo or a video frame</span></div></button>'
 '<button class="wide1"><span class="ib g7 big0"><i class="im i-journey"></i></span><div><b>Fitness web research</b><span>Answers come with sources</span></div></button></div>' +
 sec('Pick up where you left off') +
 f'<button class="card rv resume" style="text-align:left"><div style="flex:1;min-width:0"><b style="font-size:17px">Fix my sleep this week</b><p class="sm mut">8 messages · today</p></div>{pill("Continue")}</button>' +
 sec('Or try asking') +
 '<div class="hs3 rv pr">' + ''.join(f'<button class="pc2"><span>{q}</span>{SV["chev"]}</button>' for q in prompts) + '</div>')
S.append(screen('1 · Coach home', 'The home is organized around what the coach can do for you, not a list of questions: what it can see about today, one-tap tools, photo and research modes, your last chat, and a few prompts to swipe through. Past chats are behind the menu button.', body1, composer() + drawer(False)))

# 2 conversation
body2 = (CONV +
 '<div class="bub rv">Based on my recent sleep, what should I change tonight?</div>' +
 f'<div class="reply rv">{coachtag()}<h3>Move bedtime earlier by 30 minutes</h3><p>Your last five nights average <b>6.4 hours</b>, and your energy rating drops the day after anything under 6.</p>'
 '<ul><li><span><b>Tonight:</b> lights out by 10:30 and no caffeine after 2 pm.</span></li><li><span><b>This week:</b> keep wake time fixed, even Saturday.</span></li><li><span><b>Training:</b> keep tomorrow\'s lower body session, but cap it at 3 hard sets per lift.</span></li></ul>'
 '<div class="tools"><button class="chip">Copy reply</button></div></div>' +
 f'<div class="card rv" style="gap:10px"><div style="display:flex;align-items:center;gap:10px">{pill("Ready to log")}<span class="sm mut">Needs your OK</span></div><b style="font-size:16px">Log sleep: 8 hours, last night</b><div style="display:flex;gap:8px"><button class="btn gh sm2" style="flex:1">Skip</button><button class="btn sm2" style="flex:1.4" data-open="confirm">Review</button></div></div>' +
 sec('Ask next') + '<div class="card flat rv" style="padding:4px 12px"><div class="sugg"><button><span>Help me build a wind-down routine that actually works</span>' + SV['chev'] + '</button><button><span>Should I push hard or deload this week?</span>' + SV['chev'] + '</button></div></div>')
cf = sheet('confirm', f'<span class="pill {g()}" style="align-self:flex-start">Coach wants to log</span><h2>Confirm Log sleep</h2>'
  '<div class="card flat"><div class="list"><div class="row" style="cursor:default;min-height:48px"><div class="grow"><b>Duration</b></div><b class="num" style="font-size:22px">8 hrs</b></div><div class="row" style="cursor:default;min-height:48px"><div class="grow"><b>Night of</b></div><b>Wed, last night</b></div></div></div>'
  '<div style="display:flex;gap:10px"><button class="btn gh" data-close="confirm" style="flex:1">Not now</button><button class="btn" data-close="confirm" style="flex:1.4">Log it</button></div>')
S.append(screen('2 · Conversation', 'The coach reply is formatted text, not a bubble: a headline, one sentence of evidence from your own logs, then three bullets. When it can act, the proposal appears as its own card with Review.', body2, composer() + cf))

# 3 internet
srcs = [('Training volume', 'Meta-analysis · sample source', 'Weekly sets per muscle and the size of the effect across 15 trials.'), ('Frequency and hypertrophy', 'Review · sample source', 'Two sessions a week per muscle matches higher frequencies when volume is equal.'), ('Practical guide', 'Coaching article · sample source', 'How to choose a split around work, travel and recovery.')]
body3 = (CONV + '<div class="bub rv">Compare full-body vs PPL for busy schedules. What does evidence favor?</div>' +
 f'<div class="reply rv">{coachtag()}{pill("Fitness web research", "n")}<h3>Full body wins when you can only train 3 days</h3><p>Muscle growth tracks weekly volume more than split style. Three full-body days hit each muscle often enough, and a missed day costs less.</p>'
 '<ul><li><span><b>3 days or fewer:</b> full body.</span></li><li><span><b>5 to 6 days:</b> PPL spreads volume without long sessions.</span></li></ul></div>' +
 sec('Sources', pill('Sample', 'n')) + ''.join(f'<button class="src rv"><span class="dm">{ib("journey").replace("class=\"ib ", "class=\"ib sm0 ")}{d}</span><b>{t}</b><span class="s">{s}</span></button>' for t, d, s in srcs))
S.append(screen('3 · Web research answer', 'Answers from the web say so with a tag, and each source is its own tappable card showing where it came from. These sources are placeholders for layout.', body3, composer()))

# 4 photo menu
pm = sheet('photo', '<h2>Choose an option</h2><div class="list">' + ''.join(f'<button class="row">{ib(ic)}<div class="grow"><b>{t}</b><span>{s}</span></div>{SV["chev"]}</button>' for ic, t, s in [('picture', 'Take a photo', 'Use the camera'), ('journey', 'Choose from library', 'Pick up to 4 photos'), ('progress', 'Analyze a progress photo', 'Physique feedback'), ('checkin', 'Paste text', 'A workout, a label, a message')]) + '</div>')
pm = pm.replace('data-sheet="photo"', 'data-sheet="photo" data-autoopen')
S.append(screen('4 · Add to message', 'One plus button opens one sheet with four ways to give the coach something to look at. The photo-analysis row is a shortcut, not a separate screen.', CONV + '<div class="bub rv">Can you analyze a photo for me?</div>' + f'<div class="reply rv">{coachtag()}<p>Yes. Send a front, side or back photo for physique feedback, or a video frame for a form check.</p></div>', composer() + pm))

# 5 photos attached
body5 = (CONV + sec('Ready to send', pill('2 photos', 'n')) +
 '<div class="hrow rv"><div class="ph">Side<button aria-label="Remove">' + SV['x'] + '</button></div><div class="ph">Front<button aria-label="Remove">' + SV['x'] + '</button></div></div>' +
 '<div class="card flat rv" style="padding:4px 12px"><div class="sugg"><button><span>Check my form in this photo and give coaching cues</span>' + SV['chev'] + '</button><button><span>Give me physique feedback from this progress photo</span>' + SV['chev'] + '</button></div></div>' +
 '<p class="sm mut rv">Photos are sent with your message. Remove any you do not want to share.</p>')
S.append(screen('5 · Photos attached', 'Attached photos sit above the composer as removable thumbnails, with the two prompts that make sense for photos one tap away.', body5, composer('Add a note, or just send')))

# 6 paste
pt = sheet('paste', '<h2>Paste text</h2><p class="mut">Add a workout, a nutrition label or a message. The coach reads it with your question.</p><div class="fld"><label for="pa1">Text</label><textarea id="pa1" rows="5">Wed: squat 3x8 135, RDL 3x10 115, split squat 2x10 25. Left knee tight on set 2.</textarea></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="paste" style="flex:1">Cancel</button><button class="btn" data-close="paste" style="flex:1.4">Add to message</button></div>')
pt = pt.replace('data-sheet="paste"', 'data-sheet="paste" data-autoopen')
S.append(screen('6 · Paste text', 'Pasting is a small sheet with one field, so it never replaces the conversation behind it.', CONV + '<div class="bub rv">Is this enough volume for legs?</div>', composer() + pt))

# 7 history drawer
S.append(screen('7 · Past chats', 'History is a drawer over the conversation, grouped by day. Drag a row left to reveal Delete, and the chat count tells you how long each thread is.', CONV + '<div class="bub rv">Based on my recent sleep, what should I change tonight?</div>' + f'<div class="reply rv">{coachtag()}<h3>Move bedtime earlier by 30 minutes</h3></div>', composer() + drawer(True)))

# 8 delete
dl = sheet('del', '<span class="pill g2" style="align-self:flex-start">Cannot be undone</span><h2>Delete chat?</h2><p class="mut">"Deload or push on?" and its 12 messages will be removed from this phone.</p><div style="display:flex;gap:10px"><button class="btn gh" data-close="del" style="flex:1">Keep it</button><button class="btn" data-close="del" style="flex:1.2">Delete chat</button></div>')
dl = dl.replace('data-sheet="del"', 'data-sheet="del" data-autoopen')
S.append(screen('8 · Delete chat', 'Deleting names the chat and the message count, and states it cannot be undone. Keep it is the first button.', CONV + '<div class="bub rv">Should I push hard or deload this week?</div>', composer() + dl))

build('ai-coach.html', 'Coach Connect AI Coach', '', 'AI coach',
      'The coach as a chat-first screen: home with starting prompts, a formatted reply with an action proposal, a web answer with sources, photo and paste sheets, and a past-chats drawer with swipe to delete.',
      S, lots=('robot',), extra_js=JS2, extra_css=CSS2)
