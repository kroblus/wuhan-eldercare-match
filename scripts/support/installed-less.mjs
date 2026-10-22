// Read only the installed compiler packages; no downloads or global module patches.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire, isBuiltin } from 'node:module'
const require = createRequire(import.meta.url)
export function loadInstalledLess(installRoot) {
  const archive = path.join(installRoot, 'resources/app.asar')
  const fd = fs.openSync(archive, 'r'), prefix = Buffer.alloc(16)
  fs.readSync(fd, prefix, 0, 16, 0)
  const dataOffset = 8 + prefix.readUInt32LE(4), bytes = Buffer.alloc(prefix.readUInt32LE(12))
  fs.readSync(fd, bytes, 0, bytes.length, 16)
  const header = JSON.parse(bytes.toString()), cache = new Map()
  fs.closeSync(fd)
  function entry(file) { let node = header; for (const part of file.split('/')) { node = node.files && node.files[part]; if (!node) return null } return node }
  function read(file) {
    const item = entry(file); if (!item || item.files || item.link) throw new Error('Invalid compiler archive entry: ' + file)
    if (item.unpacked) return fs.readFileSync(archive + '.unpacked/' + file)
    const handle = fs.openSync(archive, 'r'), buffer = Buffer.alloc(item.size)
    try { fs.readSync(handle, buffer, 0, buffer.length, dataOffset + Number(item.offset)); return buffer } finally { fs.closeSync(handle) }
  }
  function asFile(base) {
    for (const file of [base, base + '.js', base + '.json']) { const item = entry(file); if (item && !item.files && !item.link) return file }
    const pkg = entry(base + '/package.json')
    if (pkg) { const main = JSON.parse(read(base + '/package.json')).main; if (main) { const found = asFile(path.posix.normalize(base + '/' + main)); if (found) return found } }
    for (const file of [base + '/index.js', base + '/index.json']) if (entry(file)) return file
    return null
  }
  function resolve(request, importer) {
    if (isBuiltin(request)) return request
    if (request.startsWith('.')) { const found = asFile(path.posix.normalize(path.posix.dirname(importer) + '/' + request)); if (found) return found }
    else { let directory = path.posix.dirname(importer); while (directory !== '.') { const found = asFile(directory + '/node_modules/' + request); if (found) return found; directory = path.posix.dirname(directory) } const found = asFile('node_modules/' + request); if (found) return found }
    throw new Error('Installed Less dependency unavailable: ' + request)
  }
  function load(file) {
    if (isBuiltin(file)) return require(file)
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    if (file.endsWith('.json')) module.exports = JSON.parse(read(file))
    else {
      const localRequire = request => load(resolve(request, file))
      localRequire.resolve = request => resolve(request, file)
      vm.runInThisContext('(function(require,module,exports,__filename,__dirname){' + read(file) + '\n})', { filename: file })(localRequire, module, module.exports, archive + '/' + file, archive + '/' + path.posix.dirname(file))
    }
    return module.exports
  }
  const less = load(resolve('less', 'node_modules/entry.js'))
  if (less.version.join('.') !== '4.1.3') throw new Error('Expected installed Less 4.1.3')
  return less
}
