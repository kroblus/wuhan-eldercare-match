// React migration of the former fake-DOM suite. Business assertions now exercise real components.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['--prefix','admin-web','test','--','src/pages/Institutions.test.tsx','src/api/client.test.ts','src/state.test.tsx','src/components/NavigationGuard.test.tsx'],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
