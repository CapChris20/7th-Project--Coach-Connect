from kit import *

CSS2 = r'''
.hi{display:flex;align-items:center;gap:12px}
.hi .grow{flex:1;min-width:0}.hi small{display:block;color:var(--mut);font-size:13px}.hi b{font-size:19px;letter-spacing:-.3px}
.d7{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.d7 button{min-height:62px;border:3px solid var(--bd);border-radius:8px;background:var(--chip);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-weight:800;font-size:12px;color:var(--mut);cursor:pointer;padding:0}
.d7 button b{font-size:17px;color:var(--ink);font-variant-numeric:tabular-nums}
.d7 button i{width:8px;height:8px;border-radius:50%;border:2px solid var(--bd);display:block}
.d7 button.has i{background:var(--blk)}
.d7 button.on{background:var(--blk);color:var(--on);box-shadow:3px 3px 0 var(--sh)}.d7 button.on b{color:var(--on)}
.d7 button.on i{border-color:var(--on)}.d7 button.on.has i{background:var(--on)}
.ring{width:112px;height:112px;flex:none;position:relative}
.ring svg{width:112px;height:112px;transform:rotate(-90deg)}
.ring .tr{fill:none;stroke:var(--soft);stroke-width:14}.ring .fg{fill:none;stroke:var(--blk);stroke-width:14}
.ring .c{position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1.05}
.ring .c b{font-size:24px;letter-spacing:-1px;display:block}
.ring .c span{font-size:12px;font-weight:800;color:var(--mut);letter-spacing:.4px;text-transform:uppercase}
.eq{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;gap:4px;align-items:center;text-align:center}
.eq div{display:flex;flex-direction:column;gap:2px}
.eq b{font-size:17px;font-variant-numeric:tabular-nums}.eq span{font-size:12px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.5px}
.eq i{font-style:normal;font-weight:900;color:var(--mut);font-size:16px}
.mac{display:flex;flex-direction:column;gap:5px}
.mac .t{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800}
.mac .t .im{width:20px;height:20px}.mac .t span{margin-left:auto;color:var(--mut);font-weight:700;font-variant-numeric:tabular-nums}
.mac .bar{height:12px;border-width:2.5px;border-radius:6px}
.meal{display:flex;flex-direction:column}
.mh{display:flex;align-items:center;gap:12px;min-height:56px}
.mh .grow{flex:1;min-width:0}.mh .grow b{font-size:17px}.mh .grow span{display:block;font-size:13px;color:var(--mut)}
.fr{display:flex;align-items:center;gap:10px;min-height:56px;padding:8px 0;border-top:2px solid var(--bd)}
.list>.fr:first-child{border-top:0}
.fr .grow{flex:1;min-width:0}.fr .grow b{display:block;font-size:15px;line-height:1.2}.fr .grow span{font-size:13px;color:var(--mut)}
.fr .k{font-size:17px;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
.addb{width:44px;height:44px;flex:none;border:3px solid var(--bd);border-radius:10px;background:var(--chip);display:grid;place-items:center;cursor:pointer;padding:0;color:var(--ink)}
.addb.on{background:var(--blk);color:var(--on)}
.addb svg{width:20px;height:20px}
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.none{font-size:14px;color:var(--mut);padding:8px 0 4px;border-top:2px dashed var(--bd)}
.qp{display:flex;gap:10px;overflow-x:auto;margin:0 -16px;padding:2px 16px 8px;scrollbar-width:none;scroll-padding:0 16px}
.qp::-webkit-scrollbar{display:none}
.qp .chip{flex:none}
.basket{position:absolute;left:12px;right:12px;bottom:92px;display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--blk);color:var(--on);border:3px solid var(--bd);border-radius:10px;box-shadow:4px 4px 0 var(--sh);z-index:4}
.basket .grow{flex:1;min-width:0}.basket b{display:block;font-size:15px}.basket span{font-size:13px;opacity:.8}
.basket .btn{width:auto;min-height:44px;padding:0 16px;background:var(--on);color:var(--blk);border-color:var(--on);box-shadow:none;font-size:14px}
.basket[hidden]{display:none}
.vf{position:relative;height:250px;border:3px solid var(--bd);border-radius:10px;background:repeating-linear-gradient(135deg,var(--soft) 0 12px,var(--chip) 12px 24px);overflow:hidden;display:grid;place-items:center}
.vf .box{width:76%;height:46%;position:relative}
.vf .box::before,.vf .box::after,.vf .box i::before,.vf .box i::after{content:"";position:absolute;width:30px;height:30px;border:5px solid var(--ink)}
.vf .box::before{left:0;top:0;border-right:0;border-bottom:0}.vf .box::after{right:0;top:0;border-left:0;border-bottom:0}
.vf .box i{position:absolute;inset:0}.vf .box i::before{left:0;bottom:0;border-right:0;border-top:0}.vf .box i::after{right:0;bottom:0;border-left:0;border-top:0}
.vf .ln{position:absolute;left:12%;right:12%;top:30%;height:4px;background:var(--ink)}
.facts{display:flex;flex-direction:column}
.facts .f{display:flex;justify-content:space-between;align-items:baseline;min-height:42px;align-items:center;border-top:2px solid var(--bd);font-size:15px}
.facts .f:first-child{border-top:0}.facts .f.sub{padding-left:16px;color:var(--mut);font-size:14px}
.facts .f b{font-variant-numeric:tabular-nums}
.mac3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mac3 div{border:3px solid var(--bd);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:4px;background:var(--chip)}
.mac3 .im{width:22px;height:22px}.mac3 b{font-size:20px}.mac3 span{font-size:12px;color:var(--mut);font-weight:800}
.stp5{display:flex;align-items:center;justify-content:space-between;gap:12px}
.stp5 .stepper{flex:1;justify-content:space-between}
.stp5 .stepper output{font-size:34px;min-width:80px}
.big{font-size:58px;line-height:1}
.disc{background:var(--soft);border:3px solid var(--bd);border-radius:2px 14px 14px 14px;padding:12px;font-size:14px;line-height:1.4}
.gl{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.pre{display:flex;gap:8px;flex-wrap:wrap}
.cnt{min-width:30px;height:30px;padding:0 8px;border:3px solid var(--bd);border-radius:999px;display:grid;place-items:center;font-weight:900;font-size:14px;background:var(--blk);color:var(--on);flex:none}
'''
JS2 = r'''
HOOKS.push(function(ph){
 const basket=()=>{const on=$$('.addb.on',ph);const b=$('.basket',ph);if(!b)return;b.hidden=!on.length;const k=on.reduce((a,x)=>a+ +x.dataset.k,0);$('[data-bc]',ph).textContent=on.length+(on.length===1?' food':' foods');$('[data-bk]',ph).textContent=k.toLocaleString()+' kcal'};
 ph.addEventListener('click',e=>{const a=e.target.closest('.addb');if(a){a.classList.toggle('on');if(window.gsap&&!RM)gsap.fromTo(a,{scale:.8},{scale:1,duration:.45,ease:'back.out(3)'});basket()}
  if(e.target.closest('.srv [data-st]'))setTimeout(calc2,0)});
 const calc2=()=>{const o=$('.srv output',ph);if(!o)return;const s=+o.textContent;$$('[data-per]',ph).forEach(x=>{const p=+x.dataset.per;x.textContent=Math.round(p*s*(x.dataset.dec?10:1))/(x.dataset.dec?10:1)+(x.dataset.unit||'')})};
 const mc=()=>{const v=k=>{const o=$('[data-o="'+k+'"]',ph);return o?+o.dataset.v:0};const t=$('[data-mcal]',ph);if(t)t.textContent=(4*v('mp')+4*v('mc')+9*v('mf')).toLocaleString()};
 ['pointermove','pointerup','click'].forEach(ev=>ph.addEventListener(ev,()=>setTimeout(mc,0)));
 basket();calc2();mc();
 $$('.vf .ln',ph).forEach(l=>{if(window.gsap&&!RM)gsap.fromTo(l,{y:0},{y:'110px',duration:1.6,repeat:-1,yoyo:true,ease:'sine.inOut'})});
 $$('.ring .fg',ph).forEach(c=>{const r=+c.getAttribute('r'),L=2*Math.PI*r,p=+c.dataset.pct/100;c.style.strokeDasharray=L;c.style.strokeDashoffset=L*(1-p);if(window.gsap&&!RM)gsap.from(c,{strokeDashoffset:L,duration:1.1,ease:'power3.out',delay:.2})});
});
'''

def macro(ic, n, a, b): return f'<div class="mac"><div class="t"><i class="im i-{ic}"></i>{n}<span>{a} / {b} g</span></div>{bar(round(a / b * 100) if b else 0)}</div>'
def ring(pct, big, small):
    return (f'<div class="ring"><svg viewBox="0 0 112 112"><circle class="tr" cx="56" cy="56" r="47"/><circle class="fg" cx="56" cy="56" r="47" data-pct="{pct}"/></svg><div class="c"><div><b class="num">{big}</b><span>{small}</span></div></div></div>')
def day_strip(has):
    d = [('S', 9), ('M', 10), ('T', 11), ('W', 12), ('T', 13), ('F', 14), ('S', 15)]
    return '<div class="d7 rv">' + ''.join(f'<button class="{"on" if n == 13 else ""} {"has" if n in has else ""}">{l}<b>{n}</b><i></i></button>' for l, n in d) + '</div>'

MEALS = [('Breakfast', 'energy', [('Greek yogurt bowl', '1 bowl · 245 g', 380)]),
         ('Lunch', 'protein', [('Chicken rice bowl', '1 bowl', 720), ('Almond milk', '1 cup · 8 fl oz', 40)]),
         ('Dinner', 'carbs', []),
         ('Snacks', 'fats', [('Protein shake', '1 scoop · 30 g', 500)])]
def meal(name, ic, items, empty=False):
    tot = sum(k for _, _, k in items)
    rows = ''.join(f'<div class="fr"><div class="grow"><b>{n}</b><span>{s}</span></div><span class="k">{k}</span></div>' for n, s, k in items)
    if not items:
        rows = '<div class="none">No items logged</div>'
    return (f'<div class="card meal rv"><div class="mh">{ib(ic)}<div class="grow"><b>{name}</b><span>{tot} kcal</span></div><button class="addb" aria-label="Add food to {name}">{SV["plus"]}</button></div>{rows}</div>')

def eqrow(goal, food, ex, left):
    return (f'<div class="eq"><div><b>{goal}</b><span>Goal</span></div><i>−</i><div><b>{food}</b><span>Food</span></div><i>+</i><div><b>{ex}</b><span>Exercise</span></div><i>=</i><div><b>{left}</b><span>Left</span></div></div>')

QP = [('Greek Yogurt', 130), ('Salmon', 280), ('Oatmeal', 150), ('Chicken Breast', 165), ('Brown Rice', 215), ('Avocado', 240)]
def qp():
    return '<div class="gl rv">Quick picks</div><div class="qp rv">' + ''.join(f'<button class="chip sm3">{SV["plus"]}{n}</button>' for n, k in QP) + '</div>'

def daily(data=True):
    hdr = f'<div class="hi rv"><div class="grow"><small>Thursday, Nov 13</small><b>Nutrition</b></div><button class="sq" aria-label="Nutrition settings">{ib("settings").replace("class=\"ib ", "class=\"ib sm0 ")}</button></div>'
    if data:
        hero = (f'<div class="card rv" style="gap:14px"><div style="display:flex;gap:14px;align-items:center">{ring(71, "840", "kcal left")}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:9px">{macro("protein", "Protein", 118, 170)}{macro("carbs", "Carbs", 160, 250)}{macro("fats", "Fats", 48, 70)}</div></div>'
                f'{eqrow("2,300", "1,640", "180", "840")}</div>')
        steps = (f'<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px">{ib("workout")}<div style="flex:1;min-width:0"><b>6,420 steps</b>{bar(80)}</div></div>')
        body = ''.join(meal(*m) for m in MEALS)
        ds = day_strip({10, 11, 12, 13})
    else:
        hero = (f'<div class="card emp rv" style="gap:14px"><div style="display:flex;gap:14px;align-items:center">{ring(0, "2,300", "kcal left")}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:9px">{macro("protein", "Protein", 0, 170)}{macro("carbs", "Carbs", 0, 250)}{macro("fats", "Fats", 0, 70)}</div></div>'
                f'{eqrow("2,300", "0", "0", "2,300")}</div>')
        steps = f'<div class="card emp rv" style="flex-direction:row;align-items:center;gap:12px">{ib("workout")}<div style="flex:1;min-width:0"><b>Connect to track your steps</b><p class="sm mut">Steps add to your calories left.</p></div><button class="btn gh sm2" style="width:auto;padding:0 12px">Connect</button></div>'
        body = ''.join(meal(n, ic, []) for n, ic, _ in MEALS)
        ds = day_strip(set())
    return hdr + ds + hero + steps + qp() + sec('Meals') + body

S = []
def add(t, n, body, extra='', a='nutrition', lab='', second=False):
    S.append(screen(t, n, body, (dock(a) if a else '') + extra, lab=lab, second=second))

add('1 · Daily log', 'The day is one strip, one ring and four meals. The ring is calories left, with the goal, food and exercise equation under it. Each meal has its own add button, and quick picks sit above the meals.', daily(True), lab='With data')
add('x', 'x', daily(False), lab='Empty · first day', second=True)

# search
def res(n, b, k, on=False):
    return f'<div class="fr"><div class="grow"><b>{n}</b><span>{b}</span></div><span class="k">{k}</span><button class="addb{" on" if on else ""}" data-k="{k}" aria-label="Add {n}">{SV["plus"]}</button></div>'
srch = (top('Add food', sub='Lunch') +
  f'<div class="fld rv"><input aria-label="What are you eating?" value="chicken" placeholder="What are you eating?"></div>'
  f'<div style="display:flex;gap:10px" class="rv"><button class="btn gh sm2" style="flex:1">{ib("scales").replace("class=\"ib ", "class=\"ib sm0 ")} Scan barcode</button><button class="btn gh sm2" style="flex:1">Quick add</button></div>'
  '<div class="seg rv" data-tabs="fs"><button data-t="r" aria-pressed="true">Search results</button><button data-t="f" aria-pressed="false">Favorites</button><button data-t="c" aria-pressed="false">Recent</button></div>'
  '<div data-p="fs:r" style="display:flex;flex-direction:column;gap:12px"><div class="card rv"><div class="list">'
  + res('Chicken Breast, grilled', 'Generic · 4 oz', 165, True) + res('Chicken rice bowl', 'Chipotle · 1 bowl', 720, True) + res('Chicken noodle soup', 'Campbell\'s · 1 cup', 60) + res('Chicken Caesar salad', 'Panera · 1 salad', 440) + res('Chicken breast strips', 'Tyson · 3 oz', 140) + '</div></div></div>'
  '<div data-p="fs:f" hidden class="card rv"><div class="list">' + res('Greek Yogurt', 'Chobani · 1 cup', 130) + res('Salmon', 'Generic · 4 oz', 280) + res('Protein Powder', 'Optimum · 1 scoop', 120) + '</div></div>'
  '<div data-p="fs:c" hidden class="card rv"><div class="list">' + res('Oatmeal', '1 cup cooked', 150) + res('Brown Rice', '1 cup cooked', 215) + '</div></div>'
  '<div class="disc rv">Search packaged foods, restaurants, and groceries. Nutrition data comes from public databases and can be off. Check the label when it matters.</div>')
basket = '<div class="basket"><div class="grow"><b data-bc>2 foods</b><span data-bk>885 kcal</span></div><button class="btn">Log to Lunch</button></div>'
add('2 · Food search and basket', 'Tap the plus on any result and it drops into a basket. The basket bar tells you how many foods and calories, and logs them all to the meal in one tap. Results, Favorites and Recent are tabs.', srch, basket)
nom = (top('Add food', sub='Lunch') + '<div class="fld rv"><input aria-label="Search" value="chikn rice zzz" placeholder="What are you eating?"></div>'
  '<div class="card emp rv" style="gap:10px"><span class="gl">No matches</span><b style="font-size:18px">Nothing for "chikn rice zzz"</b><p class="mut">Try a shorter name or a brand.</p><button class="btn gh">Quick add instead</button></div>' + qp())
add('3 · No matches', 'No results suggests a shorter search, then falls back to quick picks and quick add, so the search never dead-ends.', nom)

# barcode
scan = (top('Scan barcode', right=f'<button class="sq" aria-label="Flash">{SV["x"]}</button>', back=True) +
  '<div class="vf rv"><div class="box"><i></i></div><div class="ln"></div></div>'
  '<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px">' + ib('scales') + '<div><b>Looking up barcode</b><p class="sm mut">Hold steady. 0 49000 02830 2</p></div></div>'
  '<button class="btn gh rv">Type the number instead</button>')
add('4 · Barcode, scanning', 'The viewfinder is a hatched placeholder with a scan line that moves, not a fake camera image. The status line names what is happening.', scan, '', a=None)
nf = (top('Scan barcode', back=True) + '<div class="vf rv" style="height:160px"><div class="box"><i></i></div></div>'
  '<div class="card blk rv" style="gap:8px"><span class="gl" style="color:var(--on);opacity:.7">Barcode not in database</span><h2>This product is not in our food databases yet.</h2><p style="opacity:.8">Store scale labels do not scan either. Add it yourself in a few seconds.</p></div>'
  '<button class="btn rv">Quick add it</button><button class="btn gh rv">Search by name</button>')
add('5 · Barcode, not found', 'Not found explains why and gives the two ways forward, quick add or search by name.', nf, '', a=None)

# details
det = (top('Nutrition facts', sub='Greek Yogurt Bowl') +
  '<div class="card rv" style="gap:14px"><div style="display:flex;align-items:baseline;gap:8px"><span class="num big" data-per="380" data-unit="">380</span><b>calories</b></div>'
  '<div class="mac3"><div><i class="im i-protein"></i><b data-per="32" data-unit=" g">32 g</b><span>Protein</span></div><div><i class="im i-carbs"></i><b data-per="41" data-unit=" g">41 g</b><span>Carbs</span></div><div><i class="im i-fats"></i><b data-per="9" data-unit=" g">9 g</b><span>Fats</span></div></div></div>'
  '<div class="card flat rv srv" style="gap:12px"><div class="stp5"><span class="gl">Servings</span><div class="stepper"><button data-st="-0.5" aria-label="Fewer servings">' + SV['minus'] + '</button><output class="num" data-min="0.5" data-max="20">1</output><button data-st="0.5" aria-label="More servings">' + SV['plus'] + '</button></div></div>'
  '<div style="display:flex;align-items:center;justify-content:space-between;border-top:2px solid var(--bd);padding-top:10px"><div><span class="gl">Serving size</span><div style="font-weight:800">1 bowl · 245 g</div></div><button class="btn gh sm2" data-open="srv" style="width:auto;padding:0 14px">Edit serving</button></div></div>'
  + sec('Meal') + '<div class="chips rv" data-single data-g="ml">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if m == "Lunch" else "false"}">{m}</button>' for m in ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) + '</div>'
  + sec('Nutrients', '<span>Per serving on label</span>') +
  '<div class="card rv"><div class="facts">' + ''.join(f'<div class="f{" sub" if sub else ""}"><span>{n}</span><b>{v}</b></div>' for n, v, sub in [('Total fat', '9 g', 0), ('Sat. fat', '4.5 g', 1), ('Cholesterol', '20 mg', 0), ('Sodium', '85 mg', 0), ('Carbohydrates', '41 g', 0), ('Sugars', '19 g', 1), ('Protein', '32 g', 0), ('Potassium', '420 mg', 0), ('Vitamin D', '2 mcg', 0)]) + '</div></div>'
  '<button class="btn rv">Confirm and log</button>')
srvs = sheet('srv', '<h2>Edit serving</h2><p class="mut">Use this when the package says something different.</p><div class="fld"><label for="ss">Serving size (g per serving)</label><input id="ss" value="245"></div><div class="fld"><label for="sq">Quantity (servings)</label><input id="sq" value="1"></div><div class="fld"><label for="su">Serving unit</label><input id="su" value="bowl"></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="srv" style="flex:1">Cancel</button><button class="btn" data-close="srv" style="flex:1.4">Done editing nutrition</button></div>')
add('6 · Nutrition facts', 'The food opens on the numbers you care about, with servings as a stepper that updates calories and macros live. Try the stepper. The full label is below, and the meal is chosen right here.', det, srvs)
add('7 · Edit serving', 'Edit serving is a three-field sheet for packages that differ from the database.', det, srvs.replace('data-sheet="srv"', 'data-sheet="srv" data-autoopen'))

# quick add
qa = (top('Quick add', sub='Log your nutrition') +
  '<div class="fld rv"><label for="fn">Food name</label><input id="fn" value="Homemade chili"></div>'
  '<div class="fld rv"><label for="cal">Calories</label><input id="cal" value="520" inputmode="numeric"></div>'
  '<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px"><div style="flex:1"><b>Add macros</b><p class="sm mut">Protein, carbs and fat</p></div><button class="sw" aria-pressed="true" aria-label="Add macros"></button></div>'
  '<div class="mac3 rv"><div class="fld"><label for="qp">Protein (g)</label><input id="qp" value="38"></div><div class="fld"><label for="qc">Carbs (g)</label><input id="qc" value="44"></div><div class="fld"><label for="qf">Fat (g)</label><input id="qf" value="16"></div></div>'
  '<div class="disc rv">Estimated from macros: 4 × 38 + 4 × 44 + 9 × 16 = <b>472</b> kcal. Tap to fill sets calories to this.</div><button class="btn gh rv">Tap to fill calories</button>'
  + sec('Meal') + '<div class="chips rv" data-single>' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if m == "Dinner" else "false"}">{m}</button>' for m in ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) + '</div><button class="btn rv">Log to Dinner</button>')
add('8 · Quick add', 'Quick add is for foods no database has. Macros are optional behind a switch, and the page shows what the macros add up to so the calories are not a guess.', qa)

# targets
tg = (top('Set your numbers', sub='Daily targets') +
  '<div class="card blk rv" style="gap:4px;border-radius:6px 24px 6px 6px"><span class="gl" style="color:var(--on);opacity:.7">Calories per day</span><div style="display:flex;align-items:baseline;gap:8px"><span class="num big" data-o="cal" data-v="2300" data-pre="" data-suf="">2300</span><b style="opacity:.7;font-size:20px">kcal</b></div>'
  f'<div class="rng" data-min="1200" data-max="4000" data-step="50" data-val="2300" data-out="cal"><div class="trk"><div class="fl {g()}"></div></div><div class="kb" aria-label="Calories per day"></div></div>'
  '<button class="btn sm2" style="background:var(--on);color:var(--blk);border-color:var(--on);box-shadow:none;margin-top:6px">Calculate for me</button></div>'
  + sec('Macro targets', '<span>At this calorie target</span>') +
  '<div class="pre rv" data-single data-g="pr">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if p == "High protein" else "false"}">{p}</button>' for p in ['Balanced', 'High protein', 'Low carb']) + '</div>'
  '<div class="card rv" style="gap:14px">'
  + ''.join(f'<div><div style="display:flex;justify-content:space-between;align-items:baseline"><b>{n}</b><span class="num" style="font-size:22px"><b data-o="{k}" data-v="{v}" data-pre="" data-suf=" g" style="font-size:22px">{v} g</b></span></div><div class="rng" data-min="{mn}" data-max="{mx}" data-step="5" data-val="{v}" data-out="{k}"><div class="trk"><div class="fl {g()}"></div></div><div class="kb" aria-label="{n}"></div></div></div>' for n, k, v, mn, mx in [('Protein', 'mp', 185, 50, 350), ('Carbs', 'mc', 215, 50, 450), ('Fats', 'mf', 70, 20, 150)])
  + '<div style="border-top:2px solid var(--bd);padding-top:10px;display:flex;justify-content:space-between"><span class="gl">Macros add up to</span><b class="num"><span data-mcal>2,300</span> kcal</b></div></div>'
  '<button class="btn rv">Save goals</button>')
add('9 · Targets', 'Calories and macros on one page. The calorie slider is the big black block. Macro presets set a starting point, the three sliders adjust it, and the total they add up to updates as you drag.', tg, '', a=None)

st = (top('Nutrition settings') +
  '<div class="card rv"><div class="list">' + ''.join(f'<button class="row">{ib(ic)}<div class="grow"><b>{n}</b><span>{s}</span></div>{SV["chev"]}</button>' for ic, n, s in [('protein', 'Daily targets', '2,300 kcal'), ('muscle', 'Macro targets', '185 g protein · 215 g carbs · 70 g fat'), ('hydration', 'Foods you love and skip', '6 loved · 3 skipped')]) + '</div></div>'
  + sec('Foods you love and skip') +
  '<div class="chips rv" data-g="lv">' + ''.join(f'<button class="chip sm3" aria-pressed="{x}">{n}</button>' for n, x in [('Salmon', 'true'), ('Brown Rice', 'true'), ('Avocado', 'true'), ('Greek Yogurt', 'true'), ('Oatmeal', 'true'), ('Broccoli', 'false'), ('Celery', 'false'), ('Brussels Sprouts', 'false')]) + '</div>'
  '<button class="btn gh rv" data-open="rst">Reset to onboarding</button><p class="sm mut rv">Clears your targets and shows setup again next time you open Nutrition.</p>')
rst = sheet('rst', '<span class="pill g2" style="align-self:flex-start">Clears your targets</span><h2>Reset nutrition goals?</h2><p class="mut">This clears your targets and shows onboarding again next time you open Nutrition. Your logged foods stay.</p><div style="display:flex;gap:10px"><button class="btn gh" data-close="rst" style="flex:1">Cancel</button><button class="btn" data-close="rst" style="flex:1.2">Reset goals</button></div>')
add('10 · Nutrition settings', 'Settings is three rows and one chip list for the foods you love and skip, so the coach and the search can use them. Reset is a ghost button with a confirm, not a row that looks like the others.', st, rst)
add('11 · Reset goals', 'The confirm says what clears and what stays.', st, rst.replace('data-sheet="rst"', 'data-sheet="rst" data-autoopen'))

build('nutrition.html', 'Coach Connect Nutrition', '', 'Nutrition',
      'The daily log with calories left, the food basket search, barcode scanning, nutrition facts with live servings, quick add, targets and settings. The first screen shows the empty first day next to the filled one.',
      S, extra_js=JS2, extra_css=CSS2)
