import { apiRequest } from './api-connection.js';
export async function queryCypher(query, { parameters = {}, signal } = {}) {
  // Do not automatically replay user-submitted POSTs.
  const body = await apiRequest('/api/cypher/query', { method: 'POST', body: { query, parameters }, signal, safeRead: false });
  if (!Array.isArray(body.columns) || !Array.isArray(body.rows)) throw new Error('查詢服務回應格式錯誤。');
  return body;
}
