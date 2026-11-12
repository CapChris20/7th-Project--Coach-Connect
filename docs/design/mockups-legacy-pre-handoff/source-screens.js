(function(){
/* ---------- icons ---------- */
var I={
home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
dumb:'<path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
fork:'<path d="M7 3v8a2 2 0 0 0 4 0V3M9 3v18M17 3c-2 2-3 5-3 8h3v10"/>',
back:'<path d="M15 5l-7 7 7 7"/>',
sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5 7-5s7 1.5 7 5M17 4.5a3.5 3.5 0 0 1 0 7M22 20c0-2.5-1.5-4-4-4.5"/>',
drop:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
steps:'<path d="M7 20c-2 0-3-1.5-3-3.5S5 12 7 12s3 2 3 4-1 4-3 4zM17 14c-2 0-3-1.5-3-3.5S15 6 17 6s3 2 3 4-1 4-3 4z"/>',
cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
msg:'<path d="M4 5h16v11H9l-5 4z"/>',
chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
doc:'<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6"/>',
camera:'<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="3.5"/>',
history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
check:'<path d="M5 12l5 5 9-10"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
flame:'<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
heart:'<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
flag:'<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
x:'<path d="M6 6l12 12M18 6L6 18"/>',
star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
filter:'<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
edit:'<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
photo:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/>',
play:'<path d="M8 5l11 7-11 7z"/>',
scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
inbox:'<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5"/>',
send:'<path d="M4 12l16-8-6 16-3-7z"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/>',
pin:'<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
grid:'<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'
};
var ic=function(n){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+I[n]+'</svg>'};

/* ---------- component kit ---------- */
var G={brand:'var(--brand)',water:'var(--g-water)',sleep:'var(--g-sleep)',energy:'var(--g-energy)'};
var ibtn=function(n,l){return '<div class="icon-btn" role="img" aria-label="'+l+'">'+ic(n)+'</div>'};
var hdr=function(e,t,r){return '<div class="row"><div><p class="eyebrow">'+e+'</p><h3 class="title">'+t+'</h3></div>'+(r||'')+'</div>'};
var bar=function(t,r){return '<div class="row">'+ibtn('back','Back')+'<h3 class="title" style="margin:0;font-size:20px">'+t+'</h3>'+(r||'<span style="width:44px"></span>')+'</div>'};
var steps=function(n){var s='';for(var i=0;i<9;i++)s+='<i class="'+(i<n?'d':'')+'"></i>';return '<div class="steps" aria-label="Step '+n+' of 9">'+s+'</div>'};
var top=function(n){return '<div class="row">'+ibtn('back','Back')+'<button class="mini ghost" type="button">Skip</button></div>'+steps(n)};
var lot=function(f,big){return '<div class="center"><div class="'+(big?'lot-lg':'lot')+'" data-lot="'+f+'" role="img" aria-label="Animation"></div></div>'};
var H=function(t){return '<h3 class="title big">'+t+'</h3>'};
var lbl=function(t){return '<p class="label">'+t+'</p>'};
var help=function(t){return '<p class="help">'+t+'</p>'};
var btn=function(t,c){return '<button class="btn '+(c||'')+'" type="button">'+t+'</button>'};
var plain='background:var(--panel);color:var(--ink)';
var btnPlain=function(t){return '<button class="btn" type="button" style="'+plain+'">'+t+'</button>'};
var sm=function(t,c){return btn(t,'sm '+(c||''))};
var field=function(p,v){return '<input class="field" placeholder="'+p+'" value="'+(v||'')+'" aria-label="'+p+'">'};
var fld=function(l,p,v){return '<div>'+lbl(l)+field(p,v)+'</div>'};
var area=function(p){return '<textarea class="field" rows="3" placeholder="'+p+'" aria-label="'+p+'"></textarea>'};
var card=function(h,s){return '<div class="card" style="'+(s||'')+'">'+h+'</div>'};
var pill=function(t,g){return '<span class="pill" style="background:'+g+'">'+t+'</span>'};
var av=function(t,g,c){return '<div class="av '+(c||'')+'" style="background:'+g+'">'+t+'</div>'};
var opts=function(items,sel,multi){return '<div class="opts" data-multi="'+!!multi+'">'+items.map(function(o,i){return '<button type="button" class="opt" aria-pressed="'+((sel||[]).indexOf(i)>-1)+'"><span class="oi" style="background:'+(o[3]||G.brand)+'">'+ic(o[0])+'</span><span><b>'+o[1]+'</b><em>'+(o[2]||'')+'</em></span><span class="ck">'+ic('check')+'</span></button>'}).join('')+'</div>'};
var grid=function(items,sel){return '<div class="ogrid" data-multi="true">'+items.map(function(o,i){return '<button type="button" class="opt vert" aria-pressed="'+((sel||[]).indexOf(i)>-1)+'"><span class="oi" style="background:'+(o[2]||G.water)+'">'+ic(o[0])+'</span><b>'+o[1]+'</b></button>'}).join('')+'</div>'};
var chipRow=function(items,sel,multi,scroll){return '<div class="quick'+(scroll?' scrollx':'')+'" data-multi="'+!!multi+'">'+items.map(function(t,i){return '<button type="button" class="chip" aria-pressed="'+(i===sel||(Array.isArray(sel)&&sel.indexOf(i)>-1))+'">'+t+'</button>'}).join('')+'</div>'};
var seg=function(items,sel){return '<div class="seg" style="grid-template-columns:repeat('+items.length+',1fr)">'+items.map(function(t,i){return '<button type="button" class="chip" aria-pressed="'+(i===sel)+'">'+t+'</button>'}).join('')+'</div>'};
var nums=function(n,sel,cols){return '<div class="days" style="grid-template-columns:repeat('+(cols||n)+',1fr)">'+Array.apply(null,Array(n)).map(function(_,i){return '<button type="button" class="chip" aria-pressed="'+(i+1===sel)+'">'+(i+1)+'</button>'}).join('')+'</div>'};
var tile=function(c,l,v,s){return '<div class="tile" style="background:'+c+'"><b>'+l+'</b><span class="n'+(String(v).length>7?' sm':'')+'">'+v+'</span><small>'+s+'</small></div>'};
var tiles=function(a){return '<div class="tiles">'+a.map(function(x){return tile(x[0],x[1],x[2],x[3])}).join('')+'</div>'};
var list=function(rows){return '<div class="card list">'+rows.map(function(r){return '<div class="item"><div><span>'+r[0]+'</span>'+(r[1]?'<em>'+r[1]+'</em>':'')+'</div>'+(r[2]?'<button class="mini" type="button">'+r[2]+'</button>':'')+(r[3]?'<span class="v">'+r[3]+'</span>':'')+'</div>'}).join('')+'</div>'};
var tg=function(t,s,on){return '<div class="item"><div><span>'+t+'</span><em>'+s+'</em></div><button class="sw" type="button" role="switch" aria-label="'+t+'" aria-pressed="'+!!on+'"></button></div>'};
var tgList=function(rows){return '<div class="card list">'+rows.map(function(r){return tg(r[0],r[1],r[2])}).join('')+'</div>'};
var hero=function(e,t,p,b,l){return '<div class="hero"'+(l?'':' style="grid-template-columns:1fr"')+'><div><p class="eyebrow" style="color:#0A0A0F">'+e+'</p><h3 class="title">'+t+'</h3><p>'+p+'</p>'+b+'</div>'+(l?'<div class="lot" data-lot="'+l+'" role="img" aria-label="Animation"></div>':'')+'</div>'};
var st3=function(a){return '<div class="st3">'+a.map(function(x){return '<div class="st"><b>'+x[0]+'</b><span>'+x[1]+'</span></div>'}).join('')+'</div>'};
var empty=function(i,g,t,p,b){return '<div class="card empty"><div class="oi" style="background:'+g+'">'+ic(i)+'</div><h3 class="title" style="font-size:20px">'+t+'</h3><p class="help">'+p+'</p>'+(b||'')+'</div>'};
var thumb=function(g){return '<div class="thumb" style="background:'+g+'">'+ic('play')+'</div>'};
var nav=function(on){var n=[['home','Home'],['dumb','Workout'],null,['spark','Coach'],['fork','Nutrition']];return '<nav class="nav" aria-label="Main">'+n.map(function(x,i){return x?'<a'+(i===on?' class="on"':'')+'>'+ic(x[0])+x[1]+'</a>':'<a><span class="fab">'+ic('plus')+'</span></a>'}).join('')+'</nav>'};
var ph=function(cap,body,o){o=o||{};return '<section class="board"><h2>'+cap+'</h2><div class="phone"><div class="status"><span>9:41</span><span>5G ▮▮▮</span></div><div class="scroll">'+body+'</div>'+(o.cta?'<div class="cta">'+o.cta+'</div>':'')+(o.nav!=null?nav(o.nav):'')+(o.sheet?'<div class="dim"></div><div class="sheet">'+o.sheet+'</div>':'')+'</div></section>'};
var two=function(a,b){return '<div class="pair">'+a+b+'</div>'};
var ctaTwo=function(a,b){return '<div class="stack">'+a+b+'</div>'};
var cont=btn('Continue','brand');
var minis=function(a){return a.map(function(t){return '<button class="mini" type="button">'+t+'</button>'}).join('')};
var clientCard=function(init,g,name,tag,a,b,c){return card('<div class="row" style="justify-content:flex-start;gap:12px">'+av(init,g)+'<div><b style="font:700 16px var(--display)">'+name+'</b><br>'+pill(tag,G.energy)+'</div></div>'+st3([[a,'Age'],[b,'Weight'],[c,'Height']]),'display:grid;gap:12px')};

/* ---------- screens ---------- */
var S={};
S.onboarding=[
 ['Step 1 · About you', top(1)+lot('personal-info.json')+'<div>'+H('Tell us about yourself')+help('This helps us personalize your plan.')+'</div>'+fld('Weight (lbs)','Enter weight')+fld('Height','e.g. 5 ft 11')+fld('Age','Enter age')+'<div>'+lbl('Gender')+seg(['Male','Female','Other'],0)+'</div>',{cta:cont}],
 ['Step 2 · Experience', top(2)+lot('fitness-experience.json')+H('What\'s your fitness experience?')+opts([['flame','Beginner','New to working out'],['bolt','Intermediate','Work out regularly',G.sleep],['target','Advanced','Experienced athlete',G.energy]],[1]),{cta:cont}],
 ['Step 3 · Goals', top(3)+lot('fitness-goal.json')+'<div>'+H('What\'s your main goal?')+help('Select all that apply.')+'</div>'+opts([['flame','Lose fat','Burn more than you eat'],['dumb','Build muscle','Get stronger and bigger',G.sleep],['heart','Maintain health','Stay active and consistent',G.energy],['bolt','Athletic performance','Speed, power, endurance',G.water],['moon','Mental health','Train for your mind'],['check','Consistency','Build the habit',G.energy]],[1,2],true),{cta:cont}],
 ['Step 4 · Equipment', top(4)+lot('equipment.json')+'<div>'+H('What equipment do you have?')+help('Select all that apply.')+'</div>'+grid([['dumb','Full gym'],['dumb','Dumbbells',G.sleep],['target','Resistance bands',G.energy],['users','Pull-up bar',G.water],['user','Bodyweight only']],[0,1])+'<div>'+lbl('Where do you train?')+seg(['Home','Gym','Both'],2)+'</div>',{cta:cont}],
 ['Step 5 · Frequency', top(5)+lot('training-frequency.json',1)+'<div>'+H('How many days can you train?')+help('Most people see results with 3 to 5 days.')+'</div>'+nums(7,4)+'<div>'+lbl('Best time of day')+seg(['Morning','Midday','Evening'],0)+'</div>',{cta:cont}],
 ['Step 6 · Injuries', top(6)+lot('injuries.json')+'<div>'+H('Any injuries or limitations?')+help('We\'ll build around them safely.')+'</div>'+area('e.g. lower back pain, knee issues')+'<div>'+lbl('Quick pick')+chipRow(['None','Knee','Back','Shoulder','Wrist'],0,true)+'</div>',{cta:cont}],
 ['Step 6 · Exercises', top(6)+'<div>'+H('Exercises you prefer')+help('Tap what you like. Skip anytime.')+'</div>'+field('Search exercises')+'<div>'+lbl('Chest and push')+chipRow(['Barbell bench','Dumbbell bench','Cable fly','Push-up','Dips'],[0,3],true)+'</div><div>'+lbl('Legs')+chipRow(['Squat','Leg press','Lunges','RDL'],[0],true)+'</div>',{cta:cont}],
 ['Step 7 · Trainer', top(7)+lot('trainer-code.json')+'<div>'+H('Do you have a trainer?')+help('Enter their invite code, or train on your own.')+'</div>'+opts([['users','Yes, I have a code','Connect to your trainer'],['user','No, I\'ll train independently','Browse trainers later',G.sleep]],[1])+fld('Trainer code','e.g. CC-4821'),{cta:cont}],
 ['Step 8 · Your situation', top(8)+lot('philosophy.json')+'<div>'+H('Describe your situation')+help('All optional. Helps your coach plan.')+'</div><div>'+lbl('Stress')+seg(['Low','Moderate','High'],1)+'</div><div>'+lbl('Sleep')+seg(['Poor','Fair','Good'],1)+'</div><div>'+lbl('Energy')+seg(['Low','Moderate','High'],2)+'</div>'+area('Anything else we should know?'),{cta:cont}],
 ['Step 9 · AI features', top(9)+'<div>'+H('AI-powered features')+help('Optional. You can change this in settings.')+'</div>'+tgList([['AI fitness coach','Chat any time',1],['Workout generator','Plans built for you',1],['Smart progress tracking','Insights from your logs',0],['Form and recovery tips','Daily suggestions',0]]),{cta:ctaTwo(btn('Enable AI','brand'),btnPlain('No, skip'))}]
];

var homeEmpty=hdr('Monday, Nov 9','Good evening, Cade',ibtn('sliders','Settings'))+hero('Today','No workout planned','Build a plan and your day shows up here.',btn('Generate plan'),'fitness-goal.json')+'<div>'+lbl('Today\'s numbers')+tiles([[G.water,'Water','0 oz','Goal 96 oz'],[G.sleep,'Sleep','–','Not logged'],[G.energy,'Energy','–','Rate 1 to 10'],[G.brand,'Steps','0','Goal 8,000']])+'</div><div>'+lbl('Nutrition')+list([['Breakfast','No meals logged','Log'],['Lunch','No meals logged','Log'],['Dinner','No meals logged','Log']])+'</div>'+card('<p class="eyebrow">Your trainer</p><h3 class="title" style="font-size:18px">Not connected yet</h3><p class="help" style="margin:6px 0 12px">Browse coaches by specialty and price.</p>'+sm('Find a trainer','" style="'+plain),'');
S.client=[
 ['Home · empty',homeEmpty,{nav:0}],
 ['Home · dashboard',hdr('Monday, Nov 9','Welcome back, Cade',ibtn('sliders','Settings'))+hero('Your dashboard','Everything in one place','Log workouts, view stats, track progress.','<div class="quick" style="margin-bottom:12px">'+minis(['Workouts','Analytics','Progress','History'])+'</div>'+btn('Explore dashboard'))+tiles([[G.brand,'Workout','None','Nothing planned'],[G.water,'Water','0 oz','Log water']])+card('<p class="eyebrow">Training agenda</p><h3 class="title" style="font-size:18px">Ready when you are</h3><p class="help" style="margin:6px 0 0">No lifts on the board yet. Today\'s agenda is wide open.</p>'),{nav:0}],
 ['Notes and files',hdr('Shared with Chris','Notes and files',ibtn('plus','Add'))+card('<p class="eyebrow">Files and documents</p><div class="row" style="justify-content:flex-start;gap:12px;margin:6px 0 12px"><span class="av" style="background:var(--brand);border-radius:14px">11</span><div><b style="font:700 16px var(--display)">Files shared</b><p class="help">Between you and your coach</p></div></div><div class="quick">'+minis(['Docs','Photos','Notes','Uploads'])+'</div>')+btn('Open notes and files','brand'),{nav:0,sheet:lbl('Add to notes and files')+grid([['photo','Photo',G.brand],['play','Video',G.sleep],['doc','PDF or doc',G.water],['grid','Spreadsheet',G.energy]])}],
 ['Log workout',bar('Log workout')+fld('Workout day','Chest and Back, Leg Day')+card('<div class="row"><b style="font:700 16px var(--display)">Barbell bench press</b>'+ibtn('x','Remove')+'</div>'+'<div class="stack" style="margin-top:12px">'+[1,2,3].map(function(n){return '<div class="pair" style="grid-template-columns:36px 1fr 1fr"><b style="align-self:center;font:700 14px var(--display)">Set '+n+'</b>'+field('Reps','8')+field('lbs','135')+'</div>'}).join('')+sm('Add set','" style="'+plain)+'</div>','display:grid')+btnPlain('Add exercise'),{cta:btn('Save workout','brand')}],
 ['Daily check-in',hdr('Takes 10 seconds','Check in',ibtn('x','Close'))+['Muscle soreness','Energy level','Stress level'].map(function(t,i){return card('<div class="row" style="justify-content:flex-start;gap:10px;margin-bottom:10px"><span class="oi" style="display:grid;place-items:center;width:36px;height:36px;border:2px solid var(--line);border-radius:10px;color:#0A0A0F;background:'+[G.brand,G.energy,G.sleep][i]+'">'+ic(['flame','bolt','moon'][i])+'</span><div><b style="font:700 15px var(--display)">'+t+'</b><p class="help">Rate how you feel, 1 to 10</p></div></div>'+nums(10,[0,6,0][i],5),'')}).join(''),{cta:btn('Save check-in','brand')}],
 ['Mood and rating',hdr('How are you?','Mood check-in')+card(lbl('Mood today')+seg(['Low','Meh','Okay','Good','Great'],3)+'<div style="height:14px"></div>'+lbl('Post-workout rating')+nums(10,0,5))+'<div>'+lbl('Notes for your trainer')+area('Anything worth flagging?')+'</div>',{cta:btn('Save','brand')}],
 ['Profile',bar('Profile',ibtn('edit','Edit'))+'<div class="center" style="gap:10px;justify-items:center">'+av('CC',G.brand,'lg')+'<div style="text-align:center"><h3 class="title">Cade Cunningham</h3><p class="help">@cade_cunningham</p></div>'+pill('Build muscle',G.energy)+'</div><div>'+lbl('Personal info')+list([['Full name','','','Cade Cunningham'],['Email','','','cc@gmail.com'],['Age','','','21']])+'</div><div>'+lbl('Training')+list([['Goal','','','Build muscle'],['Level','','','Intermediate'],['Days per week','','','4'],['Equipment','','','Full gym, dumbbells']])+'</div>',{nav:0}],
 ['Workout plans',chipRow(['Workout plans','Exercise library'],0)+hero('Welcome back, Cade','Build muscle','Intermediate, 21 yrs, 183 lbs.',two(btn('Regenerate'),''))+'<div>'+lbl('Profile cards · tap to edit')+tiles([[G.sleep,'Level','Intermediate','Tap to edit'],[G.brand,'Goal','Build muscle','Tap to edit'],[G.water,'Equipment','Full gym','Tap to edit'],[G.energy,'Frequency','4 days/wk','Tap to edit']])+'</div>'+card('<p class="help" style="margin-bottom:12px">1 of 3 plans used this month</p>'+two(btn('Open plan','brand sm'),btn('Generate new','sm" style="'+plain)),''),{nav:1}],
 ['Exercise library',chipRow(['Workout plans','Exercise library'],1)+hdr('Technique videos','Exercise library')+field('Search goals, exercises, muscles')+chipRow(['Body recomp','Fat loss','Muscle gain','Mobility'],0,false,true)+'<div>'+lbl('Recommended for you')+'<div class="stack">'+[['Full body routine','Jeremy Ethier',G.brand],['Dumbbell-only workout','Jeremy Ethier',G.water]].map(function(v){return card(thumb(v[2])+'<div class="row" style="margin-top:10px"><div><b style="font:700 15px var(--display)">'+v[0]+'</b><p class="help">'+v[1]+'</p></div>'+pill('Intermediate',G.sleep)+'</div>','display:grid')}).join('')+'</div></div>',{nav:1}]
];

var ring='<div class="card ring" style="padding:20px 14px"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6B9D"/><stop offset="1" stop-color="#FB923C"/></linearGradient></defs><circle cx="60" cy="60" r="48" stroke="var(--chip)"/><circle cx="60" cy="60" r="48" stroke="url(#rg)" stroke-dasharray="301.6" stroke-dashoffset="300" transform="rotate(-90 60 60)"/></svg><div class="c"><b>2,050</b><span>kcal left</span></div></div>';
var macro=function(n,g,v){return '<div class="macro"><span>'+n+'</span><div class="bar"><i style="width:0;background:'+g+'"></i></div><em>'+v+'</em></div>'};
var bubble=function(t,me){return '<div class="bubble '+(me?'me':'ai')+'">'+t+'</div>'};
var composer=function(p){return '<div class="pair">'+field(p)+sm('Send','brand')+'</div>'};
S.nutrition=[
 ['Nutrition',hdr('Monday, Nov 9','Nutrition')+ring+card('<div class="stack">'+macro('Protein',G.brand,'0 / 154g')+macro('Carbs',G.water,'0 / 205g')+macro('Fat',G.sleep,'0 / 68g')+'</div>')+'<div>'+lbl('Meals')+list([['Breakfast','0 kcal','Log'],['Lunch','0 kcal','Log'],['Dinner','0 kcal','Log'],['Snacks','0 kcal','Log']])+'</div>'+btn('Search foods','brand'),{nav:4}],
 ['Meal · breakfast',bar('Breakfast')+empty('fork',G.brand,'Nothing logged','Scan a barcode, search, or add calories yourself.')+tiles([[G.brand,'Scan','Barcode','Fastest'],[G.water,'Search','Database','Brands'],[G.sleep,'Quick add','Manual','Calories']]),{nav:4}],
 ['Food search',bar('Search foods')+field('Search foods, brands, restaurants')+chipRow(['Recent','Favorites','Menus'],0,false,true)+list([['Real Chocolate Chip Cookies','Nabisco · 1 serving','Log','500 cal'],['Sweetened Cereal','General Mills · 1 cup','Log','385 cal'],['Almond Milk','Silk · 1 cup','Log','60 cal']]),{nav:4}],
 ['Quick add',bar('Quick add')+'<div>'+lbl('Saved foods')+chipRow(['Chocolate chip cookies','Cereal with milk'],-1,false,true)+'</div>'+fld('Food name','e.g. Almond milk')+'<div>'+lbl('Servings')+seg(['0.5','1','2','3'],1)+'</div>'+fld('Calories','e.g. 60')+'<div>'+lbl('Macros')+chipRow(['Protein','Carbs','Fat'],[],true)+'</div>',{cta:btn('Log food','brand')}],
 ['Weekly momentum',hdr('Your week','Momentum')+card('<div class="week" style="margin-bottom:12px">'+['S','M','T','W','T','F','S'].map(function(d,i){return '<button type="button" class="chip" aria-pressed="'+(i===1)+'" style="min-height:56px"><small>'+d+'</small>'+(8+i)+'</button>'}).join('')+'</div><p class="help">Your journey starts this week. Log a meal to begin a streak.</p>')+'<div>'+lbl('Daily nutrition facts')+list([['Calories','Goal 2,050','','0'],['Protein','Goal 154g','','0g'],['Water','Goal 96 oz','','0 oz']])+'</div>',{nav:4}],
 ['AI coach · home',hero('Your coach','AI Coach','Training and nutrition guidance, any time.',btn('Start chatting'),'fitness-goal.json')+'<div>'+lbl('Try asking')+opts([['dumb','Plan today\'s workout','Built from your goals'],['fork','Review my meals','Calories and macros',G.energy],['chart','How am I doing?','This week\'s trends',G.sleep]])+'</div>',{nav:3,cta:composer('Ask your coach')}],
 ['AI coach · chat',hdr('AI Coach','Ask anything',ibtn('history','History'))+bubble('Hi Cade. I can plan workouts, check your meals and answer form questions. Where do you want to start?')+'<div class="quick">'+minis(['Plan today','Review meals','Fix my squat'])+'</div>'+bubble('Build me a 4-day push, pull, legs split.',1)+bubble('Here is a 4-day split: Push, Pull, Legs, then Upper. Want it at 60 minutes per session?'),{cta:composer('Message your coach')}],
 ['AI coach · history',bar('Chat history',ibtn('plus','New chat'))+field('Search conversations')+'<div>'+lbl('Earlier')+list([['Recomp roadmap','Yesterday','Open'],['Daily metrics drop','2 days ago','Open'],['Protein playbook','Nov 5','Open'],['Step streak check','Nov 3','Open'],['Calorie strategy','Nov 1','Open']])+'</div>']
];

S.trainer=[
 ['Home · roster',hdr('Trainer','Your roster',ibtn('sliders','Settings'))+tiles([[G.brand,'Active','4','Clients'],[G.sleep,'Pending','0','Requests']])+'<div class="pair" style="grid-template-columns:1fr 1fr">'+btnPlain('All clients')+btnPlain('Requests')+'</div>'+clientCard('CC',G.brand,'Cade Cunningham','Build muscle','21','183 lbs','5\'9"')+clientCard('C2',G.water,'Cap20','Lose fat','21','183 lbs','5\'10"')+card('<p class="eyebrow">Weekly report</p><div class="row"><div><b style="font:700 16px var(--display)">Cade\'s report</b><p class="help">Oct 19 to Oct 25</p></div>'+sm('Open','brand')+'</div>'),{nav:0}],
 ['Client · progress',bar('Cade Cunningham')+chipRow(['Progress','Nutrition','Sessions','Notes'],0,false,true)+tiles([[G.brand,'Weight','170','Was 183 lbs'],[G.water,'Workout','None','Not logged today'],[G.sleep,'Sleep','–','Not logged'],[G.energy,'Water','0 oz','Not logged']])+card('<p class="eyebrow">Mood and soreness</p><p class="help" style="margin-top:6px">Cade hasn\'t checked in today.</p>'),{nav:0}],
 ['Inbox',hdr('Requests','Inbox')+empty('inbox',G.brand,'You\'re all caught up','Client requests, workout plan asks and other messages will land here.',sm('Open messages','brand')),{nav:0}],
 ['Sessions · calendar',bar('Sessions')+seg(['Calendar','List'],0)+card('<div class="row" style="margin-bottom:10px"><b style="font:700 16px var(--display)">November 2026</b></div><div class="cal">'+['S','M','T','W','T','F','S'].map(function(d){return '<span class="dow">'+d+'</span>'}).join('')+Array.apply(null,Array(30)).map(function(_,i){var d=i+1;return '<button type="button" class="chip'+([12,17,24].indexOf(d)>-1?' has':'')+'" aria-pressed="'+(d===9)+'">'+d+'</button>'}).join('')+'</div>')+help('Tap a day to see sessions.'),{nav:0,cta:btn('New session','brand')}],
 ['New session',bar('New session')+card('<div class="row" style="justify-content:flex-start;gap:12px">'+av('CC',G.sleep)+'<div><b style="font:700 15px var(--display)">Cade Cunningham</b><p class="help">Build muscle · 4 days/week</p></div></div>')+'<div>'+lbl('Date · November')+'<div class="week">'+['M','T','W','T','F','S','S'].map(function(d,i){return '<button type="button" class="chip" aria-pressed="'+(i===0)+'"><small>'+d+'</small>'+(9+i)+'</button>'}).join('')+'</div></div><div>'+lbl('Start time')+'<div class="slots">'+['6:00 AM','7:30 AM','9:00 AM','12:00 PM','4:30 PM','6:00 PM'].map(function(t,i){return '<button type="button" class="chip" aria-pressed="'+(i===2)+'">'+t+'</button>'}).join('')+'</div></div><div>'+lbl('Length')+seg(['30m','45m','60m','90m'],2)+'</div><div>'+lbl('Where')+seg(['In person','Video'],0)+'</div>'+fld('Notes for Cade','Focus, equipment, what to bring'),{cta:btn('Book Mon, Nov 9 · 9:00 AM · 60 min','brand')}],
 ['Document maker',bar('Untitled document',ibtn('send','Share'))+'<div class="quick scrollx">'+minis(['B','I','U','List','Link','Undo'])+'</div><div class="paper">Start writing. Meal plans, program notes and client handouts live here.</div>',{cta:two(sm('Save draft','" style="'+plain),sm('Send to Cade','brand'))}],
 ['Spreadsheet',bar('Untitled sheet',ibtn('send','Share'))+field('Type a value or =formula')+'<div class="sheetg"><div class="h"></div><div class="h">A</div><div class="h">B</div><div class="h">C</div>'+[1,2,3,4,5,6,7,8].map(function(r){return '<div class="h">'+r+'</div><div></div><div></div><div></div>'}).join('')+'</div>',{cta:btn('Save','brand')}],
 ['Quick actions',hdr('Shortcuts','Quick actions')+tiles([[G.brand,'Messages','0','No unread'],[G.water,'Photos','0','Progress'],[G.sleep,'Workout plans','2','Active'],[G.energy,'Documents','Editor','Rich text']])+list([['Progress','Weight, mood, sessions','Open'],['Nutrition','Client macros','Open'],['Notes and files','11 shared','Open']]),{nav:0}]
];

var trainerCard=function(init,g,n,sp,sg,meta,rate){return card('<div class="row" style="justify-content:flex-start;gap:12px">'+av(init,g)+'<div><b style="font:700 17px var(--display)">'+n+'</b><br>'+pill(sp,sg)+'</div></div><p class="help" style="margin:10px 0">'+meta+'</p>'+two(btn('View profile','brand sm'),'<button class="mini" type="button">Message</button>'),'')};
S.market=[
 ['Welcome','<div class="center" style="margin-top:10px"><p class="logo" style="text-align:center">Coach<br>Connect</p></div>'+lot('role-selection.json',1)+'<p class="help" style="text-text-align:center;text-align:center">Your trainer and you, in one place.</p>',{cta:ctaTwo(btn('Create account','brand'),btnPlain('Sign in'))}],
 ['Sign in',bar('Sign in')+fld('Email','you@email.com')+fld('Password','Password')+'<button class="mini ghost" type="button" style="justify-self:start;padding-left:0">Forgot password?</button>'+'<div class="stack">'+btnPlain('Continue with Apple')+btnPlain('Continue with Google')+'</div>',{cta:btn('Sign in','brand')}],
 ['Choose role',H('How will you use Coach Connect?')+lot('role-selection.json')+opts([['dumb','I\'m a client','Train with a coach or on my own'],['users','I\'m a trainer','Manage clients and sessions',G.sleep]],[0]),{cta:cont}],
 ['Home · find a trainer',hdr('Monday, Nov 9','Good evening, Cade')+card('<p class="eyebrow">Find your perfect trainer</p><div class="stack" style="margin:10px 0 14px">'+['Custom workout plans','Live coaching support','Real-time progress tracking','Message and schedule sessions'].map(function(t){return '<div class="row" style="justify-content:flex-start;gap:10px"><span class="oi" style="display:grid;place-items:center;width:26px;height:26px;border:2px solid var(--line);border-radius:8px;background:var(--g-energy);color:#0A0A0F">'+ic('check').replace('<svg','<svg style="width:16px;height:16px;stroke-width:3"')+'</span><span style="font:500 14px var(--body)">'+t+'</span></div>'}).join('')+'</div>'+btn('Find a trainer','brand'),'')+tiles([[G.water,'Water','0 oz','Log water'],[G.sleep,'Sleep','–','Not logged']]),{nav:0}],
 ['Directory',hdr('Marketplace','Find a trainer')+'<div class="pair">'+field('Search name or city')+sm('Filter','brand')+'</div>'+chipRow(['All','Strength','Weight loss','HIIT','Yoga','Mobility'],0,false,true)+trainerCard('CC',G.brand,'Cap Chris','Weight loss',G.water,'San Diego · In person · $120/mo<br>New coach, no reviews yet')+trainerCard('SM',G.sleep,'Shane Marion','Strength',G.energy,'Livonia, MI · Hybrid · $180/mo<br>4.9 stars from 38 reviews'),{nav:0}],
 ['Filters',hdr('Marketplace','Find a trainer')+'<div class="pair">'+field('Search name or city')+sm('Filter','brand')+'</div>'+trainerCard('CC',G.brand,'Cap Chris','Weight loss',G.water,'San Diego · In person · $120/mo'),{nav:0,sheet:'<div class="row"><h3 class="title" style="font-size:20px">Filters</h3>'+ibtn('x','Close')+'</div><div>'+lbl('Sort by')+chipRow(['Newest','Price low','Price high'],0,false,true)+'</div><div>'+lbl('Specialty')+chipRow(['Strength','Cardio','Yoga','HIIT','Rehab'],[0],true)+'</div>'+tgList([['Available only','Hide full rosters',0]])+'<div>'+lbl('Max price per month')+'<div class="pair" style="grid-template-columns:1fr 1fr">'+field('Min $/mo','100')+field('Max $/mo','500')+'</div></div><div>'+lbl('Session type')+seg(['Remote','In person','Both'],2)+'</div>'+btn('Show 10 trainers','brand')}],
 ['Trainer profile',bar('Profile')+'<div class="center" style="gap:10px;justify-items:center">'+av('CC',G.brand,'lg')+'<div style="text-align:center"><h3 class="title">Cap Chris</h3><p class="help">San Diego · In person</p></div>'+pill('Responds within 2 hours',G.energy)+'</div>'+tiles([[G.sleep,'Coaching','New','Years'],[G.water,'Specialties','5','Listed']])+card('<p class="eyebrow">About</p><p class="help" style="margin-top:6px;font-size:14px">This coach is setting up their profile. Message them to learn more about their coaching style.</p>')+'<div>'+lbl('Specialties')+grid([['heart','Weight loss',G.water],['dumb','Strength',G.brand],['target','Bodybuilding',G.sleep],['bolt','Athletic',G.energy]])+'</div>',{cta:two(btnPlain('Message'),btn('Connect','brand'))}],
 ['Connect confirm',bar('Profile')+'<div class="center" style="gap:10px;justify-items:center">'+av('CC',G.brand,'lg')+'<h3 class="title">Cap Chris</h3></div>',{sheet:'<div class="center" style="gap:8px;justify-items:center">'+av('C',G.brand)+'<h3 class="title" style="font-size:20px">Confirm your request</h3><p class="help" style="text-align:center">You\'re about to connect with Cap.</p></div>'+card('<p class="eyebrow">Free trial · 3 to 5 days</p><p class="help" style="margin-top:6px;font-size:14px">Message Cap and discuss your goals first. No commitment yet.</p>','background:var(--g-soft);color:#0A0A0F')+btn('Yes, let\'s connect','brand')+btnPlain('Not right now')}]
];

/* ---------- render ---------- */
var TABS=[['onboarding','Onboarding'],['client','Client app'],['nutrition','Nutrition and coach'],['trainer','Trainer'],['market','Auth and marketplace']];
var tabsEl=document.getElementById('tabs'),boards=document.getElementById('boards'),cache={};
tabsEl.innerHTML=TABS.map(function(t){return '<button type="button" class="chip" data-tab="'+t[0]+'" aria-pressed="false">'+t[1]+'<small>'+S[t[0]].length+'</small></button>'}).join('');
function loadLots(scope){
  [].forEach.call(scope.querySelectorAll('[data-lot]'),function(el){
    var f=el.getAttribute('data-lot');
    (cache[f]=cache[f]||fetch(f).then(function(r){return r.json()})).then(function(d){
      lottie.loadAnimation({container:el,renderer:'svg',loop:true,autoplay:!matchMedia('(prefers-reduced-motion: reduce)').matches,animationData:JSON.parse(JSON.stringify(d)),rendererSettings:{preserveAspectRatio:'xMidYMid meet'}});
    }).catch(function(){});
  });
}
function show(id){
  if(!S[id])id='onboarding';
  [].forEach.call(tabsEl.children,function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-tab')===id))});
  boards.innerHTML=S[id].map(function(s){return ph(s[0],s[1],s[2])}).join('');
  [].forEach.call(boards.querySelectorAll('.scroll'),function(sc){[].forEach.call(sc.children,function(c,i){if(i>=3)c.classList.add('rise')})});
  [].forEach.call(boards.querySelectorAll('.ring circle:last-of-type'),function(c){c.style.transition='stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)';requestAnimationFrame(function(){c.style.strokeDashoffset='0'})});
  if(window.lottie)loadLots(boards);
  try{history.replaceState(null,'','#'+id)}catch(e){}
}
tabsEl.addEventListener('click',function(e){var b=e.target.closest('[data-tab]');if(b)show(b.getAttribute('data-tab'))});

/* ---------- interaction ---------- */
boards.addEventListener('click',function(e){
  var sw=e.target.closest('.sw');if(sw){sw.setAttribute('aria-pressed',String(sw.getAttribute('aria-pressed')!=='true'));return}
  var b=e.target.closest('[aria-pressed]');if(!b||b.classList.contains('sw'))return;
  var c=b.closest('.seg,.days,.week,.slots,.quick,.opts,.ogrid,.cal');if(!c)return;
  var multi=c.getAttribute('data-multi')==='true';
  if(multi)b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));
  else[].forEach.call(c.querySelectorAll('[aria-pressed]'),function(x){x.setAttribute('aria-pressed',String(x===b))});
});
var root=document.documentElement,tbtn=document.getElementById('theme');
function isDark(){var t=root.getAttribute('data-theme');return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}
function lab(){tbtn.textContent=isDark()?'Switch to light':'Switch to dark'}
tbtn.addEventListener('click',function(){root.setAttribute('data-theme',isDark()?'light':'dark');lab()});lab();
show((location.hash||'').slice(1));
window.addEventListener('hashchange',function(){show((location.hash||'').slice(1))});
})();
