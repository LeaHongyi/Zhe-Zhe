(() => {
  'use strict';
  const owner = 'LeaHongyi';
  const repository = 'Zhe-Zhe';
  const prefix = '[笔记] ';
  const draftKey = 'zhe-zhe-note-draft-v1';
  const $ = id => document.getElementById(id);
  let draftTimer;
  let currentPage = 1;
  let generation = 0;
  let loading = false;
  const seen = new Set();
  const safeURL = value => {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
    catch { return null; }
  };
  // Render an allowlisted DOM; never insert issue HTML directly into the page.
  function renderHTML(html, target) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const allowed = new Set(['P','BR','STRONG','EM','DEL','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','CODE','PRE','HR','A','IMG','TABLE','THEAD','TBODY','TR','TD','TH','DETAILS','SUMMARY']);
    const blocked = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','SVG','MATH']);
    function copy(node, parent) {
      if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.textContent)); return; }
      if (node.nodeType !== Node.ELEMENT_NODE || blocked.has(node.tagName)) return;
      if (!allowed.has(node.tagName)) { node.childNodes.forEach(child => copy(child, parent)); return; }
      const element = document.createElement(node.tagName.toLowerCase());
      if (node.tagName === 'IMG') {
        const src = safeURL(node.getAttribute('src'));
        if (!src) return;
        element.src = src; element.alt = node.getAttribute('alt') || '笔记照片'; element.loading = 'lazy'; element.referrerPolicy = 'no-referrer';
      }
      if (node.tagName === 'A') {
        const href = safeURL(node.getAttribute('href'));
        if (href) { element.href = href; element.target = '_blank'; element.rel = 'noopener noreferrer'; }
      }
      node.childNodes.forEach(child => copy(child, element)); parent.append(element);
    }
    doc.body.childNodes.forEach(node => copy(node, target));
  }
  function renderDraft(text, target) {
    target.replaceChildren();
    const expression = /!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g;
    let previous = 0;
    for (const match of text.matchAll(expression)) {
      if (match.index > previous) { const p = document.createElement('p'); p.textContent = text.slice(previous, match.index); target.append(p); }
      const src = safeURL(match[2]);
      if (src) { const image = document.createElement('img'); image.src = src; image.alt = match[1] || '笔记照片'; image.referrerPolicy = 'no-referrer'; target.append(image); }
      previous = match.index + match[0].length;
    }
    if (previous < text.length) { const p = document.createElement('p'); p.textContent = text.slice(previous); target.append(p); }
  }
  function saveDraft() {
    clearTimeout(draftTimer);
    try {
      localStorage.setItem(draftKey, JSON.stringify({ title: $('title').value, body: $('body').value }));
      $('draft-status').textContent = '草稿已保存在本机';
    } catch { $('draft-status').textContent = '无法保存草稿，请先复制正文备份'; }
  }
  function updatePreview() {
    $('preview-title').textContent = $('title').value.trim() || '未命名笔记';
    renderDraft($('body').value, $('preview-body'));
  }
  function openEditor() { $('composer').hidden = false; $('title').focus(); }
  $('write').addEventListener('click', openEditor);
  $('close-editor').addEventListener('click', () => { saveDraft(); $('composer').hidden = true; $('write').focus(); });
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (draft && typeof draft.title === 'string' && typeof draft.body === 'string') {
      $('title').value = draft.title.slice(0,120); $('body').value = draft.body.slice(0,5000); $('draft-status').textContent = '已恢复本机草稿';
    }
  } catch { $('draft-status').textContent = '本机草稿不可用'; }
  $('counter').textContent = `${$('body').value.length} / 5000`;
  $('note-form').addEventListener('input', () => {
    $('counter').textContent = `${$('body').value.length} / 5000`;
    $('draft-status').textContent = '正在保存……';
    clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 400);
    if (!$('preview-panel').hidden) updatePreview();
  });
  window.addEventListener('pagehide', saveDraft);
  $('preview').addEventListener('click', () => { updatePreview(); $('preview-panel').hidden = !$('preview-panel').hidden; $('preview').textContent = $('preview-panel').hidden ? '预览' : '收起预览'; });
  $('clear').addEventListener('click', () => {
    if (!confirm('确定清空本机草稿？已发布的笔记不会受影响。')) return;
    $('title').value = ''; $('body').value = ''; $('counter').textContent = '0 / 5000'; saveDraft(); updatePreview();
  });
  $('note-form').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('title').value.trim(), body = $('body').value.trim();
    if (!title || !body) { $('publish-status').textContent = '请填写标题和正文后再发布。'; return; }
    saveDraft();
    const url = new URL(`https://github.com/${owner}/${repository}/issues/new`);
    url.searchParams.set('title', prefix + title); url.searchParams.set('body', body);
    // Long URLs can be rejected by browsers or proxies. Keep the draft and use clipboard instead.
    if (url.href.length > 7500) {
      $('publish-status').replaceChildren(document.createTextNode('这篇笔记较长，请复制正文，在 GitHub 中粘贴后发布：'));
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'secondary'; copy.textContent = '复制正文';
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(body); copy.textContent = '已复制'; } catch { $('body').focus(); $('body').select(); copy.textContent = '请手动复制所选正文'; } });
      const link = document.createElement('a'); link.textContent = '打开 GitHub 发布页 ↗'; link.href = `https://github.com/${owner}/${repository}/issues/new?title=${encodeURIComponent(prefix + title)}`; link.target = '_blank'; link.rel = 'noopener noreferrer';
      $('publish-status').append(copy, document.createTextNode(' '), link); return;
    }
    const opened = window.open(url.href, '_blank', 'noopener,noreferrer');
    $('publish-status').replaceChildren(document.createTextNode('请在 GitHub 完成最终发布。发布后回到这里点击「刷新笔记」。草稿会保留。 '));
    const link = document.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '重新打开发布页 ↗'; $('publish-status').append(link);
  });
  function showNote(issue) {
    const article = document.createElement('article'); article.className = 'note';
    const time = document.createElement('time'); time.dateTime = issue.created_at; time.textContent = new Date(issue.created_at).toLocaleString('zh-CN', {year:'numeric', month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const title = document.createElement('h2'); title.textContent = issue.title.slice(prefix.length);
    const content = document.createElement('div'); content.className = 'note-body';
    if (typeof issue.body_html === 'string') renderHTML(issue.body_html, content);
    else renderDraft(issue.body || '', content);
    const link = document.createElement('a'); link.className = 'note-link'; link.href = `https://github.com/${owner}/${repository}/issues/${issue.number}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '查看原文 / 编辑 ↗';
    article.append(time,title,content,link); $('feed').append(article);
  }
  async function loadNotes(reset = false) {
    if (loading) return;
    loading = true; const requestGeneration = ++generation;
    if (reset) { currentPage = 1; seen.clear(); $('feed').replaceChildren(); }
    $('refresh').disabled = true; $('more').disabled = true; $('feed-status').textContent = '正在读取笔记……';
    try {
      const url = `https://api.github.com/repos/${owner}/${repository}/issues?creator=${owner}&state=open&sort=created&direction=desc&per_page=30&page=${currentPage}`;
      const response = await fetch(url, {headers: {Accept:'application/vnd.github.full+json'}, cache:'no-store', signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? '读取次数较多，请稍后重试。' : `读取失败（${response.status}），请稍后重试。`);
      const issues = await response.json();
      if (!Array.isArray(issues)) throw new Error('笔记数据暂时不可用。');
      if (requestGeneration !== generation) return;
      for (const issue of issues) {
        if (issue.pull_request || issue.user?.login.toLowerCase() !== owner.toLowerCase() || !issue.title?.startsWith(prefix) || seen.has(issue.number)) continue;
        seen.add(issue.number); showNote(issue);
      }
      $('more').hidden = !response.headers.get('link')?.includes('rel="next"'); currentPage++;
      $('feed-status').textContent = seen.size ? `已显示 ${seen.size} 篇笔记` : ($('more').hidden ? '还没有公开笔记，写下第一篇吧。' : '这一页没有笔记，可以继续加载。');
      if (!seen.size && $('more').hidden) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '故事还在继续。点击「写笔记」，记录新的日常。'; $('feed').append(empty); }
    } catch (error) {
      $('feed-status').textContent = error.name === 'TimeoutError' ? '读取超时，请点击「刷新笔记」重试。' : (error instanceof TypeError ? '暂时无法连接 GitHub，请检查网络后重试。' : error.message);
    } finally { loading = false; $('refresh').disabled = false; $('more').disabled = false; }
  }
  $('refresh').addEventListener('click', () => loadNotes(true));
  $('more').addEventListener('click', () => loadNotes());
  loadNotes(true);
})();
