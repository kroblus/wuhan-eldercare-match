import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  assert.ok(!entry.isSymbolicLink(), 'Mode source cannot be a symlink')
  const file = path.join(directory, entry.name)
  return entry.isDirectory() ? files(file) : [file]
})

/** Select complete, reviewable files. Never search/replace executable page code. */
export function selectModeSource(root, mode) {
  assert.ok(mode === 'demo' || mode === 'production', 'Unknown run mode')
  const source = new Map(), origins = new Map()
  const put = (destination, file) => {
    source.set(destination, fs.readFileSync(file))
    origins.set(destination, path.relative(root, file).replaceAll('\\', '/'))
  }
  const overlay = (directory, prefix = '') => {
    if (!fs.existsSync(directory)) return
    for (const file of files(directory)) put(prefix + path.relative(directory, file).replaceAll('\\', '/'), file)
  }
  overlay(path.join(root, 'miniprogram'))
  overlay(path.join(root, 'modes/shared/runtime'), 'runtime/')
  const modeRoot = path.join(root, 'modes', mode)
  // Existing mode-owned providers/data and component implementations have explicit destinations.
  const demoRuntime = new Set(['draft-storage.ts', 'directory-metadata.ts', 'panorama-sample.ts', 'evaluation-session.ts'])
  for (const entry of fs.readdirSync(modeRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) continue
    assert.ok(entry.isFile() && !entry.isSymbolicLink(), 'Invalid mode source')
    const name = entry.name
    const destination = mode === 'production' ? 'production/' + name
      : demoRuntime.has(name) ? 'runtime/' + name
        : name.endsWith('.jpg') ? 'assets/' + name
          : /^tools\./.test(name) ? 'components/demo-tools/demo-tools' + path.extname(name)
            : /^story-preview\./.test(name) ? 'components/demo-story-preview/demo-story-preview' + path.extname(name)
              : 'demo/' + name
    put(destination, path.join(modeRoot, name))
  }
  overlay(path.join(modeRoot, 'pages'), 'pages/')
  overlay(path.join(modeRoot, 'runtime'), 'runtime/')
  overlay(path.join(modeRoot, 'overrides'))
  const config = JSON.parse(fs.readFileSync(path.join(root, mode === 'demo' ? 'modes/demo-project.config.json' : 'project.config.json')))
  assert.ok(typeof config.appid === 'string' && config.appid.length > 0)
  // The only generated runtime value is a public build identity, not a user flag.
  source.set('runtime/app-config.ts', Buffer.from('export const DEMO_APP_ID = ' + JSON.stringify(mode === 'demo' ? config.appid : '') + '\n'))
  origins.set('runtime/app-config.ts', 'generated:public-app-id')
  if (mode === 'demo') for (const [file, content] of source) {
    if (file.endsWith('.wxml')) assert.ok(!/open-type\s*=/.test(content.toString()), 'Demo native authorization surface: ' + file)
  }
  return { source, config, origins }
}
