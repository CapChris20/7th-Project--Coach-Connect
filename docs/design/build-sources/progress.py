from kit import *

CSS2 = r'''
.hi{display:flex;align-items:center;gap:12px}
.chart{width:100%;height:auto;display:block}
.chart text{font-size:12px;font-weight:700;fill:var(--mut);font-family:inherit}
.chart .gl{stroke:var(--soft);stroke-width:2}
.chart .ax{stroke:var(--bd);stroke-width:3}
.chart .ln{fill:none;stroke:var(--ink);stroke-width:4;stroke-linejoin:round;stroke-linecap:round}
.chart .ar{fill:var(--soft)}
.chart .dot{fill:var(--blk);stroke:var(--bd);stroke-width:3}
.chart .goal{stroke:var(--ink);stroke-width:2.5;stroke-dasharray:6 5}
.chart .bb{transform-box:fill-box;transform-origin:50% 100%;fill:var(--blk);stroke:var(--bd);stroke-width:3}
.chart .bb.rest{fill:transparent;stroke-dasharray:5 4}
.gl2{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.big{font-size:40px;line-height:1;letter-spacing:-1.2px;white-space:nowrap}
.kv2{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.kv2 div{border:3px solid var(--bd);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:2px;background:var(--chip)}
.kv2 b{font-size:19px;font-variant-numeric:tabular-nums}.kv2 span{font-size:12px;font-weight:800;color:var(--mut);letter-spacing:.5px;text-transform:uppercase}
.seg.sx{overflow-x:auto;scrollbar-width:none}.seg.sx::-webkit-scrollbar{display:none}.seg.sx button{flex:none;padding:0 16px}
.fr{display:flex;align-items:center;gap:10px;min-height:56px;padding:8px 0;border-top:2px solid var(--bd)}
.list>.fr:first-child{border-top:0}
.fr .grow{flex:1;min-width:0}.fr .grow b{display:block;font-size:15px;line-height:1.2}.fr .grow span{font-size:13px;color:var(--mut)}
.fr .k{font-size:17px;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.mh{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.mh h2{font-size:19px}.mh span{font-size:13px;font-weight:800;color:var(--mut)}
.pg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pt{display:flex;flex-direction:column;gap:6px;text-align:left;background:none;border:0;padding:0;cursor:pointer}
.pt .im2{aspect-ratio:3/4;border:3px solid var(--bd);border-radius:8px;background:repeating-linear-gradient(135deg,var(--soft) 0 9px,var(--chip) 9px 18px);display:grid;place-items:end start;padding:5px 6px;font-size:12px;font-weight:900;box-shadow:3px 3px 0 var(--sh)}
.pt span{font-size:12px;font-weight:800;color:var(--mut)}
.pt:nth-child(3n+2) .im2{border-radius:8px 18px 8px 8px}
.view{aspect-ratio:3/4;border:3px solid var(--bd);border-radius:12px;background:repeating-linear-gradient(135deg,var(--soft) 0 12px,var(--chip) 12px 24px);position:relative;box-shadow:5px 5px 0 var(--sh);display:grid;place-items:end start;padding:10px;font-weight:900;font-size:13px}
.view .cn{position:absolute;top:10px;right:10px;background:var(--blk);color:var(--on);border-radius:6px;padding:3px 8px;font-size:12px}
.film{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}
.film i{flex:none;width:52px;height:68px;border:3px solid var(--bd);border-radius:6px;background:repeating-linear-gradient(135deg,var(--soft) 0 6px,var(--chip) 6px 12px);display:block}
.film i.on{box-shadow:0 0 0 3px var(--bg),0 0 0 6px var(--bd)}
.cmpr{position:relative;aspect-ratio:3/4;border:3px solid var(--bd);border-radius:12px;overflow:hidden;box-shadow:5px 5px 0 var(--sh);touch-action:none}
.cmpr .a,.cmpr .b{position:absolute;inset:0;display:grid;font-weight:900;font-size:13px;padding:10px}
.cmpr .a{background:repeating-linear-gradient(135deg,var(--soft) 0 12px,var(--chip) 12px 24px);place-items:end end}
.cmpr .b{background:repeating-linear-gradient(45deg,var(--chip) 0 12px,var(--soft) 12px 24px);place-items:end start;clip-path:inset(0 50% 0 0)}
.cmpr .hd{position:absolute;top:0;bottom:0;left:50%;width:44px;margin-left:-22px;cursor:ew-resize;display:grid;place-items:center}
.cmpr .hd::before{content:"";position:absolute;top:0;bottom:0;left:50%;width:4px;margin-left:-2px;background:var(--ink)}
.cmpr .hd i{position:relative;width:44px;height:44px;border:3px solid var(--bd);border-radius:50%;background:var(--blk);color:var(--on);display:grid;place-items:center;font-style:normal;font-weight:900;font-size:13px}
.dc{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 0;border-top:2px solid var(--bd)}
.dc:first-child{border-top:0}
.dc .dn{width:48px;height:48px;flex:none;border:3px solid var(--bd);border-radius:10px;display:grid;place-items:center;font-weight:900;font-size:13px;background:var(--chip);text-align:center;line-height:1.05}
.dc.done .dn{background:var(--blk);color:var(--on)}
.dc.rest .dn{border-style:dashed}
.dc .grow{flex:1;min-width:0}.dc b{display:block;font-size:15px}.dc span.s{font-size:13px;color:var(--mut)}
.wp{display:flex;align-items:center;gap:8px}
.wp .mid{flex:1;text-align:center}.wp .mid b{display:block;font-size:17px}.wp .mid span{font-size:13px;color:var(--mut);font-weight:700}
.sc{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sc div{border:3px solid var(--bd);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:4px;background:var(--chip)}
.sc div b{font-size:26px;letter-spacing:-.8px;line-height:1;font-variant-numeric:tabular-nums}.sc div b small{font-size:13px;color:var(--mut);letter-spacing:0;font-weight:800}
.sc div span{font-size:12px;font-weight:800;color:var(--mut);letter-spacing:.6px;text-transform:uppercase}
.pc{display:flex;flex-direction:column;gap:8px}
.pc .t{display:flex;gap:10px;font-size:15px;line-height:1.35}
.pc .t::before{content:"";width:10px;height:10px;margin-top:6px;flex:none;border:3px solid var(--bd);background:var(--blk)}
.pc.neg .t::before{background:transparent}
.tip{display:flex;gap:12px;align-items:flex-start}
.tip p{font-size:15px;line-height:1.4}
.xl{color:var(--ink);overflow-x:auto;border:3px solid var(--bd);border-radius:8px;background:var(--sf);box-shadow:4px 4px 0 var(--sh)}
.xl table,.xl td,.xl th{color:var(--ink)}
.xl table{border-collapse:separate;border-spacing:0;font-size:14px;min-width:560px;width:100%}
.xl th,.xl td{padding:0 12px;height:46px;white-space:nowrap;border-bottom:2px solid var(--bd);border-right:2px solid var(--bd);text-align:left}
.xl th{background:var(--soft);font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:900}
.xl td:first-child,.xl th:first-child{position:sticky;left:0;background:var(--sf);font-weight:800;border-right:3px solid var(--bd);z-index:1}
.xl th:first-child{background:var(--soft)}
.xl td.sel{color:var(--on);background:var(--blk);color:var(--on);font-weight:900}
.xl td.t{font-variant-numeric:tabular-nums}
.fbar{display:flex;align-items:center;gap:10px;min-height:48px;padding:0 12px;border:3px solid var(--bd);border-radius:8px;background:var(--sf)}
.fbar b{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}
'''
JS2 = r'''
HOOKS.push(function(ph){
 $$('.chart .ln',ph).forEach(p=>{if(!p.getTotalLength)return;const L=p.getTotalLength();p.style.strokeDasharray=L;p.style.strokeDashoffset=0;if(window.gsap&&!RM)gsap.from(p,{strokeDashoffset:L,duration:1.2,ease:'power2.out',delay:.2})});
 $$('.chart .bb',ph).forEach((b,i)=>{if(window.gsap&&!RM)gsap.from(b,{scaleY:0,duration:.6,delay:.1+i*.06,ease:'power3.out'})});
 $$('.cmpr',ph).forEach(c=>{const hd=$('.hd',c),top=$('.b',c);if(!(window.gsap&&window.Draggable)){return}
  const set=()=>{const w=c.clientWidth,x=gsap.getProperty(hd,'x')+w/2;top.style.clipPath='inset(0 '+Math.max(0,Math.min(100,(1-x/w)*100))+'% 0 0)'};
  Draggable.create(hd,{type:'x',bounds:{minX:-c.clientWidth/2+20,maxX:c.clientWidth/2-20},onDrag:set,onThrowUpdate:set});});
});
'''
def line_chart(pts, ymin, ymax, xl, unit='', goal=None, w=300, h=176):
    pl, pr, pt, pb = 38, 12, 12, 28
    iw, ih = w - pl - pr, h - pt - pb
    n = len(pts)
    X = lambda i: pl + iw * i / (n - 1)
    Y = lambda v: pt + ih * (1 - (v - ymin) / (ymax - ymin))
    ticks = [ymin + (ymax - ymin) * k / 3 for k in range(4)]
    s = f'<svg class="chart" viewBox="0 0 {w} {h}" role="img" aria-label="Chart">'
    for t in ticks:
        s += f'<line class="gl" x1="{pl}" x2="{w - pr}" y1="{Y(t):.1f}" y2="{Y(t):.1f}"/><text x="{pl - 6}" y="{Y(t) + 4:.1f}" text-anchor="end">{t:.0f}</text>'
    path = 'M' + ' L'.join(f'{X(i):.1f},{Y(v):.1f}' for i, v in enumerate(pts))
    s += f'<path class="ar" d="{path} L{X(n - 1):.1f},{pt + ih} L{X(0):.1f},{pt + ih} Z"/>'
    if goal is not None and ymin <= goal <= ymax:
        s += f'<line class="goal" x1="{pl}" x2="{w - pr}" y1="{Y(goal):.1f}" y2="{Y(goal):.1f}"/>'
    s += f'<line class="ax" x1="{pl}" x2="{w - pr}" y1="{pt + ih}" y2="{pt + ih}"/>'
    s += f'<path class="ln" d="{path}"/><circle class="dot" cx="{X(n - 1):.1f}" cy="{Y(pts[-1]):.1f}" r="7"/>'
    for i, lab in xl:
        s += f'<text x="{X(i):.1f}" y="{h - 6}" text-anchor="{"end" if i == n - 1 else ("start" if i == 0 else "middle")}">{lab}</text>'
    return s + '</svg>'

def bar_chart(vals, labels, ymax, goal, w=300, h=170):
    pl, pr, pt, pb = 30, 8, 10, 28
    iw, ih = w - pl - pr, h - pt - pb
    n = len(vals)
    bw = iw / n * .56
    Y = lambda v: pt + ih * (1 - v / ymax)
    s = f'<svg class="chart" viewBox="0 0 {w} {h}" role="img" aria-label="Hours slept each day">'
    for t in (0, 3, 6, 9):
        s += f'<line class="gl" x1="{pl}" x2="{w - pr}" y1="{Y(t):.1f}" y2="{Y(t):.1f}"/><text x="{pl - 6}" y="{Y(t) + 4:.1f}" text-anchor="end">{t}</text>'
    for i, v in enumerate(vals):
        x = pl + iw * (i + .5) / n - bw / 2
        if v is None:
            s += f'<rect class="bb rest" x="{x:.1f}" y="{Y(1.2):.1f}" width="{bw:.1f}" height="{ih * 1.2 / ymax:.1f}" rx="2"/>'
        else:
            s += f'<rect class="bb" x="{x:.1f}" y="{Y(v):.1f}" width="{bw:.1f}" height="{ih * v / ymax:.1f}" rx="2"/>'
        s += f'<text x="{x + bw / 2:.1f}" y="{h - 8}" text-anchor="middle">{labels[i]}</text>'
    s += f'<line class="goal" x1="{pl}" x2="{w - pr}" y1="{Y(goal):.1f}" y2="{Y(goal):.1f}"/>'
    return s + '</svg>'

def pan(k, a, html, g_='ps'): return f'<div data-p="{g_}:{k}" {"" if k == a else "hidden"} style="display:flex;flex-direction:column;gap:16px">{html}</div>'

S = []
def add(t, n, body, extra='', a='home', lab='', second=False):
    S.append(screen(t, n, body, (dock(a) if a else '') + extra, lab=lab, second=second))

# 1 progress overview
W = [173.4, 173.0, 172.8, 173.1, 172.5, 172.3, 172.0, 172.2, 171.9, 172.0]
prog = (top('Progress', sub='Weight, body fat and lifts') +
  '<div class="seg rv" data-tabs="ps"><button data-t="w" aria-pressed="true">Weight</button><button data-t="b" aria-pressed="false">Body fat</button><button data-t="l" aria-pressed="false">Lifts</button></div>'
  + pan('w', 'w',
    '<div class="card rv" style="gap:12px"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><span class="gl2">Current</span><div class="num big" data-count="172" data-dec="1" data-suf=" lb">172.0 lb</div></div>' + pill('−1.4 lb in 8 weeks') + '</div>'
    + line_chart(W, 168, 177, [(0, 'Sep 20'), (4, 'Oct 18'), (9, 'Nov 13')], goal=170) +
    '<div class="chips" data-single data-g="rg">' + ''.join(f'<button class="chip sm3" aria-pressed="{"true" if r == "12W" else "false"}">{r}</button>' for r in ['4W', '12W', '6M', 'All']) + '</div></div>'
    '<div class="kv2 rv"><div><b>173.4</b><span>Start</span></div><div><b>−1.4</b><span>Change</span></div><div><b>165</b><span>Goal</span></div></div>'
    '<div class="card flat rv" style="gap:8px"><div style="display:flex;justify-content:space-between"><b>Toward 165 lb</b><b class="num">16%</b></div>' + bar(16) + '<p class="sm mut">7 lb to go at about 0.2 lb a week.</p></div>'
    + sec('Recent weigh-ins') + '<div class="card rv"><div class="list">' + ''.join(f'<div class="fr"><div class="grow"><b>{d}</b><span>{s}</span></div><span class="k">{v}</span></div>' for d, s, v in [('Thu, Nov 13', 'Morning', '172.0 lb'), ('Mon, Nov 10', 'Morning', '172.2 lb'), ('Fri, Nov 7', 'Morning', '171.9 lb')]) + '</div></div>'
    '<button class="btn rv">Log weight</button>')
  + pan('b', 'w', '<div class="card rv" style="gap:12px"><div><span class="gl2">Body fat</span><div class="num big">19.4%</div></div>' + line_chart([21.2, 20.8, 20.5, 20.1, 19.8, 19.4], 18, 22, [(0, 'Sep 20'), (5, 'Nov 13')]) + '</div><p class="sm mut rv">Body fat comes from check-ins your trainer or you enter. It is an estimate.</p>')
  + pan('l', 'w', '<div class="card rv"><div class="list">' + ''.join(f'<div class="fr"><span class="ib {g()}"><i class="im i-dumbbell"></i></span><div class="grow"><b>{n}</b><span>{a} to {b}</span></div><span class="k">+{int(b) - int(a)} lb</span></div>' for n, a, b in [('Box squat', '115', '145'), ('Romanian deadlift', '95', '115'), ('Hip thrust', '115', '135')]) + '</div></div>'))
add('1 · Progress', 'Progress is one chart at a time, drawn to scale with a goal line and the endpoint marked. Weight is first, with range chips and the change in plain words. Body fat and Lifts are tabs. Tap a range chip or a tab.', prog, a='home')

# 2 photos pair
def photos(data=True):
    hdr = top('Progress photos', right=f'<button class="sq" aria-label="Add photo">{SV["plus"]}</button>')
    if not data:
        return (hdr + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('picture', 'lg') + '<h1>No progress photos yet</h1><p class="mut">Your first photo will show here. Front, side and back work best, in the same light.</p><button class="btn">Add photo from library</button></div>'
                '<p class="sm mut rv">Photos stay on your account. Only you and your trainer see them.</p>')
    def grid(items):
        return '<div class="pg rv">' + ''.join(f'<button class="pt"><div class="im2">{l}</div><span>{d}</span></button>' for l, d in items) + '</div>'
    return (hdr + '<div class="hi rv"><button class="chip sm3" style="font-size:13px">By Date (Newest)</button><div style="flex:1"></div><button class="btn gh sm2" style="width:auto;padding:0 14px" data-open="x">Compare</button></div>'
            + sec('November 2025', '<span>3 photos</span>') + grid([('Front', 'Nov 12'), ('Side', 'Nov 12'), ('Back', 'Nov 12')])
            + sec('October 2025', '<span>3 photos</span>') + grid([('Front', 'Oct 15'), ('Side', 'Oct 15'), ('Back', 'Oct 15')])
            + sec('September 2025', '<span>3 photos</span>') + grid([('Front', 'Sep 3'), ('Side', 'Sep 3'), ('Back', 'Sep 3')]))
add('2 · Progress photos', 'Photos are grouped by month in a three-up grid, with the three poses on each date lined up so the change is easy to see. The empty side shows the real No progress photos yet state. Photo thumbnails are hatched placeholders.', photos(True), lab='With photos')
add('x', 'x', photos(False), lab='Empty', second=True)

# 3 viewer
view = (top('Nov 12', sub='Front · 3 of 9', right=f'<button class="sq" aria-label="Share">{SV["send"]}</button>') +
  '<div class="view rv">Front, Nov 12<span class="cn">3 / 9</span></div>'
  '<p class="sm mut rv" style="text-align:center">Swipe for next photo</p><div class="film rv"><i></i><i></i><i class="on"></i><i></i><i></i><i></i><i></i></div>'
  '<div style="display:flex;gap:10px" class="rv"><button class="btn gh" style="flex:1">Share</button><button class="btn" style="flex:1" data-open="dp">Delete</button></div>')
dps = sheet('dp', '<span class="pill g2" style="align-self:flex-start">Cannot be undone</span><h2>Delete photo</h2><p class="mut">Are you sure you want to delete this photo?</p><div style="display:flex;gap:10px"><button class="btn gh" data-close="dp" style="flex:1">Keep it</button><button class="btn" data-close="dp" style="flex:1.2">Delete photo</button></div>')
add('3 · Photo viewer', 'One photo at a time with a filmstrip under it, a counter, and Share and Delete. Delete asks first.', view, dps, a=None)

# 4 compare
cmp_ = (top('Compare', sub='Drag the line') +
  '<div class="cmpr rv"><div class="a">Nov 12</div><div class="b">Sep 3</div><div class="hd"><i>⇄</i></div></div>'
  '<div class="kv2 rv"><div><b>10 wks</b><span>Apart</span></div><div><b>−1.4 lb</b><span>Weight</span></div><div><b>−1.8%</b><span>Body fat</span></div></div>'
  '<div class="chips rv" data-single><button class="chip sm3" aria-pressed="true">Front</button><button class="chip sm3" aria-pressed="false">Side</button><button class="chip sm3" aria-pressed="false">Back</button></div>')
add('4 · Compare', 'Before and after is one photo with a drag line. Drag the handle sideways. Numbers under it say how far apart the dates are and what changed.', cmp_, '', a=None)

# 5 weekly report pair
def report(data=True):
    hdr = top('Weekly report', right=f'<button class="sq" data-open="ro" aria-label="Options"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="3" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="17" y="10" width="4" height="4"/></svg></button>')
    wp = '<div class="wp rv"><button class="sq" aria-label="Previous week">' + SV['back'] + '</button><div class="mid"><b>This week</b><span>Nov 10 to 16</span></div><button class="sq" aria-label="Next week" style="opacity:.4">' + SV['chev'] + '</button></div>'
    if not data:
        return (hdr + wp + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('progress', 'lg') + '<h1>No weekly report yet</h1><p class="mut">Your first recap appears after you log check-ins across a week.</p><button class="btn">Log today\'s check-in</button></div><p class="sm mut rv">Reports auto-build every week from your logged data.</p>')
    return (hdr + wp + '<div class="card rv" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="gl2" style="font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)">Week summary</span>' + pill('From your trainer', 'n') + '</div><p>You trained 3 of 4 days and slept under 7 hours on four nights. Strength is moving up. Sleep is the thing to fix.</p></div>'
        '<div class="sc rv"><div><b data-count="6.9" data-dec="1">6.9<small> h</small></b><span>Sleep</span></div><div><b>6.2<small> / 8</small></b><span>Energy</span></div><div><b>3.4<small> / 8</small></b><span>Soreness</span></div><div><b>4.1<small> / 8</small></b><span>Stress</span></div><div><b>172<small> lb</small></b><span>Weight</span></div><div><b>75<small>%</small></b><span>Workout adherence</span></div></div>'
        + sec('Sleep trend', '<span>Goal 8 h</span>') + '<div class="card rv">' + bar_chart([7.5, None, 6.2, 5.8, 7.0, 7.4, 6.4], ['M', 'T', 'W', 'T', 'F', 'S', 'S'], 9, 8) + '</div>'
        + sec('Daily breakdown') + '<div class="card rv"><div>'
        + ''.join(f'<div class="dc {c}"><span class="dn">{d}</span><div class="grow"><b>{t}</b><span class="s">{s}</span></div>{p}</div>' for d, c, t, s, p in [('MON', 'done', 'Upper body', 'Rated 8 of 10', ''), ('TUE', 'rest', 'Rest day', 'Slept 7.5 h', ''), ('WED', 'done', 'Full body', 'Rated 7 of 10', ''), ('THU', 'done', 'Lower body', 'Rated 8 of 10', pill('Today', 'n')), ('FRI', '', 'No log', 'Nothing logged', ''), ('SAT', 'rest', 'Rest day', 'Slept 7.4 h', ''), ('SUN', '', 'No log', 'Upcoming', '')])
        + '</div></div>'
        + sec('Pros and wins') + '<div class="card rv"><div class="pc"><div class="t">Added 10 lb to box squat.</div><div class="t">Protein hit target 5 days.</div><div class="t">Every session started on time.</div></div></div>'
        + sec('Cons and areas to improve') + '<div class="card flat rv"><div class="pc neg"><div class="t">Four nights under 7 hours of sleep.</div><div class="t">No workout logged Friday.</div></div></div>'
        + sec('What to focus on') + '<div class="card rv" style="gap:12px">' + ''.join(f'<div class="tip">{ib(ic)}<p>{t}</p></div>' for ic, t in [('sleeping', 'Lights out by 10:30 on training nights.'), ('protein', 'Eat 30 g of protein within two hours of lifting.')]) + '</div>'
        + '<button class="btn gh rv" data-open="ro">Export weekly report</button>')
ro = sheet('ro', '<h2>Report options</h2><div class="list"><button class="row">' + ib('week') + '<div class="grow"><b>Export weekly report</b><span>PDF for this week</span></div>' + SV['chev'] + '</button><button class="row">' + ib('people') + '<div class="grow"><b>Share with your trainer</b><span>Jordan Reyes</span></div>' + SV['chev'] + '</button><button class="row">' + ib('settings') + '<div class="grow"><b>Report settings</b><span>Colors and what to show</span></div>' + SV['chev'] + '</button></div>')
add('5 · Weekly report', 'The report starts with a summary in words, then six numbers, one chart, and each day as a row. Wins and areas to improve use solid and hollow bullets, so they differ without color. The empty side is the real No weekly report yet state.', report(True), ro, lab='With data')
add('x', 'x', report(False), ro, lab='Empty', second=True)
add('6 · Report options', 'Export, share and report settings sit behind one button, so the report itself stays clean.', report(True), ro.replace('data-sheet="ro"', 'data-sheet="ro" data-autoopen'))

# 7 spreadsheet
hdrs = ['Exercise', 'Mon', 'Wed', 'Fri', 'Notes']
rows = [('Box squat', '3×8 @ 135', '3×8 @ 140', '3×6 @ 145', 'Box to parallel'), ('Romanian deadlift', '3×10 @ 115', '3×10 @ 115', '3×8 @ 125', 'Slow lowering'), ('Split squat', '2×10 @ 25', '2×10 @ 30', '2×10 @ 30', 'Left knee first'), ('Hip thrust', '3×10 @ 135', '3×10 @ 145', '3×8 @ 155', ''), ('Calf raise', '3×15', '3×15', '3×20', 'Pause at top')]
tbl = '<div class="xl rv"><table><thead><tr>' + ''.join(f'<th>{h}</th>' for h in hdrs) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td class="{"sel" if (ri, ci) == (0, 2) else ("t" if 0 < ci < 4 else "")}">{c}</td>' for ci, c in enumerate(r)) + '</tr>' for ri, r in enumerate(rows)) + '</tbody></table></div>'
xlb = (top('Week 3 program', sub='Spreadsheet · shared with Alex') + '<div class="seg sx rv" data-tabs="xl"><button data-t="1" aria-pressed="false">Week 1</button><button data-t="2" aria-pressed="false">Week 2</button><button data-t="3" aria-pressed="true">Week 3</button><button data-t="4" aria-pressed="false">Week 4</button></div>'
  '<div class="fbar rv"><b>Wed · Box squat</b><span style="font-weight:800">3×8 @ 140</span></div>' + tbl +
  '<p class="sm mut rv">Swipe sideways for the other columns. The first column stays put.</p><div style="display:flex;gap:10px" class="rv"><button class="btn gh" style="flex:1">Add row</button><button class="btn" style="flex:1" data-open="xe">Edit cell</button></div>')
xe = sheet('xe', '<h2>Edit cell</h2><p class="mut">Wed · Box squat</p><div class="fld"><label for="xc">Value</label><input id="xc" value="3×8 @ 140"></div><div class="chips" data-single><button class="chip sm3" aria-pressed="true">Number</button><button class="chip sm3" aria-pressed="false">Text</button></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="xe" style="flex:1">Cancel</button><button class="btn" data-close="xe" style="flex:1.4">Save cell</button></div>')
add('7 · Spreadsheet', 'A trainer program as a real grid: the first column is pinned, a bar above shows the selected cell, and weeks are tabs. Edit cell is a one-field sheet.', xlb, xe, a=None)
add('8 · Edit cell', 'Editing one cell is a sheet with the value and its type.', xlb, xe.replace('data-sheet="xe"', 'data-sheet="xe" data-autoopen'), a=None)

build('progress.html', 'Coach Connect Progress', '', 'Progress',
      'Weight and body fat charts drawn to scale, progress photos with a before-and-after slider, the weekly report, and trainer spreadsheets. Photos and the report show empty and filled side by side. Drag the compare line and tap the range chips.',
      S, extra_js=JS2, extra_css=CSS2)
