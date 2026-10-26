"""Batch A evidence, using the existing documented official CLI adapter."""
import importlib.util, pathlib, sys, json
sys.dont_write_bytecode = True
OUT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('native_audit', OUT.parent/'global-ui-ux-audit-v1-evidence/audit_capture.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
native.OUT, native.MODE = OUT, sys.argv[1]
jobs = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8-sig'))
for job in jobs:
    if 'route' in job: native.nav(job['route'])
    if 'tap' in job:
        native.call('automation_viewport_action', action='pageScrollTo', scroll_top=0)
        pos = native.call('automation_element_action', action='offset', selector=job['tap'])['result']
        native.call('automation_viewport_action', action='pageScrollTo', scroll_top=max(0,pos['top']-160))
        pos = native.call('automation_element_action', action='offset', selector=job['tap'])['result']
        size = native.call('automation_element_action', action='size', selector=job['tap'])['result']
        system = native.call('automation_runtime_info', action='systemInfo')['result']['systemInfo']['result']
        assert pos['top'] >= 0 and pos['top']+size['height'] <= system['windowHeight'], (pos,size,system['windowHeight'])
        (OUT/(job['name']+'-tap-geometry.json')).write_text(json.dumps({'selector':job['tap'],'offset':pos,'size':size,'viewport':system['windowHeight']},ensure_ascii=False,indent=2),encoding='utf-8')
        native.call('automation_element_action', action='tap', selector=job['tap'])
    for action in job.get('actions', []): native.call(action['tool'], **action.get('args', {}))
    if 'scroll' in job: native.call('automation_viewport_action', action='pageScrollTo', scroll_top=job['scroll'])
    if 'name' in job:
        native.SYS_CACHE = None  # each page gets its own current geometry
        native.capture(job['name'])
    for selector in job.get('measure', []):
        for action in ['offset', 'size']:
            result = native.call('automation_element_action', action=action, selector=selector)
            (OUT/(job['name']+'-'+selector.strip('.#').replace(' ', '-')+'-'+action+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
