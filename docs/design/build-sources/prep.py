import json, colorsys, os, subprocess, glob, shutil
Z='/private/tmp/claude-501/-Users-captainchris20--claude-spares-spare-Ca25Yl/9eee38b5-d15b-45c8-b185-fea06ce8f3b6/scratchpad/zip/coach-connect-handoff/artifacts/icons/'
R='/Users/captainchris20/Projects/My-Coding-Portfolio/Coach-Connect/src/assets/'
icons={}
for n in 'checkin dumbbell energy height hydration injury journey muscle people picture progress protein scales schedule settings sleeping stress workout'.split(): icons[n]=Z+n+'.png'
for k,f in {'carbs':'icons/Carbs.png','fats':'icons/Fats.png','week':'icons/This Week.png','gym':'icons/New Icons/Full Gym.png','beginner':'icons/New Icons/Beginner.png','inter':'icons/New Icons/Intermediate.png','adv':'icons/New Icons/Advanced.png','age':'icons/New Icons/Age.png','bands':'icons/New Icons/Resistance Bands.png','pullup':'icons/New Icons/Pull Up Bar.png','body':'icons/New Icons/Bodyweight Only.png','banned':'icons/banned.png','trash':'icons/delete.png','supp':'icons/supplement.png','dumbbells':'icons/New Icons/dumbbells.png'}.items(): icons[k]=R+f
for k,v in icons.items():
    subprocess.run(['sips','-Z','96',v,'--out',f'ic/{k}.png'],capture_output=True)
print(sorted(os.listdir('ic')), sum(os.path.getsize(f) for f in glob.glob('ic/*'))//1024,'KB')
def shift(r,g,b):
    h,l,s=colorsys.rgb_to_hls(r,g,b)
    if 0.2<=h<=0.56 and s>0.05:
        h=0.74+(h-0.2)/(0.36)*0.06
        return colorsys.hls_to_rgb(h,l,s)
    return r,g,b
def walk(o):
    if isinstance(o,dict):
        c=o.get('c')
        if isinstance(c,dict) and 'k' in c and o.get('ty') in ('fl','st'):
            k=c['k']
            if k and isinstance(k[0],(int,float)) and len(k)>=3: c['k']=list(shift(*k[:3]))+k[3:]
            elif k and isinstance(k[0],dict):
                for f in k:
                    for key in('s','e'):
                        if key in f and isinstance(f[key],list) and len(f[key])>=3: f[key]=list(shift(*f[key][:3]))+f[key][3:]
        g=o.get('g')
        if isinstance(g,dict) and o.get('ty') in('gf','gs') and isinstance(g.get('k'),dict):
            kk=g['k'].get('k'); p=g.get('p',0)
            if isinstance(kk,list) and kk and isinstance(kk[0],(int,float)):
                for i in range(p):
                    j=i*4
                    if j+3<len(kk): kk[j+1],kk[j+2],kk[j+3]=shift(kk[j+1],kk[j+2],kk[j+3])
        for v in o.values(): walk(v)
    elif isinstance(o,list):
        for v in o: walk(v)
for k,f in {'male':'icons/New Icons/male.png','female':'icons/New Icons/female.png','pns':'icons/New Icons/prefer not to say.png','other':'icons/New Icons/Other.png'}.items():
    subprocess.run(['sips','-Z','96',R+f,'--out',f'ic/{k}.png'],capture_output=True)
L={'goal':'animations/app-flows/fitness-goal.json','inj':'animations/app-flows/injuries.json','freq':'animations/app-flows/training-frequency.json','pers':'animations/app-flows/personal-info.json','cert':'animations/app-flows/certifications.json','rates':'animations/app-flows/rates.json','spec':'animations/app-flows/specialties.json','code':'animations/app-flows/invite-code.json','robot':'animations/app-flows/Guy talking to Robot _ AI Help.json','sad':'sad reaction.json','load':'animations/legacy/loading.json','diet':'animations/app-flows/Exercise for diet or health.json','time':'animations/app-flows/experience-timeline.json'}
os.makedirs('lot',exist_ok=True)
for k,f in L.items():
    d=json.load(open(R+f)); walk(d)
    json.dump(d,open(f'lot/{k}.json','w'),separators=(',',':'))
    print(k,os.path.getsize(f'lot/{k}.json')//1024,'KB')
