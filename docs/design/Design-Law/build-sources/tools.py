from kit import *

CSS2 = r'''
.bub{align-self:flex-end;max-width:86%;background:var(--blk);color:var(--on);border:3px solid var(--bd);border-radius:16px 16px 4px 16px;padding:12px 14px;font-size:15px;line-height:1.4;font-weight:700;box-shadow:4px 4px 0 var(--sh)}
.who{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.ib.sm0{width:30px;height:30px;border-width:2.5px;border-radius:8px}.ib.sm0 .im{width:20px;height:20px}
.sheet h2{font-size:21px}
.pc{display:flex;align-items:center;gap:10px}
.pc .pill{flex:none}
.kv{display:flex;flex-direction:column}
.kv .r{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;border-top:2px solid var(--bd);font-size:15px}
.kv .r:first-child{border-top:0}
.kv .r span{color:var(--mut);font-size:13px;font-weight:800;letter-spacing:.8px;text-transform:uppercase}
.kv .r b{text-align:right}
.diff s{opacity:.55;margin-right:6px;font-weight:700}
.diff em{font-style:normal;font-weight:900}
.cups{display:flex;gap:6px}
.cups button{flex:1;height:44px;border:3px solid var(--bd);border-radius:6px 6px 14px 14px;background:var(--chip);cursor:pointer;padding:0}
.cups button.on{background:var(--blk)}
.big{font-size:52px;line-height:1}
.ends{display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:var(--mut);letter-spacing:.6px;text-transform:uppercase}
.mac3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mac3 div{border:3px solid var(--bd);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:4px;background:var(--chip)}
.mac3 .im{width:22px;height:22px}
.mac3 b{font-size:20px}.mac3 span{font-size:12px;color:var(--mut);font-weight:800}
.arrow{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}
.arrow .t{border:3px solid var(--bd);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--chip);min-height:96px}
.arrow .t.new{background:var(--blk);color:var(--on)}
.arrow .t.new .ib{border-color:var(--on)}
.arrow .t .lb{font-size:12px;font-weight:900;letter-spacing:1px;text-transform:uppercase;opacity:.7}
.arrow .t b{font-size:15px;line-height:1.15}
.btnrow{display:flex;gap:10px}
.btnrow .btn{flex:1}.btnrow .btn+.btn{flex:1.4}
'''
JS2 = r'''
HOOKS.push(function(ph){
 $$('.cups',ph).forEach(s=>{const set=n=>{$$('button',s).forEach((b,i)=>b.classList.toggle('on',i<n));const o=$('[data-cupv]',ph);if(o)o.textContent=n};
  s.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const n=$$('button',s).indexOf(b)+1;set(n);if(window.gsap&&!RM)gsap.fromTo(b,{scaleY:.6},{scaleY:1,duration:.5,ease:'elastic.out(1,.4)'})});set(+s.dataset.v||0)});
});
'''

CONVS = {}
def scene(user, coach):
    return (top('Your coach') + f'<div class="bub rv">{user}</div>' +
            f'<div class="who rv">{ib("people").replace("class=\"ib ", "class=\"ib sm0 ")}<span>Coach</span></div><p class="rv">{coach}</p>')

def popup(tag, title, body, ok, why, cancel='Not now', who='Coach wants to'):
    return sheet('p', f'<div class="pc"><span class="pill {g()}">{who} {tag}</span></div><h2>{title}</h2>{body}'
                      f'<div class="btnrow"><button class="btn gh" data-close="p">{cancel}</button><button class="btn" data-close="p">{ok}</button></div>').replace('data-sheet="p"', 'data-sheet="p" data-autoopen')

def kv(rows):
    return '<div class="card flat" style="padding:4px 12px"><div class="kv">' + ''.join(f'<div class="r"><span>{k}</span><b>{v}</b></div>' for k, v in rows) + '</div></div>'

def chips(items, on, single=True):
    return f'<div class="chips" {"data-single" if single else ""}>' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if i == on else "false"}">{i}</button>' for i in items) + '</div>'

def rngc(key, mn, mx, v, suf='', lab=''):
    return (f'<div style="display:flex;align-items:baseline;gap:6px"><span class="num big" data-o="{key}" data-v="{v}" data-pre="" data-suf="{suf}">{v}</span></div>'
            f'<div class="rng" data-min="{mn}" data-max="{mx}" data-step="{1 if mx < 100 else 100}" data-val="{v}" data-out="{key}"><div class="trk"><div class="fl {g()}"></div></div><div class="kb" aria-label="{lab}"></div></div>')

def fld(label, val, rows=0):
    return f'<div class="fld"><label>{label}</label>' + (f'<textarea rows="{rows}">{val}</textarea>' if rows else f'<input value="{val}">') + '</div>'

S = []
def add(n, t, note, scn, pop):
    S.append(screen(f'{n} · {t}', note, scn, pop))

add(1, 'Log meal', 'The coach read a food from your message. You can fix the meal and the numbers before anything is saved.', scene('I had a Greek yogurt bowl for breakfast', 'That is about 380 calories and 32 g of protein.'),
    popup('log a meal', 'Greek yogurt bowl', fld('Food', 'Greek yogurt bowl') + chips(['Breakfast', 'Lunch', 'Dinner', 'Snack'], 'Breakfast') +
          f'<div class="mac3"><div><i class="im i-protein"></i><b>32 g</b><span>Protein</span></div><div><i class="im i-carbs"></i><b>41 g</b><span>Carbs</span></div><div><i class="im i-fats"></i><b>9 g</b><span>Fats</span></div></div>', 'Log meal', ''))
add(2, 'Log mood', 'Five moods as chips, one pressed. The coach pre-selects the one it heard.', scene('Honestly just feeling flat today', 'That sounds like Tired. Want me to log it?'),
    popup('log your mood', 'How are you feeling?', chips(['Happy', 'Okay', 'Tired', 'Stressed', 'Anxious'], 'Tired') + fld('Note (optional)', 'Slept badly, long day at work'), 'Log mood', ''))
add(3, 'Log sleep', 'Hours and quality in one sheet. The number is large because it is the whole point.', scene('I slept about 8 hours last night', 'Logging 8 hours for last night.'),
    popup('log sleep', 'Last night', rngc('sl', 4, 12, 8, ' hrs', 'Hours slept') + '<div class="ends"><span>4 hrs</span><span>12 hrs</span></div>' + chips(['Poor', 'Fair', 'Good'], 'Good'), 'Log sleep', ''))
add(4, 'Log steps', 'Steps move in hundreds so the slider is usable with a thumb.', scene('I walked 6,400 steps so far', 'Adding 6,400 steps to today.'),
    popup('log steps', 'Steps today', rngc('stp', 0, 20000, 6400, '', 'Steps') + chips(['Today', 'Yesterday'], 'Today'), 'Log steps', ''))
add(5, 'Log water', 'Water is cups you tap, the same control as the Body tab.', scene('Had two glasses of water with lunch', 'That brings you to 5 of 8 cups.'),
    popup('log water', 'Water today', '<div style="display:flex;align-items:baseline;gap:8px"><span class="num big" data-cupv>5</span><b>of 8 cups</b></div><div class="cups" data-v="5">' + '<button aria-label="cup"></button>' * 8 + '</div>' + chips(['Today', 'Yesterday'], 'Today'), 'Log water', ''))
add(6, 'Rate energy', 'A one to eight slider with the ends named, so 3 is not a guess.', scene('My energy was pretty good this morning', 'I would say a 6 out of 8.'),
    popup('log your energy', 'Energy today', rngc('en', 1, 8, 6, ' / 8', 'Energy') + '<div class="ends"><span>Drained</span><span>Great</span></div>', 'Save rating', ''))
add(7, 'Rate workout', 'Post-workout rating is one to ten, with a note that goes to your trainer.', scene('That lower body session was rough but good', 'Rating it an 8 out of 10.'),
    popup('rate your workout', 'Lower body session', rngc('rw', 1, 10, 8, ' / 10', 'Workout rating') + '<div class="ends"><span>Awful</span><span>Best ever</span></div>' + fld('Note for Jordan', 'Knee fine after warm-up', 2), 'Save rating', ''))
add(8, 'Edit workout', 'Changes to your plan show as old value to new value, so the edit is explicit.', scene('Bump up my box squat and put it second', 'I would add a set and 10 lb, after the warm-up lift.'),
    popup('edit your workout', 'Box squat', '<div class="card flat" style="padding:4px 12px"><div class="kv diff"><div class="r"><span>Position</span><b><s>1</s><em>2</em></b></div><div class="r"><span>Sets</span><b><s>3</s><em>4</em></b></div><div class="r"><span>Reps</span><b>8</b></div><div class="r"><span>Weight</span><b><s>135 lb</s><em>145 lb</em></b></div></div></div>', 'Apply changes', ''))
add(9, 'Open workout plan', 'Opening is low-risk, so the sheet previews what you will land on.', scene('Show me today\'s workout', 'Opening your Lower body plan.'),
    popup('open your plan', 'Lower body strength', kv([('Plan', 'Upper / Lower, 4 days'), ('Today', 'Lower body'), ('Exercises', 'Box squat, RDL, Split squat')]), 'Open plan', ''))
add(10, 'Mark rest day', 'A rest day states what moves, so nothing disappears from the week.', scene('My knee is sore, I need to rest tomorrow', 'I can mark tomorrow as a rest day.'),
    popup('mark a rest day', 'Tomorrow, Friday', chips(['Sore', 'Sick', 'Travel', 'Busy'], 'Sore') + kv([('Moves to', 'Sunday, easy'), ('Trainer', 'Jordan is notified')]), 'Mark rest day', ''))
add(11, 'Update goal', 'Goal changes show before and after as two blocks, the new one in black.', scene('I want to focus on losing fat for a while', 'I can switch your main goal to Lose Fat.'),
    popup('update your goal', 'Change your main goal', f'<div class="arrow"><div class="t">{ib("muscle")}<span class="lb">Now</span><b>Build Muscle</b></div><b>{SV["chev"]}</b><div class="t new">{ib("scales")}<span class="lb">New</span><b>Lose Fat</b></div></div>' + fld('Reason (optional)', 'Summer, keep lifts moving up', 2), 'Update goal', ''))
add(12, 'Change food targets', 'Targets use a diff list and a required reason, because the numbers affect every day after.', scene('Lower my calories a bit and bump protein', 'Here is what I would change.'),
    popup('change your targets', 'Update nutrition targets?', '<div class="card flat" style="padding:4px 12px"><div class="kv diff"><div class="r"><span>Calories</span><b><s>2,300</s><em>2,150</em></b></div><div class="r"><span>Protein</span><b><s>170 g</s><em>185 g</em></b></div><div class="r"><span>Carbs</span><b><s>250 g</s><em>215 g</em></b></div><div class="r"><span>Fats</span><b>70 g</b></div></div></div>' + fld('Reason', 'Slow fat loss, keep strength', 2), 'Update targets', ''))
add(13, 'Book session', 'Day, time and length are chips and a segment, so booking needs no pickers.', scene('Book me with Jordan on Friday evening', 'Friday at 6:30 PM looks open.'),
    popup('book a session', 'Book session?', chips(['Fri', 'Sat', 'Sun'], 'Fri') + chips(['5:30 PM', '6:30 PM', '7:30 PM'], '6:30 PM') + '<div class="seg"><button aria-pressed="false">30 min</button><button aria-pressed="false">45 min</button><button aria-pressed="true">60 min</button></div>' + fld('Notes', 'Check my squat depth', 0), 'Book', ''))
add(14, 'Message trainer', 'The draft is editable before it is sent as you, and the sheet says who receives it.', scene('Tell Jordan my knee is sore', 'I drafted a message for Jordan.'),
    popup('message Jordan', 'Message to Jordan', f'<div class="pc">{av("JR")}<b>Jordan Reyes</b></div>' + fld('Message', 'Hi Jordan, my left knee is sore after squats this week. Can we swap them for box squats on Friday?', 4) + '<p class="sm mut">Sent from your account, not from the coach.</p>', 'Send message', ''))
add(15, 'Delete entry', 'Deleting names exactly what goes, says it cannot be undone, and puts Keep first.', scene('Delete the pizza I logged last night', 'I found one matching entry.'),
    popup('delete an entry', 'Delete this entry?', kv([('Food', 'Pepperoni pizza, 3 slices'), ('Type', 'Dinner'), ('Date', 'Wed, last night')]) + '<span class="pill g2" style="align-self:flex-start">Cannot be undone</span>', 'Delete', '', cancel='Keep it'))

build('ai-coach-popups.html', 'Coach Connect AI Coach Popups', '', 'AI coach popups',
      'The fifteen sheets the coach shows before it changes anything. They share one anatomy: what the coach wants to do, the details you can edit, then Not now and the action. Sliders, chips and cups work.',
      S, extra_js=JS2 + 'window.MINI=1;', extra_css=CSS2)
