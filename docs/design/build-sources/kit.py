import base64, json, re, os
B = os.path.dirname(os.path.abspath(__file__))
GR = [('#FF6B9D','#FB923C'),('#FBBF24','#EF4444'),('#A78BFA','#E879F9'),('#60A5FA','#818CF8'),('#FDE047','#FB923C'),('#FDA4AF','#FB7185'),('#7DD3FC','#A78BFA'),('#FB7185','#FBBF24'),('#FDBA74','#C4B5FD'),('#A78BFA','#FB7185'),('#FCD34D','#F472B6')]
_g = [0]
def g():
    _g[0] += 1
    return 'g%d' % ((_g[0] * 3) % 11 + 1)   # stride 3 so neighbours rarely match
def ib(icon, extra=''):
    return '<span class="ib %s %s"><i class="im i-%s"></i></span>' % (g(), extra, icon)
def pill(txt, cls=None):
    return '<span class="pill %s">%s</span>' % (cls or g(), txt)
def av(txt):
    return '<span class="av %s">%s</span>' % (g(), txt)
def bar(pct, cls=None):
    return '<div class="bar"><i class="%s" style="width:%s%%" data-fill></i></div>' % (cls or g(), pct)
SV = {
 'back': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"><path d="M15 5l-7 7 7 7"/></svg>',
 'plus': '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"><path d="M12 4v16M4 12h16"/></svg>',
 'minus': '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"><path d="M4 12h16"/></svg>',
 'check': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="square"><path d="M4 12.5l5 5L20 6.5"/></svg>',
 'chev': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"><path d="M9 5l7 7-7 7"/></svg>',
 'x': '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"><path d="M5 5l14 14M19 5L5 19"/></svg>',
 'send': '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"><path d="M3 12h16M12 5l7 7-7 7"/></svg>',
 'bell': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter"><path d="M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4"/></svg>',
 'copy':'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square"><rect x="8" y="8" width="12" height="12"/><path d="M4 16V4h12"/></svg>',
}
def top(title, right='', back=True, sub=''):
    return ('<header class="top rv">%s<div class="tt"><h1>%s</h1>%s</div>%s</header>' %
            ('<button class="sq" aria-label="Back">%s</button>' % SV['back'] if back else '', title,
             '<p class="sub">%s</p>' % sub if sub else '', right))
def sec(label, right=''):
    return '<div class="eyb rv"><span>%s</span>%s</div>' % (label, right)
def steps(i, n=3, frac=45):
    out = ''
    for k in range(n):
        st = 'done' if k < i else ('now' if k == i else '')
        out += '<span class="stp %s"><i%s></i></span>' % (st, ' style="width:%d%%"' % frac if k == i else '')
    return '<div class="stps rv" aria-label="Chapter %d of %d">%s</div>' % (i + 1, n, out)
_NAVMAP = {0: 'home', 1: 'workout', 3: 'files', 4: 'nutrition'}
_S = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="url(#ng)" stroke-width="2.6" stroke-linejoin="miter" stroke-linecap="square">%s</svg>'
NV = {
 'home': _S % '<path d="M3.5 11.5L12 4l8.5 7.5V20.5h-5.5v-6h-6v6H3.5z"/>',
 'dumbbell': _S % '<path d="M2.5 9.5v5M5.5 6.5v11M18.5 6.5v11M21.5 9.5v5M5.5 12h13"/>',
 'sparkles': _S % '<path d="M10 3.5l2.2 6.3 6.3 2.2-6.3 2.2L10 20.5l-2.2-6.3L1.5 12l6.3-2.2z"/><path d="M19 3v5M16.5 5.5h5"/>',
 'file': _S % '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
 'fork': _S % '<path d="M4.5 3v6a2.5 2.5 0 005 0V3M7 11.5V21M17.5 21V3c-2.2 1-3.5 4-3.5 8h3.5"/>',
}
def dock(active=None, items=None, ai=False, open_plus=True):
    """The app's real bottom bar: Home, Workout (larger), center + button, Files (or AI Coach), Nutrition."""
    if isinstance(active, int):
        active = _NAVMAP.get(active)
    slot4 = ('ai', 'energy', 'AI Coach') if ai else ('files', 'picture', 'Files')
    def item(key, ic, lb, big=False):
        return '<a class="dki%s%s" href="#" onclick="return false" aria-label="%s"><span class="ico">%s</span><b>%s</b></a>' % (
            ' on' if key == active else '', ' bigi' if big else '', lb, NV[ic], lb)
    out = (item('home', 'home', 'Home') + item('workout', 'dumbbell', 'Workout', True) +
           '<span class="fabw"><button class="fab" data-open="plus" aria-label="Add">%s</button></span>' % SV['plus'] +
           item(slot4[0], 'sparkles' if ai else 'file', slot4[2]) + item('nutrition', 'fork', 'Nutrition'))
    return '<nav class="dock"><svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="ng" gradientUnits="userSpaceOnUse" x1="2" y1="22" x2="22" y2="2"><stop offset="0" stop-color="#FCD34D"/><stop offset="1" stop-color="#F472B6"/></linearGradient></defs></svg>%s</nav>' % out + plus_sheet()
def plus_sheet():
    rows = [('protein', 'Log a meal', 'Search, scan or quick add'), ('dumbbell', 'Log a workout', 'Sets, reps and weight'), ('hydration', 'Log water or vitals', 'Sleep, steps, weight'), ('energy', 'Ask the AI coach', 'Questions, photos, plan changes'), ('picture', 'Add a note or file', 'For you or your trainer')]
    return sheet('plus', '<h2>Add something</h2><div class="list">' + ''.join(
        '<button class="row"><span class="ib %s"><i class="im i-%s"></i></span><div class="grow"><b>%s</b><span>%s</span></div>%s</button>' % (g(), ic, t, s, SV['chev']) for ic, t, s in rows) + '</div>')
def sheet(name, inner):
    return '<div class="scrim" data-scrim="%s"></div><section class="sheet" data-sheet="%s" role="dialog"><div class="grab"></div>%s</section>' % (name, name, inner)
def screen(title, note, body, extra='', nodock=False, lab='', second=False):
    return ('<template data-t="%s" data-n="%s"%s%s><div class="sb"><span>9:41</span><span>5G &nbsp;82%%</span></div><div class="scr%s">%s</div>%s</template>' % (
        title, note, (' data-lab="%s"' % lab) if lab else '', ' data-second="1"' if second else '', ' nd' if nodock else '', body, extra))

CSS = r'''
:root{--pbg:#E9E9E5;--pink:#0A0A0A;--pmut:#4F4F4F;--pline:#0A0A0A;--pcard:#FFFFFF}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--pbg:#050505;--pink:#F2F2F2;--pmut:#A8A8A8;--pline:#F2F2F2;--pcard:#161616;color-scheme:dark}}
:root[data-theme="dark"]{--pbg:#050505;--pink:#F2F2F2;--pmut:#A8A8A8;--pline:#F2F2F2;--pcard:#161616;color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--pbg);color:var(--pink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 56px;overflow-x:hidden}
.wrap{max-width:1180px;margin:0 auto}
.hd{display:flex;flex-wrap:wrap;gap:20px 40px;align-items:flex-end;justify-content:space-between;margin-bottom:36px}
.hd h1{font-size:clamp(30px,5vw,48px);line-height:1;letter-spacing:-1.5px;margin:0 0 10px;font-weight:900;text-wrap:balance}
.hd p{margin:0;max-width:60ch;color:var(--pmut);font-size:16px;line-height:1.5}
.modes{display:inline-flex;border:3px solid var(--pline);background:var(--pcard);box-shadow:4px 4px 0 var(--pline);border-radius:10px;overflow:hidden}
.modes button{min-height:44px;padding:0 18px;border:0;background:transparent;color:var(--pink);font:800 14px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}
.modes button+button{border-left:3px solid var(--pline)}
.modes button[aria-pressed="true"]{background:var(--pink);color:var(--pbg)}
.board{display:flex;flex-direction:column;gap:56px}
.fig{display:flex;flex-direction:column;gap:16px}
.cap{max-width:70ch}
.cap h2{margin:0 0 4px;font-size:22px;letter-spacing:-.4px;font-weight:900}
.cap p{margin:0;color:var(--pmut);font-size:15px;line-height:1.5}
.pair{display:flex;flex-wrap:wrap;gap:28px}
.hint{color:var(--pmut);font-size:14px;margin:0}
.pw{display:flex;flex-direction:column;gap:12px;width:min(360px,100%);flex:none}
.plab{align-self:flex-start;font-size:13px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;border:3px solid var(--pline);border-radius:6px;padding:6px 10px;background:var(--pcard)}

/* ---------- phone ---------- */
.phone{--bg:#F2F2F0;--sf:#FFFFFF;--chip:#FFFFFF;--soft:#E3E3DF;--ink:#0A0A0A;--mut:#575757;--bd:#0A0A0A;--sh:#0A0A0A;--on:#FFFFFF;--blk:#0A0A0A;
 position:relative;width:min(360px,100%);height:740px;border:3px solid var(--bd);border-radius:36px;background:var(--bg);color:var(--ink);box-shadow:8px 8px 0 var(--sh);overflow:hidden;display:flex;flex-direction:column;flex:none}
.phone.dk{--bg:#0B0B0B;--sf:#161616;--chip:#1F1F1F;--soft:#262626;--ink:#F2F2F2;--mut:#A6A6A6;--bd:#F2F2F2;--sh:#8A8A8A;--on:#0A0A0A;--blk:#F2F2F2;color-scheme:dark}
:where(.phone) :where(button,input,textarea){font-family:inherit;color:inherit}
.sb{display:flex;justify-content:space-between;padding:12px 26px 4px;font-size:13px;font-weight:800;flex:none}
.scr{flex:1;overflow-y:auto;overflow-x:hidden;padding:10px 16px 120px;display:flex;flex-direction:column;gap:16px;scrollbar-width:none}
.scr::-webkit-scrollbar{display:none}
.phone h1{font-size:25px;line-height:1.05;letter-spacing:-.6px;margin:0;font-weight:900}
.phone h2{font-size:19px;line-height:1.15;letter-spacing:-.3px;margin:0;font-weight:900}
.phone p{margin:0;font-size:15px;line-height:1.42}
.mut{color:var(--mut)}
.sm{font-size:13px;line-height:1.35}
.num{font-variant-numeric:tabular-nums;font-weight:900;letter-spacing:-1px}
.top{display:flex;align-items:center;gap:12px;min-height:48px}
.top .tt{flex:1;min-width:0}
.top .sub{font-size:13px;color:var(--mut);margin-top:2px}
.sq{width:44px;height:44px;flex:none;display:grid;place-items:center;background:var(--sf);border:3px solid var(--bd);border-radius:12px;box-shadow:3px 3px 0 var(--sh);cursor:pointer;padding:0}
.eyb{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.card{background:var(--sf);border:3px solid var(--bd);border-radius:10px;box-shadow:5px 5px 0 var(--sh);padding:14px;display:flex;flex-direction:column;gap:12px}
.card.flat{box-shadow:none}
.card.blk{background:var(--blk);color:var(--on);border-color:var(--bd)}
.card.blk .mut{color:var(--on);opacity:.72}
.card.sq0{border-radius:2px}
.card.hi{border-radius:22px 6px 22px 6px}
.btn{min-height:50px;padding:0 18px;border:3px solid var(--bd);border-radius:10px;background:var(--blk);color:var(--on);font-weight:900;font-size:16px;box-shadow:4px 4px 0 var(--sh);display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;white-space:nowrap;width:100%}
.btn.gh{background:var(--sf);color:var(--ink)}
.btn.sm2{min-height:44px;width:auto;font-size:14px;padding:0 16px;box-shadow:3px 3px 0 var(--sh)}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{min-height:44px;padding:0 16px;border:3px solid var(--bd);border-radius:999px;background:var(--chip);color:var(--ink);font-weight:800;font-size:15px;white-space:nowrap;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.chip[aria-pressed="true"]{background:var(--blk);color:var(--on);box-shadow:3px 3px 0 var(--sh)}
.chip .tick{display:none}.chip[aria-pressed="true"] .tick{display:inline-flex}
.seg{display:flex;border:3px solid var(--bd);border-radius:10px;background:var(--chip);overflow:hidden}
.seg button{flex:1;min-height:44px;border:0;background:transparent;font-weight:800;font-size:14px;cursor:pointer;white-space:nowrap;padding:0 8px;color:var(--ink)}
.seg button+button{border-left:3px solid var(--bd)}
.seg button[aria-pressed="true"]{background:var(--blk);color:var(--on)}
.pill{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border:2.5px solid var(--bd);border-radius:999px;font-size:12px;font-weight:900;color:#0A0A0A;white-space:nowrap}
.pill.n{background:var(--soft);color:var(--ink)}
.ib{width:44px;height:44px;flex:none;border:3px solid var(--bd);border-radius:12px;display:grid;place-items:center;color:#0A0A0A}
.ib.lg{width:56px;height:56px;border-radius:14px}
.ib.lg .im{width:36px;height:36px}
.im{display:block;width:28px;height:28px;background-size:contain;background-repeat:no-repeat;background-position:center}
.av{width:44px;height:44px;flex:none;border-radius:50%;border:3px solid var(--bd);display:grid;place-items:center;font-weight:900;font-size:15px;color:#0A0A0A}
.bar{height:16px;border:3px solid var(--bd);border-radius:8px;background:var(--chip);overflow:hidden}
.bar i{display:block;height:100%;border-right:3px solid var(--bd)}
.stps{display:flex;gap:8px}
.stp{flex:1;height:14px;border:3px solid var(--bd);background:var(--chip);border-radius:7px;overflow:hidden;display:block}
.stp i{display:block;height:100%;width:0;background:var(--blk)}
.stp.done i{width:100%}.stp.now i{width:45%}
.fld{display:flex;flex-direction:column;gap:6px}
.fld label{font-size:12px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut)}
.fld input,.fld textarea{min-height:48px;padding:10px 12px;border:3px solid var(--bd);border-radius:8px;background:var(--sf);font-size:16px;font-weight:700;width:100%;resize:none}
.fld input:focus,.fld textarea:focus,.btn:focus-visible,.chip:focus-visible,.sq:focus-visible,.seg button:focus-visible,.row:focus-visible{outline:3px solid var(--ink);outline-offset:3px}
.list{display:flex;flex-direction:column}
.row{display:flex;align-items:center;gap:12px;min-height:60px;padding:10px 0;border-top:2px solid var(--bd);width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;font-size:15px;cursor:pointer}
.list>.row:first-child{border-top:0}
.row .grow{flex:1;min-width:0}
.row .grow b{display:block;font-size:16px;line-height:1.2}
.row .grow span{display:block;font-size:13px;color:var(--mut);margin-top:2px}
.stepper{display:flex;align-items:center;gap:12px}
.stepper button{width:44px;height:44px;border:3px solid var(--bd);border-radius:10px;background:var(--chip);display:grid;place-items:center;cursor:pointer;box-shadow:3px 3px 0 var(--sh);padding:0}
.stepper output{min-width:56px;text-align:center;font-size:30px}
.sw{width:56px;height:34px;border:3px solid var(--bd);border-radius:999px;background:var(--chip);position:relative;cursor:pointer;flex:none;padding:0}
.sw::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--ink);transition:transform .2s}
.sw[aria-pressed="true"]{background:var(--blk)}.sw[aria-pressed="true"]::after{transform:translateX(22px);background:var(--on)}
.rng{position:relative;height:44px;display:flex;align-items:center;touch-action:none}
.rng .trk{position:absolute;left:0;right:0;height:18px;border:3px solid var(--bd);border-radius:9px;background:var(--chip);overflow:hidden}
.rng .fl{position:absolute;left:0;top:0;bottom:0;width:50%;border-right:3px solid var(--bd)}
.rng .kb{position:absolute;left:0;top:2px;width:40px;height:40px;border:3px solid var(--bd);border-radius:10px;background:var(--blk);box-shadow:3px 3px 0 var(--sh);cursor:grab;display:grid;place-items:center;color:var(--on);font-size:13px;font-weight:900}
[hidden]{display:none!important}
.chip.tile{display:flex;flex-direction:column;align-items:flex-start;gap:10px;white-space:normal;border-radius:10px;min-height:96px;padding:12px;text-align:left;width:100%;position:relative;font-size:15px;line-height:1.15}
.chip.tile .tick{position:absolute;top:10px;right:10px}
.chip.tile small{display:block;font-weight:600;font-size:13px;opacity:.78;margin-top:3px;line-height:1.25}
.chip.tile[aria-pressed="true"] .ib{border-color:var(--on)}
.chip.tile.wide{flex-direction:row;align-items:center;min-height:64px;gap:12px}
.scr>*{flex:none}
.scr.nd{padding-bottom:24px}
.card.blk .trk{border-color:var(--on);background:var(--blk)}.card.blk .fl{border-right-color:var(--on)}.card.blk .kb{background:var(--on);border-color:var(--on);box-shadow:none}
.kb::after{content:"";width:4px;height:16px;border-radius:2px;background:var(--blk);box-shadow:8px 0 0 var(--blk),-8px 0 0 var(--blk)}
.lot{width:96px;height:96px;flex:none}
.lot.lg{width:140px;height:140px}
.dock{position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);align-items:start;padding:8px 4px 14px;background:var(--sf);border-top:3px solid var(--bd);z-index:5}
.dki{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:56px;color:var(--ink);text-decoration:none}
.dki .ico{width:54px;height:36px;display:grid;place-items:center;border-radius:10px;color:var(--ink)}
.dki b{font-size:12px;font-weight:800;color:var(--mut);display:block;white-space:nowrap}
.dki.bigi .ico svg{width:34px;height:34px}
.dki.on .ico{background:var(--blk);box-shadow:3px 3px 0 var(--sh)}
.dki.on b{color:var(--ink);font-weight:900}
.fabw{display:flex;justify-content:center;align-items:flex-start;height:56px}
.dock .fab{width:62px;height:62px;margin-top:-30px;flex:none;border:3px solid var(--bd);border-radius:50%;background:linear-gradient(135deg,#FCD34D,#F472B6);color:#0A0A0A;box-shadow:4px 4px 0 var(--sh);display:grid;place-items:center;cursor:pointer;padding:0}
.dock .fab svg{width:30px;height:30px}
.scrim{position:absolute;inset:0;background:rgba(0,0,0,.5);opacity:0;visibility:hidden;z-index:20}
.sheet{position:absolute;left:0;right:0;bottom:0;max-height:88%;overflow-y:auto;background:var(--sf);border-top:3px solid var(--bd);border-radius:24px 24px 0 0;padding:10px 16px 24px;display:flex;flex-direction:column;gap:14px;z-index:21;visibility:hidden}
.drawer{top:0;right:auto;width:84%;max-height:none;border-top:0;border-right:3px solid var(--bd);border-radius:0 24px 24px 0;padding:14px 16px 20px;box-shadow:6px 0 0 var(--sh)}
.phone.mini{height:590px}
.phone.mini .scr{padding-bottom:20px}
.grab{width:48px;height:6px;border-radius:3px;background:var(--bd);align-self:center;flex:none}
.cert-st{width:28px;height:28px;display:grid;place-items:center;border:2.5px solid var(--bd);border-radius:50%;background:var(--blk);color:var(--on);flex:none}
.up{display:flex;align-items:center;gap:12px;min-height:72px;padding:12px;border:3px dashed var(--bd);border-radius:10px;background:var(--bg);cursor:pointer}
.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;font-size:34px;letter-spacing:3px;line-height:1}
.tl{display:flex;flex-direction:column;gap:0;padding-left:4px}
.tl .st{display:flex;gap:14px;position:relative;padding-bottom:16px}
.tl .st:last-child{padding-bottom:0}
.tl .st::before{content:"";position:absolute;left:15px;top:32px;bottom:0;width:3px;background:var(--bd)}
.tl .st:last-child::before{display:none}
.tl .n{width:34px;height:34px;flex:none;border:3px solid var(--bd);border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:14px;background:var(--chip)}
.tl .st.cur .n{background:var(--blk);color:var(--on)}
.tl .st b{display:block;font-size:15px;margin-top:5px}
.tl .st div span{display:block;font-size:13px;color:var(--mut);margin-top:2px}
.g1{background:linear-gradient(135deg,#FF6B9D,#FB923C)}.g2{background:linear-gradient(135deg,#FBBF24,#EF4444)}.g3{background:linear-gradient(135deg,#A78BFA,#E879F9)}.g4{background:linear-gradient(135deg,#60A5FA,#818CF8)}.g5{background:linear-gradient(135deg,#FDE047,#FB923C)}.g6{background:linear-gradient(135deg,#FDA4AF,#FB7185)}.g7{background:linear-gradient(135deg,#7DD3FC,#A78BFA)}.g8{background:linear-gradient(135deg,#FB7185,#FBBF24)}.g9{background:linear-gradient(135deg,#FDBA74,#C4B5FD)}.g10{background:linear-gradient(135deg,#A78BFA,#FB7185)}.g11{background:linear-gradient(135deg,#FCD34D,#F472B6)}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
'''

JS = r'''
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const G=window.gsap;
const FMT=(o,v)=>o.dataset.fmt==='ftin'?Math.floor(v/12)+"'"+(v%12)+'"':(o.dataset.pre!==undefined?o.dataset.pre:'$')+v+(o.dataset.suf||'');
if(G){try{G.registerPlugin(ScrollTrigger,Draggable)}catch(e){}}
function sum(ph){$$('[data-sum]',ph).forEach(o=>{const grp=$('[data-g="'+o.dataset.sum+'"]',ph);if(grp)o.textContent=$$('.chip[aria-pressed="true"]',grp).length})}
function calc(ph){$$('[data-from]',ph).forEach(o=>{const src=$('[data-o="'+o.dataset.from+'"]',ph);if(!src)return;const v=+src.dataset.v,m=+(o.dataset.mul||1),d=+(o.dataset.disc||0);o.textContent=(o.dataset.pre||'$')+Math.round(v*m*(1-d/100)).toLocaleString()})}
function openSheet(ph,n){const s=$('[data-sheet="'+n+'"]',ph),c=$('[data-scrim="'+n+'"]',ph);if(!s)return;s.style.visibility='visible';c.style.visibility='visible';
 const dw=s.classList.contains('drawer');
 if(G&&!RM){G.to(c,{opacity:1,duration:.2});if(dw)G.fromTo(s,{xPercent:-105},{xPercent:0,duration:.45,ease:'power3.out'});else G.fromTo(s,{yPercent:105,y:0},{yPercent:0,y:0,duration:.5,ease:'back.out(1.1)'})}else{c.style.opacity=1;if(G)G.set(s,dw?{xPercent:0}:{yPercent:0,y:0});else s.style.transform='none'}}
function closeSheet(ph,n){const s=$('[data-sheet="'+n+'"]',ph),c=$('[data-scrim="'+n+'"]',ph);if(!s)return;
 const done=()=>{s.style.visibility='hidden';c.style.visibility='hidden'};
 const dw=s.classList.contains('drawer');
 if(G&&!RM){G.to(c,{opacity:0,duration:.2});G.to(s,dw?{xPercent:-105,duration:.3,ease:'power2.in',onComplete:done}:{yPercent:105,duration:.3,ease:'power2.in',onComplete:done})}else{c.style.opacity=0;if(G)G.set(s,dw?{xPercent:-105}:{yPercent:105});done()}}
function init(ph){
 const sc=$('.scr',ph);if(G)$$('.sheet',ph).forEach(s=>G.set(s,s.classList.contains('drawer')?{xPercent:-105}:{yPercent:105}));
 $$('.sheet[data-autoopen]',ph).forEach(s=>setTimeout(()=>openSheet(ph,s.dataset.sheet),RM?0:650));
 if(G&&!RM){
  G.from($$('.rv',ph),{y:16,opacity:0,duration:.5,stagger:.055,ease:'power3.out',clearProps:'transform,opacity'});
  $$('[data-count]',ph).forEach(el=>{const t=+el.dataset.count,d=+(el.dataset.dec||0),o={v:0},p=el.dataset.pre||'',s=el.dataset.suf||'';
   G.to(o,{v:t,duration:1.1,ease:'power2.out',onUpdate:()=>el.textContent=p+o.v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g,',')+s})});
  $$('[data-fill]',ph).forEach(el=>{const w=el.style.width;G.fromTo(el,{width:'0%'},{width:w,duration:.9,delay:.25,ease:'power3.out'})});
  $$('.sr',ph).forEach(el=>{G.from(el,{y:22,opacity:0,duration:.5,clearProps:'transform,opacity',scrollTrigger:{trigger:el,scroller:sc,start:'top 94%'}})});
 }
 ph.addEventListener('pointerdown',e=>{const t=e.target.closest('.btn,.chip,.sq,.row,.stepper button,.dki,.up');if(t&&G&&!RM)G.to(t,{scale:.95,duration:.1})});
 ['pointerup','pointercancel','pointerleave'].forEach(ev=>ph.addEventListener(ev,e=>{if(G&&!RM)$$('.btn,.chip,.sq,.row,.stepper button,.dki,.up',ph).forEach(t=>{if(G.getProperty(t,'scale')<1)G.to(t,{scale:1,duration:.4,ease:'back.out(3)'})})},true));
 ph.addEventListener('click',e=>{
  const ch=e.target.closest('.chip');
  if(ch&&!ch.closest('[data-nopick]')){const grp=ch.parentElement;if(grp.dataset.single!==undefined)$$('.chip',grp).forEach(c=>c.setAttribute('aria-pressed','false'));
   const max=+(grp.dataset.max||99),on=ch.getAttribute('aria-pressed')==='true';
   if(!on&&$$('.chip[aria-pressed="true"]',grp).length>=max&&grp.dataset.single===undefined){if(G&&!RM)G.fromTo(grp,{x:-6},{x:0,duration:.5,ease:'elastic.out(1,.3)'});return}
   ch.setAttribute('aria-pressed',grp.dataset.single!==undefined?'true':String(!on));
   if(G&&!RM)G.fromTo(ch,{scale:.86},{scale:1,duration:.45,ease:'back.out(4)'});sum(ph)}
  const sg=e.target.closest('.seg button');if(sg){$$('button',sg.parentElement).forEach(b=>b.setAttribute('aria-pressed','false'));sg.setAttribute('aria-pressed','true');
   const tabs=sg.parentElement.dataset.tabs;if(tabs){$$('[data-p^="'+tabs+':"]',ph).forEach(p=>p.hidden=p.dataset.p!==tabs+':'+sg.dataset.t);const sh=$('[data-p="'+tabs+':'+sg.dataset.t+'"]',ph);if(sh&&G&&!RM)G.from(sh,{y:10,opacity:0,duration:.35,clearProps:'all'})}}
  const sw=e.target.closest('.sw');if(sw)sw.setAttribute('aria-pressed',String(sw.getAttribute('aria-pressed')!=='true'));
  const st=e.target.closest('[data-st]');if(st){const o=$('output',st.parentElement),v=Math.max(+o.dataset.min||0,Math.min(+o.dataset.max||99,+o.textContent+ +st.dataset.st));o.textContent=v;if(G&&!RM)G.fromTo(o,{scale:1.25},{scale:1,duration:.4,ease:'back.out(3)'})}
  const op=e.target.closest('[data-open]');if(op)openSheet(ph,op.dataset.open);
  const cl=e.target.closest('[data-close]');if(cl)closeSheet(ph,cl.dataset.close);
  if(e.target.matches('.scrim'))closeSheet(ph,e.target.dataset.scrim);
  const cp=e.target.closest('[data-copy]');if(cp){const l=$('span',cp)||cp,old=l.textContent;try{navigator.clipboard.writeText(cp.dataset.copy).catch(()=>{})}catch(x){}l.textContent='Copied';setTimeout(()=>l.textContent=old,1400)}
  const tg=e.target.closest('[data-toggle]');if(tg){const t=$('[data-p="'+tg.dataset.toggle+'"]',ph);if(t)t.hidden=!t.hidden}
 });
 $$('.rng',ph).forEach(r=>{
  const kb=$('.kb',r),fl=$('.fl',r),mn=+r.dataset.min,mx=+r.dataset.max,stp=+r.dataset.step||1,out=r.dataset.out;
  const span=()=>r.clientWidth-40;
  const set=v=>{v=Math.round(Math.max(mn,Math.min(mx,v))/stp)*stp;const x=(v-mn)/(mx-mn)*span();
   if(G)G.set(kb,{x});else kb.style.transform='translateX('+x+'px)';fl.style.width=(x+20)+'px';kb.textContent='';
   const o=$('[data-o="'+out+'"]',ph);if(o){o.dataset.v=v;o.textContent=FMT(o,v)}calc(ph)};
  set(+r.dataset.val);
  if(G&&window.Draggable)Draggable.create(kb,{type:'x',bounds:{minX:0,maxX:span()},inertia:false,onDrag(){const v=mn+this.x/span()*(mx-mn);const o=$('[data-o="'+out+'"]',ph);const q=Math.round(v/stp)*stp;fl.style.width=(this.x+20)+'px';if(o){o.dataset.v=q;o.textContent=FMT(o,q)}calc(ph)},onDragEnd(){set(mn+this.x/span()*(mx-mn))}});
 });
 $$('.lot',ph).forEach(el=>{const d=window.LOT&&LOT[el.dataset.l];if(d&&window.lottie)lottie.loadAnimation({container:el,renderer:'svg',loop:true,autoplay:!RM,animationData:JSON.parse(JSON.stringify(d))})});
 sum(ph);calc(ph);
 (window.HOOKS||[]).forEach(h=>h(ph));
}
let MODE=window.MODE0||'both';$$('.modes button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.m===MODE)));
function render(){
 const b=$('#board');b.innerHTML='';
 $$('template[data-t]').forEach(t=>{
  if(t.dataset.second)return;
  const grp=[t];const nx=t.nextElementSibling;if(nx&&nx.dataset&&nx.dataset.second)grp.push(nx);
  const f=document.createElement('section');f.className='fig';
  f.innerHTML='<div class="cap"><h2>'+t.dataset.t+'</h2><p>'+t.dataset.n+'</p></div><div class="pair"></div>';
  (MODE==='both'?['','dk']:[MODE==='dark'?'dk':'']).forEach(th=>{
   grp.forEach(tt=>{
    const w=document.createElement('div');w.className='pw';
    if(tt.dataset.lab){const l=document.createElement('div');l.className='plab';l.textContent=tt.dataset.lab;w.appendChild(l)}
    const p=document.createElement('div');p.className='phone '+th+(window.MINI?' mini':'');p.appendChild(tt.content.cloneNode(true));w.appendChild(p);$('.pair',f).appendChild(w)})});
  b.appendChild(f)});
 $$('.phone').forEach(init);
}
$$('.modes button').forEach(bt=>bt.addEventListener('click',()=>{MODE=bt.dataset.m;$$('.modes button').forEach(x=>x.setAttribute('aria-pressed',String(x===bt)));render()}));
render();
'''

def build(fname, title, desc, h1, lead, screens, lots=(), extra_js='', extra_css='', mode='both'):
    extra_js = 'window.MODE0="%s";' % mode + extra_js
    body = ''.join(screens)
    used = sorted(set(re.findall(r'i-([a-z0-9]+)', body)))
    icss = ''
    for n in used:
        p = os.path.join(B, 'ic', n + '.png')
        if os.path.exists(p):
            icss += '.i-%s{background-image:url(data:image/png;base64,%s)}' % (n, base64.b64encode(open(p, 'rb').read()).decode())
    lot = ''
    if lots:
        lot = '<script>window.LOT={%s};</script>' % ','.join('"%s":%s' % (k, open(os.path.join(B, 'lot', k + '.json')).read()) for k in lots)
    html = ('<meta charset="utf-8">\n<title>%s</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>%s%s</style>\n'
            '<div class="wrap"><header class="hd"><div><h1>%s</h1><p>%s</p></div>'
            '<div class="modes" role="group" aria-label="Phone theme"><button data-m="light" aria-pressed="false">Light</button><button data-m="dark" aria-pressed="false">Dark</button><button data-m="both" aria-pressed="true">Both</button></div></header>'
            '<main class="board" id="board"></main></div>%s%s'
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>'
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>'
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Draggable.min.js"></script>'
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>'
            '<script>window.HOOKS=[];%s</script><script>%s</script>') % (title, CSS + extra_css, icss, h1, lead, body, lot, extra_js, JS)
    os.makedirs(os.path.join(B, 'out'), exist_ok=True)
    open(os.path.join(B, 'out', fname), 'w').write(html)
    print(fname, len(html) // 1024, 'KB')
