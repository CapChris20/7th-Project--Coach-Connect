from kit import *

CSS2 = r'''
.poster{background:var(--blk);color:var(--on);border:3px solid var(--bd);box-shadow:6px 6px 0 var(--sh);border-radius:4px;overflow:hidden}
.poster .wm{padding:18px 16px 14px;display:flex;flex-direction:column;gap:2px}
.poster .wm b{font-size:58px;line-height:.92;letter-spacing:-3px;font-weight:900;display:block}
.poster .wm b+b{letter-spacing:-2px}
.mq{border-top:3px solid var(--on);overflow:hidden;white-space:nowrap;height:44px;display:flex;align-items:center}
.mq .tr{display:inline-flex;gap:0;will-change:transform}
.mq span{font-weight:900;font-size:15px;font-style:italic;padding-right:18px;letter-spacing:.2px}
.mq span i{font-style:normal;padding-left:18px}
.soc{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.soc .btn{font-size:15px;padding:0 10px}
.soc .lg{width:26px;height:26px;border-radius:7px;background:#fff;border:2px solid var(--bd);display:grid;place-items:center;flex:none}
.soc .lg .im{width:16px;height:16px}
.or{display:flex;align-items:center;gap:12px;font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.or::before,.or::after{content:"";flex:1;height:3px;background:var(--bd)}
.fld .in{position:relative;display:flex}
.fld .in input{padding-right:64px}
.eye{position:absolute;right:0;top:0;bottom:0;width:60px;border:0;border-left:3px solid var(--bd);background:var(--soft);font-weight:900;font-size:12px;letter-spacing:.8px;text-transform:uppercase;cursor:pointer;border-radius:0 5px 5px 0}
.fld.err input{border-style:dashed}
.msg{display:flex;gap:8px;align-items:flex-start;font-size:13px;font-weight:700;line-height:1.3}
.msg[hidden]{display:none}
.msg i{width:18px;height:18px;flex:none;border-radius:50%;background:var(--blk);color:var(--on);display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:900;margin-top:1px}
.rules{display:flex;flex-wrap:wrap;gap:8px}
.rl{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border:3px solid var(--bd);border-radius:999px;font-size:13px;font-weight:800;background:var(--chip)}
.rl::before{content:"";width:10px;height:10px;border:2.5px solid var(--bd);border-radius:50%}
.rl[data-ok="1"]{background:var(--blk);color:var(--on)}
.rl[data-ok="1"]::before{background:var(--on);border-color:var(--on)}
.lnk{background:none;border:0;padding:0;min-height:44px;font-weight:900;font-size:15px;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:3px;cursor:pointer;color:var(--ink)}
.foot{display:flex;justify-content:center;align-items:center;gap:6px;font-size:15px;color:var(--mut);flex-wrap:wrap}
.hero{font-size:34px!important;line-height:1!important;letter-spacing:-.6px!important}
.big{width:104px;height:104px;border-radius:26px;border:3px solid var(--bd);display:grid;place-items:center;box-shadow:6px 6px 0 var(--sh)}
.big .im{width:68px;height:68px}
'''

JS2 = r'''
HOOKS.push(function(ph){
 const pw=()=>{const i=$('.pw-in',ph);if(!i)return;const v=i.value,r={len:v.length>=8,let:/[A-Za-z]/.test(v),num:/\d/.test(v)};
  $$('[data-rule]',ph).forEach(el=>el.dataset.ok=r[el.dataset.rule]?'1':'0');
  const n=(r.len?1:0)+(r.let?1:0)+(r.num?1:0),b=$('[data-str]',ph);if(b)b.style.width=Math.round(n/3*100)+'%';
  const c=$('.cf-in',ph),m=$('[data-match]',ph);if(c&&m){m.hidden=!c.value;const ok=c.value===v;m.querySelector('span').textContent=ok?'Passwords match':'Passwords do not match';m.querySelector('i').textContent=ok?'✓':'!'}};
 ph.addEventListener('input',e=>{if(e.target.matches('.pw-in,.cf-in'))pw()});
 ph.addEventListener('click',e=>{
  const ey=e.target.closest('.eye');if(ey){const i=ey.parentElement.querySelector('input');const s=i.type==='password';i.type=s?'text':'password';ey.textContent=s?'Hide':'Show'}
  const tb=e.target.closest('[data-theme-btn]');if(tb)ph.classList.toggle('dk');
 });
 pw();
 const mq=$('.mq .tr',ph);if(mq&&window.gsap&&!RM){const w=mq.scrollWidth/2;gsap.fromTo(mq,{x:0},{x:-w,duration:12,ease:'none',repeat:-1})}
 const cd=$('[data-cd]',ph);if(cd){let t=30;const f=$('[data-cdbar]',ph);const tick=()=>{cd.textContent='0:'+String(t).padStart(2,'0');if(f)f.style.width=((30-t)/30*100)+'%'};tick();
  const id=setInterval(()=>{if(!document.body.contains(ph)){clearInterval(id);return}t=t>0?t-1:30;tick()},1000)}
 const big=$('.big',ph);if(big&&window.gsap&&!RM)gsap.from(big,{scale:.4,rotate:-12,duration:.8,ease:'elastic.out(1,.5)',clearProps:'transform'});
});
'''

def fld(label, val='', ph='', typ='text', err=None, pw=None, cls=''):
    eye = '<button class="eye" type="button">Show</button>' if typ == 'password' else ''
    pcls = ' %s' % pw if pw else ''
    e = '<div class="msg"><i>!</i><span>%s</span></div>' % err if err else ''
    return ('<div class="fld rv%s%s"><label>%s</label><div class="in"><input class="%s" type="%s" value="%s" placeholder="%s" aria-label="%s">%s</div>%s</div>'
            % (' err' if err else '', ' ' + cls if cls else '', label, (pw or ''), typ, val, ph, label, eye, e))

def social(verb):
    return ('<div class="soc rv"><button class="btn gh"><span class="lg"><i class="im i-apple"></i></span>Apple</button><button class="btn gh"><span class="lg"><i class="im i-google"></i></span>Google</button></div>')

S = []

# 1 Welcome
S.append(screen('1 · Welcome', 'The wordmark is a black poster block with a looping tagline strip. The two illustrations become a small pair under it. The moon button flips this phone between light and dark.',
 '<div style="display:flex;justify-content:flex-end" class="rv"><button class="sq" data-theme-btn aria-label="Switch theme"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/></svg></button></div>'
 '<div class="poster rv"><div class="wm"><b>COACH</b><b>CONNECT</b></div><div class="mq"><div class="tr">' + ''.join('<span>One Day or Day One!<i>/</i></span>' for _ in range(8)) + '</div></div></div>'
 '<div style="display:grid;grid-template-columns:1.15fr 1fr;gap:14px" class="rv">'
 '<div class="card flat" style="padding:6px;align-items:center;border-radius:60px 10px 10px 10px"><div class="lot" data-l="robot" style="width:100%;height:112px"></div></div>'
 '<div class="card" style="align-items:center;justify-content:center;gap:6px;border-radius:10px 60px 10px 10px">' + ib('dumbbell', 'lg') + '<b style="font-size:14px;text-align:center">Plans, logs, check-ins</b></div></div>'
 '<h1 class="hero rv">Trainers and clients, finally in sync.</h1>'
 '<p class="mut rv">One platform for programming, tracking, and communication.</p>'
 '<button class="btn rv">Get started %s</button>' % SV['chev'] +
 '<div class="foot rv">Already have an account? <button class="lnk">Sign in</button></div>', nodock=True))

# 2 Sign up
S.append(screen('2 · Create account', 'Role is the first choice because it changes everything after it. Password rules fill in as you type, so there is no error after the fact. Try the password and confirm fields.',
 top('Create your account') +
 '<div class="seg rv" data-tabs="role"><button data-t="c" aria-pressed="true">I am a client</button><button data-t="t" aria-pressed="false">I am a trainer</button></div>'
 '<p class="sm mut rv" data-p="role:c">Find a trainer, or join the one you already have with a code.</p><p class="sm mut rv" data-p="role:t" hidden>Build your profile, set your rates and take on clients.</p>' +
 fld('Full name', 'Alex Rivera', 'Alex Rivera') + fld('Email address', 'alex@example.com', 'name@example.com', 'email') +
 fld('Password', 'strong1', 'Create a password', 'password', pw='pw-in') +
 '<div class="rules rv"><span class="rl" data-rule="len">8+ characters</span><span class="rl" data-rule="let">A letter</span><span class="rl" data-rule="num">A number</span></div>'
 '<div class="bar rv"><i class="%s" style="width:66%%" data-str></i></div>' % g() +
 fld('Confirm password', '', 'Type it again', 'password', pw='cf-in') +
 '<div class="msg" data-match hidden><i>!</i><span></span></div>'
 '<button class="btn rv">Create account</button><div class="or rv">or sign up with</div>' + social('up') +
 '<div class="foot rv">Already a member? <button class="lnk">Sign in</button></div>', nodock=True))

# 3 Login
S.append(screen('3 · Sign in', 'Fewer decisions: two fields, one forgot link, two social buttons. Show/Hide is a labeled button so it is not a guessed icon.',
 top('Sign in', sub='Welcome back') +
 '<h1 class="hero rv" style="margin-top:6px">Pick up where you left off.</h1>' +
 fld('Email address', 'alex@example.com', 'name@example.com', 'email') +
 fld('Password', 'lift2heavy', 'Your password', 'password') +
 '<div style="display:flex;justify-content:flex-end" class="rv"><button class="lnk">Forgot password?</button></div>'
 '<button class="btn rv">Sign in</button><div class="or rv">or continue with</div>' + social('in') +
 '<div class="foot rv">New here? <button class="lnk">Create an account</button></div>', nodock=True))

# 4 Login errors + wrong account sheet
S.append(screen('4 · Sign-in errors', 'Errors sit under the field they belong to, with a dashed border and a plain sentence, so state never depends on color. The sheet is the wrong-account-type case.',
 top('Sign in', sub='Welcome back') +
 '<h1 class="hero rv" style="margin-top:6px">Pick up where you left off.</h1>' +
 fld('Email address', 'alex@exmple', 'name@example.com', 'email', err='Please enter a valid email address.') +
 fld('Password', 'lift2', 'Your password', 'password', err='Incorrect password. Please try again.') +
 '<div style="display:flex;justify-content:flex-end" class="rv"><button class="lnk">Forgot password?</button></div>'
 '<button class="btn rv" data-open="wrong">Sign in</button><p class="sm mut rv">Tap Sign in to see the wrong-account-type sheet.</p>',
 sheet('wrong', '<span class="pill %s" style="align-self:flex-start">Wrong account type</span><h2>This email belongs to a trainer account</h2><p class="mut">You are on the client sign-in. Switch to trainer sign-in, or use a different email.</p>'
  '<button class="btn" data-close="wrong">Switch to trainer sign-in</button><button class="btn gh" data-close="wrong">Use a different email</button>' % g()), nodock=True))

# 5 Forgot
S.append(screen('5 · Forgot password', 'One field and one action. The not-found message is written out so it can be tested against the real wording.',
 top('Reset password') +
 '<h1 class="hero rv" style="margin-top:6px">Forgot it? It happens.</h1>'
 '<p class="mut rv">Enter the email on your account and we will send a reset link.</p>' +
 fld('Email address', 'alex@example.com', 'name@example.com', 'email') +
 '<button class="btn rv">Send reset link</button>'
 '<div class="card flat rv sr" style="flex-direction:row;gap:12px;align-items:flex-start">' + ib('settings') + '<div><b>No account found?</b><p class="sm mut" style="margin-top:2px">Check the spelling, or create an account with this email.</p></div></div>'
 '<div class="foot rv sr"><button class="lnk">Back to sign in</button></div>', nodock=True))

# 6 Sent
S.append(screen('6 · Check your inbox', 'The confirmation names the address and gives two real next steps. Resend runs on a visible countdown bar instead of a dead disabled button.',
 top('Reset password') +
 '<div class="big %s rv" style="margin-top:10px"><i class="im i-checkin"></i></div>' % g() +
 '<h1 class="hero rv">Check your inbox.</h1>'
 '<p class="mut rv">We sent a reset link to <b style="color:var(--ink)">alex@example.com</b>. Open it on this phone.</p>'
 '<button class="btn rv">Open mail app</button>'
 '<div class="card flat rv" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><b>Resend link</b><span class="num" style="font-size:20px" data-cd>0:30</span></div><div class="bar"><i class="%s" style="width:20%%" data-cdbar></i></div><p class="sm mut">Nothing yet? Look in spam, then resend.</p></div>' % g() +
 '<div class="foot rv sr"><button class="lnk">Back to sign in</button></div>', nodock=True))

build('welcome-and-sign-in.html', 'Coach Connect Welcome and Sign In', '', 'Welcome and sign in',
      'Six screens for first launch, account creation, sign-in and password reset. Try the password rules, the Show button, the moon button on the welcome screen, and the error sheet.',
      S, lots=('robot',), extra_js=JS2, extra_css=CSS2)
