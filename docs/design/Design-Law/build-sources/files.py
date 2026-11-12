from kit import *

CSS2 = r'''
.emp{border-style:dashed!important;box-shadow:none!important;background:transparent!important}
.gl3{font-size:12px;font-weight:900;letter-spacing:1.3px;text-transform:uppercase;color:var(--mut)}
.fg{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fl{display:flex;flex-direction:column;gap:8px;text-align:left;border:3px solid var(--bd);border-radius:10px;background:var(--sf);box-shadow:4px 4px 0 var(--sh);padding:10px;cursor:pointer}
.fl:nth-child(even){border-radius:10px 22px 10px 10px}
.fl .pv{height:84px;border:3px solid var(--bd);border-radius:6px;background:repeating-linear-gradient(135deg,var(--soft) 0 9px,var(--chip) 9px 18px);display:grid;place-items:center}
.fl .pv .im{width:38px;height:38px}
.fl b{font-size:14px;line-height:1.2;display:block}
.fl .m{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:12px;color:var(--mut);font-weight:700}
.ty{display:inline-flex;align-items:center;height:22px;padding:0 7px;border:2.5px solid var(--bd);border-radius:5px;font-size:12px;font-weight:900;letter-spacing:.6px;background:var(--blk);color:var(--on)}
.who{display:inline-flex;align-items:center;height:24px;padding:0 8px;border:2.5px solid var(--bd);border-radius:999px;font-size:12px;font-weight:900;background:var(--soft)}
.note{background:var(--soft);border:3px solid var(--bd);border-radius:2px 14px 14px 14px;padding:12px;font-size:15px;line-height:1.45}
.note b{display:block;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);margin-bottom:4px}
.seg.sx{overflow-x:auto;scrollbar-width:none}.seg.sx::-webkit-scrollbar{display:none}.seg.sx button{flex:none;padding:0 16px}
.page{background:#fff;color:#0A0A0A;border:3px solid var(--bd);border-radius:4px;box-shadow:5px 5px 0 var(--sh);padding:18px 16px;display:flex;flex-direction:column;gap:10px;min-height:300px}
.page h3{margin:0;font-size:22px;letter-spacing:-.5px}
.page p{font-size:14px;line-height:1.5;margin:0;color:#262626}
.page .ln{height:10px;background:#E0E0DC;border-radius:2px}
.tb{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.tb::-webkit-scrollbar{display:none}
.tb button{flex:none;min-width:44px;height:44px;border:3px solid var(--bd);border-radius:8px;background:var(--chip);font-weight:900;font-size:16px;cursor:pointer;padding:0 8px;color:var(--ink)}
.tb button.on{background:var(--blk);color:var(--on)}
.bnav{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;padding:12px 16px 18px;background:var(--bg);border-top:3px solid var(--bd);z-index:4}
.bnav .btn{flex:1}
.rowc{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 0;border-top:2px solid var(--bd)}
.rowc:first-child{border-top:0}
.rowc .grow{flex:1;min-width:0}.rowc .grow b{display:block;font-size:16px}.rowc .grow span{font-size:13px;color:var(--mut)}
.ck2{width:30px;height:30px;border:3px solid var(--bd);border-radius:8px;background:var(--chip);display:grid;place-items:center;flex:none;cursor:pointer;padding:0;color:var(--on)}
.ck2[aria-pressed="true"]{background:var(--blk)}
.ck2 svg{opacity:0;width:16px;height:16px}.ck2[aria-pressed="true"] svg{opacity:1}
.errc{display:flex;flex-direction:column;gap:8px}
'''
JS2 = r'''
HOOKS.push(function(ph){
 $$('.ck2',ph).forEach(b=>b.addEventListener('click',()=>{b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));const n=$$('.ck2[aria-pressed="true"]',ph).length,o=$('[data-sel]',ph);if(o)o.textContent=n+(n===1?' client':' clients')}));
 $$('.tb button',ph).forEach(b=>b.addEventListener('click',()=>b.classList.toggle('on')));
});
'''
IC = {'PDF': 'week', 'DOC': 'checkin', 'SHEET': 'week', 'IMAGE': 'picture', 'VIDEO': 'picture'}
def file(name, ty, meta, who=''):
    return (f'<button class="fl"><div class="pv"><i class="im i-{IC[ty]}"></i></div><b>{name}</b><div class="m"><span class="ty">{ty}</span><span>{meta}</span></div>' + (f'<span class="who">{who}</span>' if who else '') + '</button>')

FILTERS = ['All Files', 'Photos', 'Videos', 'Documents', 'Spreadsheets']
def notesfiles(data=True):
    h = top('Your Notes & Files', sub='Everything shared between you and your coach, all in one place.', back=True)
    if not data:
        return (h + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('picture', 'lg') + '<h1>Photos, videos, and documents in one place</h1><p class="mut">Your coach\'s notes and files show up here. Add your own to share with your coach.</p><button class="btn">Add to Notes & Files</button></div>')
    return (h + '<div class="seg sx rv" data-nopick>' + ''.join(f'<button aria-pressed="{"true" if f == "All Files" else "false"}">{f}</button>' for f in FILTERS) + '</div>'
        + sec('From your coach', '<span>3 new</span>') +
        '<div class="note rv"><b>Note from your coach</b>Keep squats pain-free: box to parallel, stop short of the ache. Review week 3 before Friday.</div>'
        '<div class="fg rv">' + file('Week 3 program', 'SHEET', 'Nov 12', 'From your coach') + file('Meal guide', 'PDF', '1.2 MB', 'From your coach') + '</div>'
        + sec('My files', '<span>Shared with your coach</span>') +
        '<div class="fg rv">' + file('Squat, set 2', 'VIDEO', '0:18', 'From you') + file('Front, Nov 12', 'IMAGE', '2.1 MB', 'From you') + file('Intake form', 'DOC', '84 KB', 'From you') + file('Lunch label', 'IMAGE', '1.4 MB', 'From you') + '</div>'
        + sec('Coaching notes') + '<div class="card rv" style="padding:4px 14px"><div><div class="rowc"><div class="grow"><b>Knee felt tight on set 2</b><span>Your note · Nov 13</span></div></div><div class="rowc"><div class="grow"><b>Add 5 lb to RDL next week</b><span>From your coach · Nov 11</span></div></div></div></div>')

S = []
def add(t, n, body, extra='', a='files', lab='', second=False):
    S.append(screen(t, n, body, (dock(a) if a else '') + extra, lab=lab, second=second))

add('1 · Your Notes & Files', 'One place for both directions. A note from your coach comes first, then files from your coach and files from you, each tagged with who shared it and its type. The empty side uses your real empty text.', notesfiles(True), lab='With files')
add('x', 'x', notesfiles(False), lab='Empty', second=True)

# 2 add sheet
add_s = sheet('add', '<h2>Add files</h2><div class="list">' + ''.join(f'<button class="row">{ib(ic)}<div class="grow"><b>{t}</b><span>{s}</span></div>{SV["chev"]}</button>' for ic, t, s in [('picture', 'Photo', 'Camera or library'), ('picture', 'Video', 'From your library'), ('week', 'PDF / Doc', 'PDF or Word, up to 10 MB'), ('checkin', 'Add note or file', 'Write a note for your coach')]) + '</div><button class="btn gh" data-close="add">Cancel</button>')
add('2 · Add files', 'Four ways to add, with the file limits shown up front so Unsupported file is rare.', notesfiles(True), add_s.replace('data-sheet="add"', 'data-sheet="add" data-autoopen'))

# 3 note + file
note_s = (top('Add note or file') + '<div class="fld rv"><label for="nt">Your note</label><textarea id="nt" rows="4">Knee felt tight on the second set. Video attached.</textarea></div>'
  '<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px">' + ib('picture') + '<div style="flex:1;min-width:0"><b>Squat, set 2.mov</b><p class="sm mut">0:18 · 12 MB</p></div><button class="sq" aria-label="Remove">' + SV['x'] + '</button></div>'
  '<button class="btn gh rv">' + SV['plus'] + ' Add another file</button>', '<div class="bnav"><button class="btn">Add to Notes & Files</button></div>')
S.append(screen('3 · Add note or file', 'A note and files travel together, so the coach gets the video with the sentence that explains it.', *note_s))

# 4 viewer
viewer = (top('Meal guide', sub='PDF · 1.2 MB · From your coach', right=f'<button class="sq" aria-label="More">{SV["chev"]}</button>') +
  '<div class="page rv"><h3>Meal guide</h3><p>Training days: 30 g of protein within two hours of lifting. Eat a carb-led meal two hours before lower body.</p><div class="ln"></div><div class="ln" style="width:86%"></div><div class="ln" style="width:92%"></div><div class="ln" style="width:70%"></div></div>'
  '<p class="sm mut rv" style="text-align:center">Page 1 of 4</p><div style="display:flex;gap:10px" class="rv"><button class="btn gh" style="flex:1">Download</button><button class="btn gh" style="flex:1">Share</button></div><button class="btn gh rv" data-open="df">Delete from my files</button>')
df = sheet('df', '<span class="pill g2" style="align-self:flex-start">Removes it from your files</span><h2>Delete file?</h2><p class="mut">This will remove it from your files.</p><div style="display:flex;gap:10px"><button class="btn gh" data-close="df" style="flex:1">Cancel</button><button class="btn" data-close="df" style="flex:1.2">Delete</button></div>')
add('4 · File viewer', 'The viewer shows the page, then the four things you can do: open, download, share, delete. Delete is last and asks first.', viewer, df, a=None)
add('5 · Delete file', 'The confirm uses your wording and says what it removes.', viewer, df.replace('data-sheet="df"', 'data-sheet="df" data-autoopen'), a=None)

# 6 trainer client files pair
def clientfiles(data=True):
    h = top('Client files', sub='Shared uploads and documents for this client', right=av('AR'))
    if not data:
        return h + '<div class="card emp sq0 rv" style="gap:12px;align-items:flex-start">' + ib('picture', 'lg') + '<h1>No client uploads yet</h1><p class="mut">When Alex shares a photo, video or note, it shows up here.</p><button class="btn">Share a document with Alex</button></div>'
    return (h + '<div class="seg sx rv" data-nopick>' + ''.join(f'<button aria-pressed="{"true" if f == "All Files" else "false"}">{f}</button>' for f in FILTERS + ['Uploads']) + '</div>' + sec('Uploads', '<span>3 from client</span>') +
        '<div class="fg rv">' + file('Squat, set 2', 'VIDEO', '0:18', 'From client') + file('Front, Nov 12', 'IMAGE', '2.1 MB', 'From client') + '</div>' + sec('Shared by you') + '<div class="fg rv">' + file('Week 3 program', 'SHEET', 'Nov 12', 'From you') + file('Meal guide', 'PDF', '1.2 MB', 'From you') + '</div>'
        + sec('Notes') + '<div class="note rv"><b>Note from Alex</b>Knee felt tight on the second set, fine after warm-up.</div>')
add('6 · Client files, trainer', 'A trainer sees the same layout with the tags flipped: From client and From you. Uploads are listed first. The empty side is your No client uploads yet.', clientfiles(True), lab='With uploads', a='files')
add('x', 'x', clientfiles(False), lab='Empty', second=True, a='files')

# 8 document editor
ed = (top('Meal guide', sub='Saved just now', right=f'<button class="sq" aria-label="Share" data-open="sh">{SV["send"]}</button>') +
  '<div class="tb rv"><button class="on"><b>B</b></button><button><i>I</i></button><button><u>U</u></button><button>H1</button><button>H2</button><button>• List</button><button>1. List</button><button>Link</button></div>'
  '<div class="chips rv" data-single data-g="ps"><button class="chip sm3" aria-pressed="true">Clean</button><button class="chip sm3" aria-pressed="false">Bold</button><button class="chip sm3" aria-pressed="false">Handout</button></div>'
  '<div class="page rv"><h3>Meal guide</h3><p>Training days: 30 g of protein within two hours of lifting. Eat a carb-led meal two hours before lower body.</p><p>Rest days: keep protein at 170 g and add a walk.</p><div class="ln"></div><div class="ln" style="width:80%"></div></div>'
  '<div class="card flat rv" style="flex-direction:row;align-items:center;gap:12px"><div style="flex:1"><b>Reading level: Grade 7</b><p class="sm mut">Easy for most clients to follow.</p></div>' + pill('Clear', 'n') + '</div>'
  '<div style="display:flex;gap:10px" class="rv"><button class="btn gh" style="flex:1">Export</button><button class="btn" style="flex:1" data-open="sh">Share</button></div>')
shr = sheet('sh', '<h2>Share document</h2><p class="mut">Choose who gets Meal guide in their Notes & Files.</p><div class="card flat" style="padding:4px 14px"><div>' + ''.join(f'<div class="rowc">{av(i)}<div class="grow"><b>{n}</b><span>{s}</span></div><button class="ck2" aria-pressed="{x}" aria-label="Select {n}">{SV["check"]}</button></div>' for i, n, s, x in [('AR', 'Alex Rivera', 'Build Muscle', 'true'), ('MC', 'Maya Chen', 'Lose Fat', 'true'), ('DP', 'Dev Patel', 'Athletic', 'false')]) + '</div></div><div style="display:flex;gap:10px"><button class="btn gh" data-close="sh" style="flex:1">Cancel</button><button class="btn" data-close="sh" style="flex:1.4">Share with <span data-sel>2 clients</span></button></div>')
add('7 · Document editor', 'A trainer document is a page with a one-row toolbar, three page styles as chips, and a reading-level check, so a meal guide is easy to follow. Save state is under the title. Tap the toolbar buttons.', ed, shr, a=None)
add('8 · Share document', 'Sharing is a checklist of clients and one button that says how many will get it. Tap the boxes to change the count.', ed, shr.replace('data-sheet="sh"', 'data-sheet="sh" data-autoopen'), a=None)

# 9 errors
er = (top('Open a file', sub='What failed files look like') +
  '<div class="card emp sq0 rv errc"><span class="gl3">Document not found</span><b style="font-size:18px">This document link is missing.</b><p class="mut">Ask your coach to share it again.</p><button class="btn gh">Back to files</button></div>'
  '<div class="card emp sq0 rv errc"><span class="gl3">Spreadsheet unavailable</span><b style="font-size:18px">Your coach may have removed this spreadsheet.</b><p class="mut">The copy you saved is still on your phone.</p><button class="btn gh">Contact your coach</button></div>'
  '<div class="card emp sq0 rv errc"><span class="gl3">Unsupported file</span><b style="font-size:18px">Please choose a PDF or Word document.</b><p class="mut">Allowed types are .pdf, .doc and .docx.</p><button class="btn gh">Choose another file</button></div>')
add('9 · File errors', 'The three file problems from your app, each as a dashed card that says what happened and gives one next step.', er, a=None)

build('files-and-notes.html', 'Coach Connect Files and Notes', '', 'Files and notes',
      'Your Notes & Files for clients and trainers: files from your coach and from you, add sheet, note with a file, viewer, delete, client files for trainers, a document editor with share, and file errors. Empty and filled states side by side.',
      S, extra_js=JS2, extra_css=CSS2)
