export const OWNER = 'LeaHongyi';
export const REPO = 'Zhe-Zhe';
const root = `https://api.github.com/repos/${OWNER}/${REPO}`;
export class APIError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
export async function api(path, {token = '', method = 'GET', body, fetcher = fetch} = {}) {
  const url = path === '/user' ? 'https://api.github.com/user' : root + path;
  const headers = {Accept:'application/vnd.github+json'};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetcher(url, {method, headers, body:body === undefined ? undefined : JSON.stringify(body), cache:'no-store', signal:AbortSignal.timeout(60000)}); }
  catch { throw new APIError('网络连接中断，请稍后重试。照片和文字仍在草稿中。', 0); }
  if (!response.ok) {
    const messages = {401:'连接已失效，请重新连接发布账号。',403:'发布权限不足或访问过于频繁。请确认凭证有 Zhe-Zhe 的 Contents 读写权限，或稍后重试。',404:'未找到内容，或发布凭证未授权 Zhe-Zhe 仓库。',409:'网站刚有新的修改，请重试发布。',422:'网站刚有新的修改或数据未通过校验，请重试；草稿已保留。'};
    throw new APIError(messages[response.status] || `暂时无法完成（${response.status}），请稍后重试。`, response.status);
  }
  return response.json();
}
export function decodeData(file) {
  if (file.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('笔记数据格式不正确，未覆盖原内容。');
  const bytes = Uint8Array.from(atob(file.content.replace(/\s/g,'')), x => x.charCodeAt(0));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (data.version !== 1 || !Array.isArray(data.notes)) throw new Error('笔记数据格式不正确，未覆盖原内容。');
  return data;
}
export async function verifyConnection(token, fetcher = fetch) {
  const user = await api('/user', {token,fetcher});
  if (user.login?.toLowerCase() !== OWNER.toLowerCase()) throw new Error(`请使用 ${OWNER} 的发布凭证。`);
  const repo = await api('', {token,fetcher});
  if (!repo.permissions?.push) throw new Error('这个账号没有网站发布权限。');
  return user.login;
}
export async function readNotes({token = '', ref = 'main', fetcher = fetch} = {}) {
  const file = await api(`/contents/notes-data.json?ref=${encodeURIComponent(ref)}`, {token,fetcher});
  return decodeData(file);
}
export function imageURL(photo, commit = 'main') {
  if (!/^notes-images\/[a-zA-Z0-9-]+\/[0-9]+\.jpg$/.test(photo.path)) return '';
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${commit}/${photo.path}`;
}
// A single non-forced ref update publishes the metadata and all images together.
// Retries use the draft ID to prevent duplicate notes after an uncertain network result.
export async function publishNote({token, draft, onProgress = () => {}, fetcher = fetch}) {
  if (!token) throw new Error('请先连接发布账号。');
  if (!draft.id || !/^[a-zA-Z0-9-]+$/.test(draft.id)) throw new Error('草稿编号无效。');
  if (!draft.title.trim() && !draft.body.trim() && !draft.photos.length) throw new Error('先选照片，或写下这一刻的想法。');
  if (draft.photos.length > 9) throw new Error('每篇最多 9 张照片。');
  onProgress('正在准备发布……');
  const head = await api('/git/ref/heads/main', {token,fetcher});
  const sha = head.object.sha;
  const data = await readNotes({token,ref:sha,fetcher});
  const existing = data.notes.find(note => note.id === draft.id);
  if (existing) return {note:existing, commit:sha};
  const commit = await api(`/git/commits/${sha}`, {token,fetcher});
  const tree = [], photos = [];
  for (let i = 0; i < draft.photos.length; i++) {
    onProgress(`正在上传照片 ${i+1} / ${draft.photos.length}……`);
    const photo = draft.photos[i];
    const bytes = new Uint8Array(await photo.blob.arrayBuffer());
    let binary = '';
    for (let j = 0; j < bytes.length; j += 8192) binary += String.fromCharCode(...bytes.subarray(j,j+8192));
    const blob = await api('/git/blobs', {token,method:'POST',body:{content:btoa(binary),encoding:'base64'},fetcher});
    const path = `notes-images/${draft.id}/${i+1}.jpg`;
    tree.push({path,mode:'100644',type:'blob',sha:blob.sha});
    photos.push({path,width:photo.width,height:photo.height});
  }
  const note = {id:draft.id,title:draft.title.trim().slice(0,120),body:draft.body.trim().slice(0,5000),photos,createdAt:new Date().toISOString()};
  data.notes.unshift(note);
  tree.push({path:'notes-data.json',mode:'100644',type:'blob',content:JSON.stringify(data,null,2)+'\n'});
  onProgress('正在保存笔记……');
  const newTree = await api('/git/trees', {token,method:'POST',body:{base_tree:commit.tree.sha,tree},fetcher});
  const next = await api('/git/commits', {token,method:'POST',body:{message:`Publish note: ${note.title || '图文日常'}`,tree:newTree.sha,parents:[sha]},fetcher});
  try {
    await api('/git/refs/heads/main', {token,method:'PATCH',body:{sha:next.sha,force:false},fetcher});
  } catch (error) {
    // A dropped response can happen after GitHub has accepted the write.
    try {
      const confirmed = await readNotes({token,fetcher});
      if (confirmed.notes.some(item => item.id === draft.id)) return {note:confirmed.notes.find(item=>item.id===draft.id),commit:next.sha};
    } catch { /* Preserve the original error and draft. */ }
    throw error;
  }
  return {note,commit:next.sha};
}
