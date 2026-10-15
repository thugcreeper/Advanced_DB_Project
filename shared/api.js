import { apiRequest } from './api-connection.js';
export const request = (path, { signal } = {}) => apiRequest(path, { signal });
