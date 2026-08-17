// 蓝色大肥鱼 DSH - UI 逻辑
// 启动流程：查询状态 → 无 Key 先填 Key → 等主进程把服务拉起 → 加载页面
const $ = (id) => document.getElementById(id);

let status = null;

// 视图切换（.show 类驱动，配合 CSS 过渡动画）
function show(el) {
  ['boot', 'error', 'keyform', 'stage'].forEach(id => $(id).classList.remove('show'));
  $(el).classList.add('show');
}

function bootMsg(m) { $('bootMsg').textContent = m; }

async function loadPage() {
  const st = await window.dsh.status();
  if (st.ready && st.port) {
    $('host').src = 'http://127.0.0.1:' + st.port + '/';
    show('stage');
  } else {
    setTimeout(loadPage, 600);
  }
}

async function start() {
  status = await window.dsh.status();

  if (!status.hasDsh) {
    show('error');
    $('errTitle').textContent = '未安装';
    $('errDetail').textContent = '未找到 DeepSeek Harness 核心。\n请先运行「deepseek-harness-client.exe」完成安装。';
    return;
  }
  if (!status.hasKey) {
    show('keyform');
    $('keyInput').focus();
    return;
  }
  show('boot');
  bootMsg('正在启动服务');
  const r = await window.dsh.start();
  if (!r.ok) {
    show('error');
    $('errTitle').textContent = '启动失败';
    $('errDetail').textContent = r.error + '\n\n最近日志：\n' + (r.log || '（无）');
    return;
  }
  bootMsg('正在加载界面');
  $('host').src = 'http://127.0.0.1:' + r.port + '/';
  $('host').onload = () => { window.dsh.log('iframe 已加载页面'); };
  show('stage');
}

$('keyOk').onclick = async () => {
  const key = $('keyInput').value.trim();
  if (!key) { $('keyErr').textContent = 'Key 不能为空'; return; }
  $('keyErr').textContent = '';
  const r = await window.dsh.submitKey(key);
  if (!r.ok) { $('keyErr').textContent = '保存失败：' + r.error; return; }
  start();
};

$('keyInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('keyOk').click();
});

$('errRetry').onclick = async () => {
  show('boot');
  bootMsg('正在重新启动');
  loadPage();
};

// ---------------- API Key / 余额面板 ----------------
let panelOpen = false;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refreshKeyInfo() {
  try {
    const info = await window.dsh.keyInfo();
    const el = $('pKeyState');
    if (info.hasKey) {
      el.textContent = '已配置  ' + info.masked;
      el.className = 'ok';
    } else {
      el.textContent = '未配置';
      el.className = 'bad';
    }
  } catch (e) {
    $('pKeyState').textContent = '查询失败';
  }
}

$('keyBtn').onclick = () => {
  panelOpen = !panelOpen;
  $('panel').classList.toggle('show', panelOpen);
  $('keyBtn').classList.toggle('active', panelOpen);
  if (panelOpen) refreshKeyInfo();
};

// 点击面板外部关闭
document.addEventListener('click', (e) => {
  if (panelOpen && !e.target.closest('#panel') && e.target.id !== 'keyBtn') {
    panelOpen = false;
    $('panel').classList.remove('show');
    $('keyBtn').classList.remove('active');
  }
});

$('pKeySave').onclick = async () => {
  const key = $('pKeyInput').value.trim();
  if (!key) {
    refreshKeyInfo();
    return;
  }
  const btn = $('pKeySave');
  btn.disabled = true;
  btn.textContent = '保存中…';
  const r = await window.dsh.submitKey(key);
  if (r.ok) {
    $('pKeyInput').value = '';
    btn.textContent = '已保存 ✓';
    refreshKeyInfo();
  } else {
    btn.textContent = '失败';
    $('pKeyState').textContent = '保存失败：' + r.error;
    $('pKeyState').className = 'bad';
  }
  setTimeout(() => { btn.disabled = false; btn.textContent = '保存'; }, 1500);
};

$('pBalanceBtn').onclick = async () => {
  const btn = $('pBalanceBtn');
  btn.disabled = true;
  btn.textContent = '查询中…';
  const r = await window.dsh.checkBalance();
  const box = $('pBalance');
  if (!r.ok) {
    box.innerHTML = '<span class="bad">' + esc(r.error) + '</span>';
  } else {
    let html = '';
    if (!r.available) html += '<span class="bad">账户不可用</span><br>';
    (r.infos || []).forEach((b) => {
      const sym = b.currency === 'CNY' ? '¥' : (b.currency === 'USD' ? '$' : b.currency + ' ');
      html += '<div class="amt">' + sym + esc(b.total) + '</div>' +
        '<div class="small">' + esc(b.currency) + ' · 赠送 ' + sym + esc(b.granted) +
        ' · 充值 ' + sym + esc(b.topped) + '</div>';
    });
    if (!html) html = '（无余额数据）';
    box.innerHTML = html;
  }
  setTimeout(() => { btn.disabled = false; btn.textContent = '查询余额'; }, 2000);
};

// ================= 选项卡：对话 / 文件 =================
$('tabChat').onclick = () => switchView('chat');
$('tabFiles').onclick = () => switchView('files');

function switchView(v) {
  document.body.classList.toggle('view-files', v === 'files');
  $('tabChat').classList.toggle('active', v === 'chat');
  $('tabFiles').classList.toggle('active', v === 'files');
  if (v === 'files') {
    if (currentFile) $('content-pane').classList.add('open');
    loadTree();
  }
}

// ================= 文件树 =================
let treeCache = {};   // dirRel -> {loaded:bool}
let expandedDirs = {};
let currentFile = null;   // { rel, name }
let dirty = false;

function fmtSize(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function listDir(rel) {
  const r = await window.dsh.fsList(rel);
  if (!r.ok) throw new Error(r.error);
  return r.items;
}

async function loadTree() {
  const tree = $('tree');
  try {
    const roots = await window.dsh.fsRoots();
    tree.innerHTML = '';
    for (const r of roots) {
      tree.appendChild(makeRootNode(r));
    }
    if (!roots.length) {
      tree.innerHTML = '<div class="tempty">资源管理器为空<br>（点击右上角 📂 添加文件夹，或 📄 添加文件）</div>';
    }
  } catch (e) {
    tree.innerHTML = '<div class="tempty">加载失败：' + escHtml(e.message) + '</div>';
  }
}

function makeRootNode(root) {
  // 外部根：绝对路径作 rel
  const it = { name: root.name, dir: root.dir, size: 0, external: root.ext };
  const rel = root.rel || '';
  const wrap = document.createElement('div');
  wrap.className = 'tnode tdir text-root';
  wrap.dataset.rel = rel;
  wrap.dataset.dir = '1';
  wrap.dataset.name = it.name;
  const row = document.createElement('div');
  row.className = 'tnode-row';
  const arrow = document.createElement('span');
  arrow.className = 'tarrow';
  if (root.dir) {
    arrow.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4 L10 8 L6 12"/></svg>';
  }
  const icon = document.createElement('span');
  icon.className = 'ticon';
  icon.textContent = root.dir ? '📁' : '📄';
  const name = document.createElement('span');
  name.className = 'tname';
  name.textContent = it.name;
  row.appendChild(arrow);
  row.appendChild(icon);
  row.appendChild(name);
  wrap.appendChild(row);
  const childBox = document.createElement('div');
  childBox.style.display = 'none';
  wrap.appendChild(childBox);

  if (root.dir) {
    wrap.onclick = async (ev) => {
      if (!ev.target.closest('.tnode-row') && ev.target !== wrap) return;
      ev.stopPropagation();
      const isOpen = childBox.style.display !== 'none';
      childBox.style.display = isOpen ? 'none' : 'block';
      arrow.classList.toggle('open', !isOpen);
      if (!isOpen) {
        try {
          const kids = await listDir(rel);
          childBox.innerHTML = '';
          kids.forEach((k) => childBox.appendChild(makeNode(k, rel)));
          if (!kids.length) {
            const e = document.createElement('div');
            e.className = 'tempty';
            e.textContent = '（空文件夹）';
            childBox.appendChild(e);
          }
        } catch (err) {
          const e = document.createElement('div');
          e.className = 'tempty';
          e.textContent = '打开失败：' + escHtml(err.message);
          childBox.appendChild(e);
        }
      }
    };
  } else {
    wrap.onclick = async (ev) => {
      if (!ev.target.closest('.tnode-row')) return;
      ev.stopPropagation();
      document.querySelectorAll('#tree .tnode.sel').forEach(n => n.classList.remove('sel'));
      wrap.classList.add('sel');
      openFile(rel, it.name);
    };
  }
  return wrap;
}

function makeNode(it, parentRel) {
  const rel = parentRel ? parentRel + '/' + it.name : it.name;
  const wrap = document.createElement('div');
  wrap.className = 'tnode' + (it.dir ? ' tdir' : '');
  wrap.dataset.rel = rel;
  wrap.dataset.dir = it.dir ? '1' : '0';
  wrap.dataset.name = it.name;
  const row = document.createElement('div');
  row.className = 'tnode-row';
  const arrow = document.createElement('span');
  arrow.className = 'tarrow';
  if (it.dir) {
    arrow.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4 L10 8 L6 12"/></svg>';
  }
  const icon = document.createElement('span');
  icon.className = 'ticon';
  icon.textContent = it.dir ? '📁' : '📄';
  const name = document.createElement('span');
  name.className = 'tname';
  name.textContent = it.name;
  row.appendChild(arrow);
  row.appendChild(icon);
  row.appendChild(name);
  if (!it.dir) {
    const sz = document.createElement('span');
    sz.className = 'tsize';
    sz.textContent = fmtSize(it.size);
    row.appendChild(sz);
  }
  row.style.paddingLeft = (parentRel ? (parentRel.split('/').length) * 14 : 0) + 8 + 'px';
  wrap.appendChild(row);

  if (it.dir) {
    const childBox = document.createElement('div');
    childBox.style.display = expandedDirs[rel] ? 'block' : 'none';
    if (expandedDirs[rel]) arrow.classList.add('open');
    wrap.appendChild(childBox);
    wrap.onclick = async (ev) => {
      if (!ev.target.closest('.tnode-row') && ev.target !== wrap) return;
      ev.stopPropagation();
      const isOpen = childBox.style.display !== 'none';
      childBox.style.display = isOpen ? 'none' : 'block';
      arrow.classList.toggle('open', !isOpen);
      if (!isOpen) {
        try {
          const kids = await listDir(rel);
          childBox.innerHTML = '';
          kids.forEach((k) => childBox.appendChild(makeNode(k, rel)));
          if (!kids.length) {
            const e = document.createElement('div');
            e.className = 'tempty';
            e.textContent = '（空文件夹）';
            childBox.appendChild(e);
          }
        } catch (err) {
          const e = document.createElement('div');
          e.className = 'tempty';
          e.textContent = '打开失败：' + escHtml(err.message);
          childBox.appendChild(e);
        }
      }
    };
  } else {
    wrap.onclick = async (ev) => {
      if (!ev.target.closest('.tnode-row')) return;
      ev.stopPropagation();
      document.querySelectorAll('#tree .tnode.sel').forEach(n => n.classList.remove('sel'));
      wrap.classList.add('sel');
      openFile(rel, it.name);
    };
  }
  return wrap;
}

// ================= 编辑器 =================
// 自维护撤销/重做历史栈（比 execCommand 可靠）
let history = [];
let historyIdx = -1;
let suppressHistory = false;

function snapshot() {
  history = history.slice(0, historyIdx + 1);
  history.push($('editor').value);
  if (history.length > 100) history.shift();
  historyIdx = history.length - 1;
}

async function openFile(rel, name) {
  const r = await window.dsh.fsRead(rel);
  if (!r.ok) {
    $('editor').value = '';
    $('contentName').textContent = '打开失败';
    $('editorPath').textContent = rel;
    $('editorDirty').textContent = r.error;
    return;
  }
  currentFile = { rel, name };
  dirty = false;
  history = [r.content];
  historyIdx = 0;
  $('editor').value = r.content;
  $('contentName').textContent = name;
  $('editorPath').textContent = rel;
  $('editorDirty').textContent = '';
  $('content-pane').classList.add('open');
  $('editor').focus();
}

function markDirty() {
  if (!currentFile) return;
  dirty = true;
  $('editorDirty').textContent = '● 未保存';
  $('editorDirty').className = 'dirty';
}

$('editor').addEventListener('input', () => {
  markDirty();
  if (!suppressHistory) snapshot();
});

function applyHistory() {
  suppressHistory = true;
  $('editor').value = history[historyIdx];
  suppressHistory = false;
  markDirty();
  $('editor').focus();
}

$('btnUndo').onclick = () => {
  if (historyIdx > 0) { historyIdx--; applyHistory(); }
};
$('btnRedo').onclick = () => {
  if (historyIdx < history.length - 1) { historyIdx++; applyHistory(); }
};

$('btnSave').onclick = async () => {
  if (!currentFile) return;
  const btn = $('btnSave');
  btn.disabled = true;
  const r = await window.dsh.fsWrite(currentFile.rel, $('editor').value);
  btn.disabled = false;
  if (r.ok) {
    dirty = false;
    $('editorDirty').textContent = '已保存 ' + new Date().toLocaleTimeString();
    $('editorDirty').className = '';
    loadTree(); // 刷新树（大小变化）
  } else {
    $('editorDirty').textContent = '保存失败：' + r.error;
    $('editorDirty').className = 'dirty';
  }
};

// 撤销 / 重做（自维护历史栈）
$('btnUndo').onclick = () => {
  if (historyIdx > 0) { historyIdx--; applyHistory(); }
};
$('btnRedo').onclick = () => {
  if (historyIdx < history.length - 1) { historyIdx++; applyHistory(); }
};

document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 's' && currentFile) {
    e.preventDefault();
    $('btnSave').click();
  }
  if (ctrl && e.key.toLowerCase() === 'z') {
    if (document.activeElement === $('editor')) { e.preventDefault(); $('btnUndo').click(); }
  }
  if (ctrl && e.key.toLowerCase() === 'y') {
    if (document.activeElement === $('editor')) { e.preventDefault(); $('btnRedo').click(); }
  }
});

$('btnOpenFile').onclick = async () => {
  const r = await window.dsh.fsPickFile();
  if (r.ok) loadTree();
};
$('btnOpenFolder').onclick = async () => {
  const r = await window.dsh.fsPickFolder();
  if (r.ok) loadTree();
};

// ================= 右键菜单：新建/删除 =================
let ctxTarget = null; // { rel, dir }

function showCtx(x, y, items) {
  const m = $('ctxMenu');
  m.innerHTML = '';
  items.forEach((it) => {
    if (it.sep) {
      const s = document.createElement('div');
      s.className = 'sep';
      m.appendChild(s);
      return;
    }
    const mi = document.createElement('div');
    mi.className = 'mi' + (it.danger ? ' danger' : '');
    mi.innerHTML = '<span>' + escHtml(it.icon || '') + '</span><span>' + escHtml(it.label) + '</span>';
    mi.onclick = () => { hideCtx(); it.action(); };
    m.appendChild(mi);
  });
  m.style.left = Math.min(x, window.innerWidth - 170) + 'px';
  m.style.top = Math.min(y, window.innerHeight - items.length * 34 - 20) + 'px';
  m.classList.add('show');
}

function hideCtx() {
  $('ctxMenu').classList.remove('show');
}

document.addEventListener('click', hideCtx);

// 右键菜单（document 级事件委托：树节点 / 树空白 / 其他区域）
document.addEventListener('contextmenu', (e) => {
  const node = e.target.closest ? e.target.closest('.tnode') : null;
  if (!node) {
    hideCtx();
    return;
  }
  e.preventDefault();
  const isDir = node.dataset.dir === '1';
  const rel = node.dataset.rel;
  const name = node.dataset.name || '';
  const isExtRoot = node.classList.contains('text-root');
  const parentRel = isDir ? rel : (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
  ctxTarget = parentRel ? { rel: parentRel, dir: true } : null;
  const items = [];
  if (isExtRoot) {
    items.push({
      icon: '➖', label: '从资源管理器移除', danger: true,
      action: () => removeRoot(rel),
    });
    items.push({ sep: true });
  }
  if (isDir) {
    items.push({ icon: '📂', label: '打开文件夹', action: () => revealPath(rel) });
  } else {
    items.push({ icon: '📖', label: '打开文件', action: () => openFile(rel, name) });
  }
  items.push(
    { icon: '📄', label: '新建文件', action: () => promptNewFile(parentRel || '') },
    { icon: '📁', label: '新建文件夹', action: () => promptNewDir(parentRel || '') },
  );
  items.push({ sep: true });
  items.push({
    icon: '🗑', label: isDir ? '删除文件夹' : '删除文件', danger: true,
    action: () => confirmDelete(rel, isDir),
  });
  showCtx(e.clientX, e.clientY, items);
});

// 树空白处右键：新建 / 刷新
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest || !e.target.closest('#tree')) return;
  if (e.target.closest('.tnode')) return; // 节点右键已处理
  e.preventDefault();
  ctxTarget = null;
  const items = [
    { icon: '📄', label: '新建文件', action: () => promptNewFile('') },
    { icon: '📁', label: '新建文件夹', action: () => promptNewDir('') },
    { icon: '🔄', label: '刷新', action: () => loadTree() },
  ];
  showCtx(e.clientX, e.clientY, items);
});

async function revealPath(rel) {
  const r = await window.dsh.fsReveal(rel);
  if (!r.ok) alert('打开失败：' + r.error);
}

async function removeRoot(rel) {
  if (!confirm('将「' + rel + '」从资源管理器中移除？（不会删除磁盘上的文件）')) return;
  const r = await window.dsh.fsRemoveRoot(rel);
  if (!r.ok) { alert('移除失败：' + r.error); return; }
  loadTree();
}

// 节点行内右键（与空白区分：确保命中节点）
// 节点本身也有 contextmenu —— 用上面的统一处理即可（node 命中）

// 输入弹窗
function promptInput(title, desc, placeholder, def) {
  return new Promise((resolve) => {
    $('promptTitle').textContent = title;
    $('promptDesc').textContent = desc || '';
    $('promptInput').value = def || '';
    $('promptInput').placeholder = placeholder || '';
    $('promptMask').classList.add('show');
    $('promptInput').focus();
    const done = (val) => {
      $('promptMask').classList.remove('show');
      resolve(val);
    };
    $('promptOk').onclick = () => done($('promptInput').value.trim());
    $('promptCancel').onclick = () => done(null);
    $('promptInput').onkeydown = (e) => {
      if (e.key === 'Enter') done($('promptInput').value.trim());
      if (e.key === 'Escape') done(null);
    };
  });
}

async function promptNewFile(parentRel) {
  const name = await promptInput('新建文件', '在 ' + (parentRel || '工作区根目录') + ' 下新建：', '例如 notes.txt');
  if (!name) return;
  const r = await window.dsh.fsCreateFile(parentRel, name);
  if (!r.ok) { alert('新建失败：' + r.error); return; }
  loadTree();
  openFile(r.rel, name);
}

async function promptNewDir(parentRel) {
  const name = await promptInput('新建文件夹', '在 ' + (parentRel || '工作区根目录') + ' 下新建：', '例如 myfolder');
  if (!name) return;
  const r = await window.dsh.fsCreateDir(parentRel, name);
  if (!r.ok) { alert('新建失败：' + r.error); return; }
  loadTree();
}

async function confirmDelete(rel, isDir) {
  const isAbsRoot = rel && rel.includes(':\\') || rel.includes(':/');
  const extra = isAbsRoot ? '（这是添加到资源管理器的根目录，将从磁盘上彻底删除）' : '';
  if (!confirm('确定删除「' + rel + '」' + (isDir ? ' 及其全部内容' : '') + ' 吗？' + extra + '此操作不可恢复！')) return;
  const r = await window.dsh.fsDelete(rel);
  if (!r.ok) { alert('删除失败：' + r.error); return; }
  if (currentFile && currentFile.rel === rel) {
    currentFile = null;
    $('content-pane').classList.remove('open');
    $('contentName').textContent = '未打开文件';
    $('editor').value = '';
    $('editorPath').textContent = '';
    $('editorDirty').textContent = '';
  }
  loadTree();
}

// ================= 设置面板 =================
let settingsOpen = false;
let marketData = null;
let marketCat = '';

$('setBtn').onclick = () => { openSettings(); };
$('setClose').onclick = () => { closeSettings(); };

function openSettings() {
  settingsOpen = true;
  $('settingsMask').classList.add('show');
  switchSec('account');
  refreshSetAccount();
}

function closeSettings() {
  settingsOpen = false;
  $('settingsMask').classList.remove('show');
}

document.querySelectorAll('#settings .snav .sitem').forEach((it) => {
  it.onclick = () => switchSec(it.dataset.sec);
});

function switchSec(sec) {
  document.querySelectorAll('#settings .snav .sitem').forEach((n) => n.classList.toggle('active', n.dataset.sec === sec));
  ['account', 'skills', 'mcp', 'market'].forEach((s) => {
    $('sec-' + s).style.display = s === sec ? 'block' : 'none';
  });
  if (sec === 'skills') loadSkills();
  if (sec === 'mcp') loadMcp();
  if (sec === 'market') loadMarket();
  if (sec === 'account') refreshSetAccount();
}

// ---- 账户 ----
async function refreshSetAccount() {
  try {
    const info = await window.dsh.keyInfo();
    $('setKeyState').textContent = info.hasKey ? '已配置' : '未配置';
    $('setKeyState').className = 'sl-tag ' + (info.hasKey ? 'user' : '');
    $('setKeyMasked').textContent = info.hasKey ? '当前 Key：' + info.masked : '尚未配置 API Key';
  } catch (e) { }
}

$('setKeyEdit').onclick = async () => {
  const key = await promptInput('修改 API Key', '输入新的 DeepSeek API Key（留空取消）：', 'sk-...');
  if (!key) return;
  const r = await window.dsh.submitKey(key);
  if (r.ok) { alert('Key 已更新'); refreshSetAccount(); }
  else alert('保存失败：' + r.error);
};

$('setBalanceBtn').onclick = async () => {
  const btn = $('setBalanceBtn');
  btn.disabled = true;
  btn.textContent = '查询中…';
  const r = await window.dsh.checkBalance();
  const box = $('setBalance');
  if (!r.ok) {
    box.textContent = r.error;
  } else {
    const b = (r.infos || [])[0];
    if (b) {
      const sym = b.currency === 'CNY' ? '¥' : (b.currency === 'USD' ? '$' : b.currency + ' ');
      box.textContent = '余额 ' + sym + b.total + '（赠送 ' + sym + b.granted + ' · 充值 ' + sym + b.topped + '）';
    } else box.textContent = '（无余额数据）';
  }
  setTimeout(() => { btn.disabled = false; btn.textContent = '查询余额'; }, 2000);
};

// ---- Skills ----
async function loadSkills() {
  const box = $('skillsList');
  box.innerHTML = '<div class="sempty">加载中…</div>';
  const r = await window.dsh.setSkillsList();
  if (!r.ok) { box.innerHTML = '<div class="sempty">加载失败：' + escHtml(r.error) + '</div>'; return; }
  if (!r.items.length) { box.innerHTML = '<div class="sempty">暂无 skill</div>'; return; }
  box.innerHTML = '';
  r.items.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'sl-item';
    item.innerHTML = '<div class="sl-ic">🧠</div>' +
      '<div class="sl-main"><div class="sl-name">' + escHtml(s.name) +
      ' <span class="sl-tag ' + s.source + '">' + (s.source === 'user' ? '用户' : '内置') + '</span>' +
      (s.preset ? ' <span class="sl-tag">' + escHtml(s.preset) + '</span>' : '') + '</div>' +
      '<div class="sl-desc">' + escHtml(s.desc || '（无描述）') + '</div></div>';
    if (s.source === 'user') {
      const act = document.createElement('div');
      act.className = 'sl-act';
      const del = document.createElement('button');
      del.className = 'sbtn danger';
      del.textContent = '删除';
      del.onclick = async () => {
        if (!confirm('删除 skill「' + s.name + '」？（删除 ~/.dsh/skills/' + s.name + '）')) return;
        const rr = await window.dsh.setSkillDelete(s.name);
        if (rr.ok) loadSkills(); else alert('删除失败：' + rr.error);
      };
      act.appendChild(del);
      item.appendChild(act);
    }
    box.appendChild(item);
  });
}

$('skillCreate').onclick = async () => {
  const name = $('skillName').value.trim();
  if (!name) { alert('请输入 skill 名称'); return; }
  const r = await window.dsh.setSkillCreate(name);
  if (r.ok) { $('skillName').value = ''; loadSkills(); }
  else alert('新建失败：' + r.error);
};

// ---- MCP ----
let mcpEditingId = null;

async function loadMcp() {
  const box = $('mcpList');
  box.innerHTML = '<div class="sempty">加载中…</div>';
  const r = await window.dsh.setMcpList();
  if (!r.ok) { box.innerHTML = '<div class="sempty">' + escHtml(r.error) + '</div>'; return; }
  if (!r.items.length) { box.innerHTML = '<div class="sempty">尚未配置 MCP 服务器</div>'; return; }
  box.innerHTML = '';
  r.items.forEach((m) => {
    const item = document.createElement('div');
    item.className = 'sl-item';
    const detail = m.transport === 'stdio'
      ? 'stdio · ' + escHtml(m.command || '') + ' ' + escHtml((m.args || []).join(' '))
      : 'HTTP · ' + escHtml(m.url || '');
    item.innerHTML = '<div class="sl-ic">🔌</div>' +
      '<div class="sl-main"><div class="sl-name">' + escHtml(m.serverName || m.id) + '</div>' +
      '<div class="sl-desc">' + detail + '</div></div>';
    const act = document.createElement('div');
    act.className = 'sl-act';
    const edit = document.createElement('button');
    edit.className = 'sbtn';
    edit.textContent = '编辑';
    edit.onclick = () => openMcpForm(m);
    const del = document.createElement('button');
    del.className = 'sbtn danger';
    del.textContent = '删除';
    del.onclick = async () => {
      if (!confirm('删除 MCP 服务器「' + (m.serverName || m.id) + '」？')) return;
      const rr = await window.dsh.setMcpDelete(m.id);
      if (rr.ok) loadMcp(); else alert('删除失败：' + rr.error);
    };
    act.appendChild(edit);
    act.appendChild(del);
    item.appendChild(act);
    box.appendChild(item);
  });
}

function openMcpForm(m) {
  mcpEditingId = m ? m.id : null;
  $('mcpForm').style.display = 'block';
  $('mcpName').value = m ? (m.serverName || '') : '';
  $('mcpTransport').value = m && m.transport === 'streamable-http' ? 'http' : 'stdio';
  $('mcpCommand').value = m ? (m.command || '') : '';
  $('mcpArgs').value = m ? (m.args || []).join(' ') : '';
  $('mcpUrl').value = m ? (m.url || '') : '';
  $('mcpStdio').style.display = $('mcpTransport').value === 'stdio' ? 'block' : 'none';
  $('mcpHttp').style.display = $('mcpTransport').value === 'stdio' ? 'none' : 'block';
}

$('mcpTransport').onchange = () => {
  $('mcpStdio').style.display = $('mcpTransport').value === 'stdio' ? 'block' : 'none';
  $('mcpHttp').style.display = $('mcpTransport').value === 'stdio' ? 'none' : 'block';
};

$('mcpAdd').onclick = () => openMcpForm(null);
$('mcpCancel').onclick = () => { $('mcpForm').style.display = 'none'; };
$('mcpRefresh').onclick = () => loadMcp();

$('mcpSave').onclick = async () => {
  const cfg = {
    id: mcpEditingId,
    serverName: $('mcpName').value.trim(),
    transport: $('mcpTransport').value,
    command: $('mcpCommand').value.trim(),
    args: $('mcpArgs').value.trim(),
    url: $('mcpUrl').value.trim(),
  };
  const r = await window.dsh.setMcpSave(cfg);
  if (r.ok) { $('mcpForm').style.display = 'none'; loadMcp(); }
  else alert('保存失败：' + r.error);
};

// ---- 插件市场 ----
async function loadMarket(force) {
  const catsBox = $('marketCats');
  const itemsBox = $('marketItems');
  if (!marketData) {
    itemsBox.innerHTML = '<div class="sempty">加载插件市场…</div>';
  }
  const r = await window.dsh.setMarketList(force);
  if (!r.ok) {
    itemsBox.innerHTML = '<div class="sempty">加载失败：' + escHtml(r.error) + '</div>';
    return;
  }
  marketData = r.cats;
  if (!marketCat || !r.cats.some((c) => c.zh === marketCat)) marketCat = r.cats[0] ? r.cats[0].zh : '';
  catsBox.innerHTML = '';
  r.cats.forEach((c) => {
    const d = document.createElement('div');
    d.className = 'mc' + (c.zh === marketCat ? ' active' : '');
    d.textContent = c.zh + ' (' + c.items.length + ')';
    d.onclick = () => { marketCat = c.zh; renderMarket(); };
    catsBox.appendChild(d);
  });
  renderMarket();
}

function renderMarket() {
  const itemsBox = $('marketItems');
  const kw = $('marketSearch').value.trim().toLowerCase();
  const cat = marketData.find((c) => c.zh === marketCat);
  if (!cat) { itemsBox.innerHTML = '<div class="sempty">（无数据）</div>'; return; }
  let list = cat.items;
  if (kw) {
    list = list.filter((i) => (i.name + ' ' + i.desc + ' ' + i.url).toLowerCase().indexOf(kw) >= 0);
  }
  if (!list.length) { itemsBox.innerHTML = '<div class="sempty">没有匹配的插件</div>'; return; }
  itemsBox.innerHTML = '';
  list.forEach((i) => {
    const item = document.createElement('div');
    item.className = 'mk-item';
    item.innerHTML = '<div class="mk-name">' + escHtml(i.name) + '</div>' +
      (i.desc ? '<div class="mk-desc">' + escHtml(i.desc) + '</div>' : '') +
      '<div class="mk-url">' + escHtml(i.url) + '</div>';
    item.onclick = () => { window.open(i.url, '_blank'); };
    itemsBox.appendChild(item);
  });
}

$('marketSearch').addEventListener('input', renderMarket);
$('marketRefresh').onclick = () => loadMarket(true);

// 主进程启动服务后页面就绪
window.dsh.isMaximized().then(() => { }).catch(() => { });
start();
