"""Scroll each existing Demo rating into view, tap, and read checked state."""
import re,json
import audit_capture as a
src=(a.ROOT/'miniprogram/pages/visit/evaluation-view-model.ts').read_text(encoding='utf-8').splitlines()
keys=re.findall(r"\{ key: '([a-z_]+)', label:", '\n'.join(src[:90]))
assert len(keys)==21,keys
scroll=400
results=[]
for i,key in enumerate(keys):
    selector='.rating-option[data-question='+key+'][data-value=4]'
    pos=a.call('automation_element_action',action='offset',selector=selector)['result']
    scroll=max(0,scroll+pos['top']-170)
    a.call('automation_viewport_action',action='pageScrollTo',scroll_top=scroll)
    pos=a.call('automation_element_action',action='offset',selector=selector)['result']
    a.call('automation_element_action',action='tap',selector=selector)
    checked=a.call('automation_element_action',action='attribute',selector=selector,name='aria-checked')
    results.append({'question':key,'scrollRequested':scroll,'positionBeforeTap':pos,'checked':checked})
    (a.OUT/'matrix-21-taps.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    if i in [4,8,12,16,20]: a.capture('demo-375-matrix-group-'+str(i+1))
    print(i+1,key,checked.get('result'),flush=True)
