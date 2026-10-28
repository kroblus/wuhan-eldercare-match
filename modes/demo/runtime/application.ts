import { installDemoGuards } from '../demo/guard'
import { DEMO_APP_ID } from './app-config'
installDemoGuards(DEMO_APP_ID)
import { loadDemo } from '../demo/session'
export function initializeApplication(): void {
  App({ globalData: { runMode: 'DEMO' }, onLaunch() { loadDemo().catch(() => {}) } })
}
