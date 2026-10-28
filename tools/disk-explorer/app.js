(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('snapshot').textContent);
  const $ = id => document.getElementById(id);
  const make = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  const groups = {
    source: { name: '源码与脚本', color: '#337e68' },
    output: { name: '输出与证据', color: '#5f879a' },
    archive: { name: '归档与恢复', color: '#b48847' },
    deps: { name: '依赖与构建', color: '#82759c' },
    git: { name: 'Git 历史', color: '#ab6d66' },
    other: { name: '文档与其他', color: '#718873' }
  };
  const all = [], byId = new Map(), byPath = new Map();
  function index(node, parent) {
    node.id = all.length;
    node.parent = parent;
    node.p = parent ? [parent.p, node.n].filter(Boolean).join('/') : '';
    const parts = node.p.split('/');
    node.group = parts.includes('.git') ? 'git'
      : parts.some(p => ['node_modules', 'dist', 'target', 'build', 'miniprogram_npm', '__pycache__'].includes(p)) ? 'deps'
      : parts[0] === 'archive' ? 'archive' : ['output', 'tmp'].includes(parts[0]) ? 'output'
      : ['miniprogram', 'modes', 'scripts', 'shared', 'tools', 'admin-web', 'server'].includes(parts[0]) ? 'source' : 'other';
    if (!node.c) { const dot = node.n.lastIndexOf('.'); node.ext = dot > 0 ? node.n.slice(dot).toLowerCase() : '(无扩展名)'; }
    all.push(node); byId.set(node.id, node); byPath.set(node.p, node);
    if (node.c) node.c.forEach(child => index(child, node));
  }
  index(data.tree, null);
  const root = data.tree;
  let scope = root, selected = root, query = '', type = '', order = 'size', direction = -1, page = 0, rows = [];
  const expanded = new Set([root.id]);
  const pageSize = 100;
  const number = n => n.toLocaleString('zh-CN');
  function bytes(n) {
    if (n === 0) return '0 B';
    const i = Math.min(4, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : n / 1024 ** i >= 100 ? 0 : 2)} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][i]}`;
  }
  const ratio = n => scope.s ? n / scope.s * 100 : 0;
  const percent = n => n > 0 && n < .1 ? '<0.1%' : `${n.toFixed(1)}%`;
  const fullPath = node => data.root + (node.p ? (data.root.includes('\\') ? '\\' + node.p.replaceAll('/', '\\') : '/' + node.p) : '');
  const descendants = node => all.filter(item => item !== node && (!node.p || item.p.startsWith(node.p + '/')));

  $('projectName').append(document.createTextNode(root.n), make('span', 'title-dot', '.'));
  $('rootPath').textContent = data.root;
  $('scanTime').textContent = new Date(data.generated).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  $('totalSize').textContent = bytes(root.s);
  $('totalFiles').textContent = number(root.f);
  $('totalDirs').textContent = number(root.d);
  $('scanDuration').textContent = `扫描用时 ${data.seconds.toFixed(1)} 秒`;
  $('footerNote').textContent = `逻辑大小，非磁盘分配空间 · 未统计报告自身 · ${data.issues.length ? `跳过 ${data.issues.length} 项` : '无跳过项'}`;
  $('quickLinks').append(make('span', 'quick-label', '快速定位'));
  for (const path of ['output', 'archive', 'node_modules', '.git', 'miniprogram', 'server']) {
    const node = byPath.get(path);
    if (!node?.c) continue;
    const button = make('button', 'quick-link', path); button.onclick = () => go(node); $('quickLinks').append(button);
  }
  for (const group of Object.values(groups)) { const label = make('span'); const mark = make('i'); mark.style.background = group.color; label.append(mark, document.createTextNode(group.name)); $('mapLegend').append(label); }

  function go(node, writeHash = true) {
    if (!node.c) { select(node); return; }
    scope = selected = node; query = type = ''; page = 0; $('search').value = '';
    for (let current = node; current; current = current.parent) expanded.add(current.id);
    if (writeHash && location.hash !== '#' + encodeURIComponent(node.p)) location.hash = encodeURIComponent(node.p);
    $('scopeSize').textContent = bytes(scope.s);
    $('scopePercent').textContent = `占整个项目 ${percent(root.s ? scope.s / root.s * 100 : 0)}`;
    $('up').disabled = !scope.parent;
    const trail = []; for (let current = scope; current; current = current.parent) trail.unshift(current);
    $('breadcrumbs').replaceChildren();
    trail.forEach((entry, i) => { if (i) $('breadcrumbs').append(make('span', 'crumb-slash', '/')); const button = make('button', '', entry === root ? '项目根目录' : entry.n); button.onclick = () => go(entry); $('breadcrumbs').append(button); });
    renderTree(); filterRows(); renderDetails(); renderTypes(); renderMap();
  }
  function readRoute() {
    let path; try { path = decodeURIComponent(location.hash.slice(1)); } catch { path = ''; }
    const node = byPath.get(path);
    if (node?.c && node !== scope) go(node, false);
  }
  window.addEventListener('hashchange', readRoute);
  $('up').onclick = () => { if (scope.parent) go(scope.parent); };

  function renderTree() {
    const container = $('directoryTree'), oldScroll = container.scrollTop;
    container.replaceChildren();
    function branch(node, depth) {
      const children = node.c.filter(child => child.c);
      const row = make('div', `tree-row${node === scope ? ' active' : ''}`); row.style.paddingLeft = `${5 + depth * 12}px`;
      const toggle = make('button', 'tree-toggle', children.length ? expanded.has(node.id) ? '⌄' : '›' : '·');
      toggle.disabled = !children.length; toggle.setAttribute('aria-label', `${expanded.has(node.id) ? '折叠' : '展开'} ${node.n}`);
      toggle.setAttribute('aria-expanded', String(expanded.has(node.id)));
      toggle.onclick = () => { if (expanded.has(node.id)) expanded.delete(node.id); else expanded.add(node.id); renderTree(); };
      const button = make('button', 'tree-node'); button.title = fullPath(node); if (node === scope) button.setAttribute('aria-current', 'location');
      button.append(make('span', 'folder-icon', '▰'), make('span', '', node === root ? '项目根目录' : node.n), make('small', '', bytes(node.s)));
      button.onclick = () => go(node); row.append(toggle, button); container.append(row);
      if (expanded.has(node.id)) {
        children.slice(0, 250).forEach(child => branch(child, depth + 1));
        if (children.length > 250) container.append(make('div', 'tree-more', `另有 ${children.length - 250} 个文件夹，请在列表查看`));
      }
    }
    branch(root, 0); container.scrollTop = oldScroll;
  }
  function filterRows() {
    const needle = query.trim().toLocaleLowerCase();
    rows = needle || type ? descendants(scope).filter(node => (!needle || node.p.toLocaleLowerCase().includes(needle)) && (!type || !node.c && node.ext === type)) : [...scope.c];
    rows.sort((a, b) => direction * (order === 'name' ? a.n.localeCompare(b.n, 'zh-CN') : order === 'files' ? a.f - b.f : a.s - b.s) || a.n.localeCompare(b.n, 'zh-CN'));
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
    $('resultCount').textContent = number(rows.length);
    $('listTitle').textContent = needle || type ? '搜索与筛选结果' : '目录与文件';
    $('activeFilter').hidden = !type;
    if (type) { $('activeFilter').replaceChildren(make('span', '', `文件类型 ${type} · 包含子目录`)); const clear = make('button', '', '清除 ×'); clear.onclick = () => setType(''); $('activeFilter').append(clear); }
    $('clearType').hidden = !type;
    renderRows();
  }
  function renderRows() {
    $('fileRows').replaceChildren();
    rows.slice(page * pageSize, (page + 1) * pageSize).forEach(node => {
      const row = make('tr', node === selected ? 'selected' : ''); row.dataset.id = node.id;
      const nameCell = make('td'), button = make('button', 'file-name'); button.title = fullPath(node);
      const icon = make('span', node.c ? 'folder-icon' : 'file-dot', node.c ? '▰' : undefined); if (!node.c) icon.style.background = groups[node.group].color;
      const name = make('span', 'name-lines'); name.append(document.createTextNode(node.n));
      if (query || type) name.append(make('small', '', node.parent?.p || '项目根目录'));
      button.append(icon, name); button.onclick = () => node.c ? go(node) : select(node); nameCell.append(button);
      const barCell = make('td'), bar = make('span', 'ratio'), track = make('span', 'ratio-track'), fill = make('i');
      fill.style.width = `${ratio(node.s)}%`; fill.style.background = groups[node.group].color;
      track.append(fill); bar.append(track, make('small', '', percent(ratio(node.s)))); barCell.append(bar);
      row.append(nameCell, make('td', '', bytes(node.s)), barCell, make('td', '', node.c ? number(node.f) : '—'));
      $('fileRows').append(row);
    });
    $('emptyState').hidden = rows.length > 0;
    $('rangeText').textContent = rows.length ? `${number(page * pageSize + 1)}–${number(Math.min((page + 1) * pageSize, rows.length))} / ${number(rows.length)} 项` : '0 项';
    $('pageText').textContent = `${page + 1} / ${Math.max(1, Math.ceil(rows.length / pageSize))}`;
    $('prevPage').disabled = page === 0; $('nextPage').disabled = (page + 1) * pageSize >= rows.length;
    document.querySelectorAll('[data-sort]').forEach(button => { const active = button.dataset.sort === order; button.querySelector('span').textContent = active ? direction === -1 ? '↓' : '↑' : ''; button.closest('th').setAttribute('aria-sort', active ? direction === -1 ? 'descending' : 'ascending' : 'none'); });
  }
  let searchTimer;
  $('search').oninput = event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { query = event.target.value; page = 0; filterRows(); }, 120); };
  document.querySelectorAll('[data-sort]').forEach(button => button.onclick = () => { if (order === button.dataset.sort) direction *= -1; else { order = button.dataset.sort; direction = order === 'name' ? 1 : -1; } page = 0; filterRows(); });
  $('prevPage').onclick = () => { page--; renderRows(); $('fileRows').closest('.table-scroll').scrollTop = 0; };
  $('nextPage').onclick = () => { page++; renderRows(); $('fileRows').closest('.table-scroll').scrollTop = 0; };
  document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !$('infoDialog').open) { event.preventDefault(); $('search').focus(); } });

  function select(node) {
    selected = node; renderDetails();
    document.querySelectorAll('[data-id]').forEach(el => el.classList.toggle('selected', Number(el.dataset.id) === node.id));
  }
  function renderDetails() {
    $('selectedKind').textContent = selected.c ? '文件夹' : '文件';
    $('selectedSymbol').textContent = selected.c ? '▰' : '▤';
    $('selectedName').textContent = selected.n; $('selectedSize').textContent = bytes(selected.s);
    $('selectedPath').textContent = fullPath(selected); $('copyStatus').textContent = '';
    const items = [['字节', number(selected.s)], ['当前占比', percent(ratio(selected.s))], ['文件数', number(selected.f)], ['子文件夹', number(selected.d)], ['修改时间', selected.m ? new Date(selected.m * 1000).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }) : '目录汇总']];
    $('selectedMeta').replaceChildren(); items.forEach(([key, value]) => $('selectedMeta').append(make('dt', '', key), make('dd', '', value)));
  }
  function setType(value) { type = value; page = 0; filterRows(); renderTypes(); }
  $('clearType').onclick = () => setType('');
  function renderTypes() {
    const sums = new Map();
    for (const node of descendants(scope)) if (!node.c) sums.set(node.ext, (sums.get(node.ext) || 0) + node.s);
    const sorted = [...sums].sort((a, b) => b[1] - a[1]);
    $('fileTypes').replaceChildren();
    if (!sorted.length) $('fileTypes').append(make('p', 'type-hint', '当前目录没有文件'));
    const top = sorted.slice(0, 7); if (sorted.length > 7) top.push([`其他 ${sorted.length - 7} 种`, sorted.slice(7).reduce((sum, item) => sum + item[1], 0)]);
    top.forEach(([ext, size], i) => {
      const row = make(i < 7 ? 'button' : 'div', 'type-row' + (type === ext ? ' active' : ''));
      if (i < 7) row.onclick = () => setType(type === ext ? '' : ext);
      const line = make('span', 'type-top'); line.append(make('span', '', ext), make('span', '', bytes(size)));
      const bar = make('span', 'type-bar'), fill = make('i'); fill.style.width = `${scope.s ? size / scope.s * 100 : 0}%`; fill.style.background = Object.values(groups)[i % 6].color; bar.append(fill); row.append(line, bar); $('fileTypes').append(row);
    });
  }
  function renderMap() {
    const map = $('treemap'); map.replaceChildren();
    const children = scope.c.filter(node => node.s > 0);
    $('mapCount').textContent = `${children.length} 个有大小的项目`;
    if (!children.length) { map.append(make('p', 'empty', scope.c.length ? '当前目录仅有零字节项目，请在列表查看。' : '当前目录为空。')); return; }
    function layout(items, x, y, width, height, total) {
      if (items.length === 1) {
        const node = items[0], tile = make('button', `tile${width < 75 || height < 45 ? ' tiny' : ''}${node === selected ? ' selected' : ''}`);
        tile.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;background:${groups[node.group].color}`;
        tile.title = `${node.n}\n${bytes(node.s)} · ${percent(ratio(node.s))}\n${fullPath(node)}`;
        tile.setAttribute('aria-label', `${node.c ? '进入文件夹' : '查看文件'} ${node.n}，${bytes(node.s)}`);
        tile.dataset.id = node.id; tile.onclick = () => node.c ? go(node) : select(node);
        if (width > 65 && height > 28) tile.append(make('span', 'tile-label', node.n));
        if (width > 70 && height > 65) tile.append(make('span', 'tile-size', bytes(node.s)));
        if (width > 90 && height > 105) tile.append(make('span', 'tile-meta', `${percent(ratio(node.s))}${node.c ? ' / ' + number(node.f) + ' files' : ''}`));
        map.append(tile); return;
      }
      let cut = 0, sum = 0;
      while (cut < items.length - 1 && sum < total / 2) sum += items[cut++].s;
      const share = sum / total;
      if (width >= height) { layout(items.slice(0, cut), x, y, width * share, height, sum); layout(items.slice(cut), x + width * share, y, width * (1 - share), height, total - sum); }
      else { layout(items.slice(0, cut), x, y, width, height * share, sum); layout(items.slice(cut), x, y + height * share, width, height * (1 - share), total - sum); }
    }
    layout(children, 0, 0, map.clientWidth, map.clientHeight, children.reduce((sum, node) => sum + node.s, 0));
  }
  let resizeTimer; new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderMap, 100); }).observe($('treemap'));

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { const area = make('textarea'); area.value = text; area.style.cssText = 'position:fixed;left:-10000px;top:0'; document.body.append(area); area.select(); const ok = document.execCommand('copy'); area.remove(); return ok; }
  }
  $('copyPath').onclick = async () => { $('copyStatus').textContent = await copy(fullPath(selected)) ? '完整路径已复制' : '浏览器未允许复制，请选中上方路径手动复制'; };
  const command = `cd /d "${data.root}"\npython tools/disk-explorer/scan.py`;
  function dialog(title) { $('dialogTitle').textContent = title; $('dialogBody').replaceChildren(); $('copyCommand').hidden = true; $('infoDialog').showModal(); }
  $('rescan').onclick = () => { dialog('更新这份空间快照'); $('dialogBody').append(make('p', '', '这是离线扫描快照，刷新浏览器不会重新读取磁盘。请在 Windows 命令提示符（cmd）运行：'), make('pre', '', command), make('p', '', '扫描完成后，重新打开或刷新此网页。扫描包含隐藏文件，仅读取元数据，自动排除报告输出目录。')); $('copyCommand').hidden = false; $('copyCommand').textContent = '复制扫描命令'; };
  $('copyCommand').onclick = async () => { $('copyCommand').textContent = await copy(command) ? '已复制' : '请选中命令手动复制'; };
  $('closeDialog').onclick = () => $('infoDialog').close();
  $('scanDetails').onclick = () => {
    dialog('扫描范围与大小口径');
    $('dialogBody').append(make('p', '', `扫描根目录：${data.root}`), make('p', '', `扫描时间：${data.generated}（北京时间）。报告排除自身目录 ${data.excluded}，避免重复扫描时统计自身。`), make('p', '', '大小为文件逻辑字节数，不等于 NTFS 实际分配空间；硬链接按路径分别计数。包含 .git、依赖、构建、归档和隐藏文件；不跟随符号链接、junction 等重解析点。文件类型统计包含当前目录的所有子目录。'), make('p', '', '这份页面仅记录路径、大小和修改时间，不包含文件内容，没有联网请求或删除文件操作。请把报告保留在本机。'));
    $('dialogBody').append(make('p', '', `跳过或无法读取：${data.issues.length} 项。${data.issues.length ? '总大小为成功扫描到的部分；详情如下。' : '本次无跳过项。'}`));
    if (data.issues.length) { const list = make('ul'); data.issues.forEach(issue => list.append(make('li', '', `${issue.path}：${issue.reason}`))); $('dialogBody').append(list); }
  };
  $('export').onclick = () => {
    const cell = value => { let text = String(value); if (/^[=+@\-\t\r]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
    const csv = '\ufeff' + [['名称', '相对路径', '类型', '字节', '文件数', '文件夹数'], ...rows.map(node => [node.n, node.p, node.c ? '文件夹' : '文件', node.s, node.f, node.d])].map(row => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), link = make('a'); link.href = url; link.download = 'disk-explorer-current-list.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  go(root, false); readRoute();
})();
