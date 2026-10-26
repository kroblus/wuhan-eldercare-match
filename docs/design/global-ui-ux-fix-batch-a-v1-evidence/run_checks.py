"""Bounded Batch A regression; no upload, source mutation or Git staging."""
import pathlib, subprocess, json, datetime
p = pathlib.Path(__file__).resolve().parent
root = p.parents[2]
tests = [
    ['scripts/check-global-ui-ux-batch-a.mjs'],
    ['scripts/check-b1-2-5-continuity.mjs'],
    ['scripts/check-b1-2-6-story.mjs'],
    ['scripts/check-run-mode-convergence.mjs'],
    ['scripts/check-wechat-js-compat.mjs', '--demo', '--artifact-dir', 'dist/demo/miniprogram'],
    ['scripts/check-wechat-js-compat.mjs', '--artifact-dir', 'dist/production/miniprogram'],
    ['scripts/check-run-mode-package-size.mjs'],
    ['scripts/check-recommendation-result-v2-ui-runtime.mjs'],
    ['scripts/check-appointment-create-runtime.mjs'],
]
results = []
for args in tests:
    command = ['node', *args]
    run = subprocess.run(command, cwd=root, capture_output=True, text=True, encoding='utf-8')
    results.append({'command':command, 'exitCode':run.returncode, 'output':run.stdout, 'stderr':run.stderr, 'time':datetime.datetime.now().isoformat()})
    (p/'regression-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(('PASS ' if run.returncode==0 else 'FAIL ')+' '.join(command),flush=True)
    if run.returncode: print(run.stdout[-3500:]+run.stderr[-3500:],flush=True)
raise SystemExit(1 if any(result['exitCode'] for result in results) else 0)
