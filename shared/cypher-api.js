const configured = document.querySelector('meta[name="api-base"]')?.content;
const base = configured || window.location.origin;
export async function queryCypher(query, { parameters = {}, signal } = {}) {
  let response;
  try {
    response = await fetch(new URL('/api/cypher/query', base), {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, parameters }),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('無法連線到後端，請確認服務已啟動。');
  }
  let body;
  try { body = await response.json(); } catch { throw new Error('查詢服務回應格式錯誤。'); }
  if (!response.ok) throw new Error(body.message || '查詢失敗，請稍後重試。');
  if (!Array.isArray(body.columns) || !Array.isArray(body.rows)) throw new Error('查詢服務回應格式錯誤。');
  return body;
}
