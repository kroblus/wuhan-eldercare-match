"""Read-only native audit capture; invokes documented wechatide CLI tools only."""
import json, subprocess, sys, datetime, pathlib, os
ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).resolve().parent
CLI = [r'D:\DailyAPP\微信web开发者工具\微信开发者工具.exe','-e',"const e=process.argv[1],a=process.argv.slice(2);process.argv=[process.execPath,e,'--electron'].concat(a);require(e)",r'D:\DailyAPP\微信web开发者工具\resources\app.asar.unpacked\js\common\cli\skill-index.js']
MODE = 'demo'
SYS_CACHE = None
def call(tool, **kw):
    argv=CLI+['-c','Codex',tool,'--project',str(ROOT/'dist'/MODE)]
    for k,v in kw.items(): argv += ['--'+k.replace('_','-'), str(v).lower() if isinstance(v,bool) else str(v)]
    p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8',timeout=45,env={**os.environ,'ELECTRON_RUN_AS_NODE':'1','cwd':str(ROOT)})
    raw=p.stdout
    try: result=json.loads(raw[raw.index('{'):])
    except Exception: result={'ok':False,'raw':raw,'stderr':p.stderr}
    with (OUT/'calls.jsonl').open('a',encoding='utf-8') as f:
        f.write(json.dumps({'time':datetime.datetime.now().isoformat(),'mode':MODE,'tool':tool,'arguments':kw,'response':result},ensure_ascii=False,default=str)+'\n')
    if not result.get('ok'): raise RuntimeError(str(result))
    return result
def capture(name):
    global SYS_CACHE
    page=call('automation_runtime_info',action='currentPage')
    r=call('simulator_screenshot',path=OUT/(name+'.png'),optimize=False)
    if SYS_CACHE is None: SYS_CACHE=call('automation_runtime_info',action='systemInfo')
    sysinfo=SYS_CACHE
    (OUT/(name+'.json')).write_text(json.dumps({'page':page,'system':sysinfo},ensure_ascii=False,indent=2),encoding='utf-8')
    print(name, json.dumps(r.get('result',{}),ensure_ascii=False),flush=True)
def nav(url):
    tabs=['/pages/home/index','/pages/consultant/index','/pages/mine/index']
    return call('automation_navigate',action='switchTab' if url in tabs else 'reLaunch',url=url)
if __name__=='__main__':
    MODE=sys.argv[1]
    jobs=json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8-sig'))
    for j in jobs:
        if 'route' in j: nav(j['route'])
        if 'reveal' in j:
            pos=call('automation_element_action',action='offset',selector=j['reveal'])['result']
            call('automation_viewport_action',action='pageScrollTo',scroll_top=max(0,j.get('baseScroll',0)+pos['top']-150))
        if 'tap' in j: call('automation_element_action',action='tap',selector=j['tap'])
        if 'scroll' in j: call('automation_viewport_action',action='pageScrollTo',scroll_top=j['scroll'])
        for a in j.get('actions',[]): call(a['tool'],**a['args'])
        capture(j['name'])
        if 'measure' in j:
            for action in ['offset','size']:
                result=call('automation_element_action',action=action,selector=j['measure'])
                (OUT/(j['name']+'-'+action+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
