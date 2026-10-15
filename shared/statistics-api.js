import { apiRequest } from './api-connection.js';
export function statisticsRequest(path, { body, signal } = {}) {
  // This endpoint is a read-only search despite its POST transport.
  return apiRequest(path, { body, signal, method: body === undefined ? 'GET' : 'POST',
    safeRead: body === undefined || path === '/api/districts/statistics/search' });
}
