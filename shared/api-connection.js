// One liveness gate per page and API origin. No background keep-alive polling.
const configured = document.querySelector('meta[name="api-base"]')?.content?.trim();
const base = configured || window.location.origin;
const pageController = new AbortController();
let flight, healthyAt = 0, notice;
const abortError = () => new DOMException('已取消', 'AbortError');

function show(state) {
  if (!notice) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = new URL('./api-connection.css', import.meta.url);
    document.head.append(link);
    notice = document.createElement('aside');
    notice.className = 'api-connection'; notice.hidden = true;
    notice.setAttribute('aria-label', '伺服器連線狀態');
    notice.innerHTML = '<span class="api-connection-spinner" aria-hidden="true"></span><div><div role="status" aria-live="polite" aria-atomic="true"><strong></strong><p></p></div><button type="button" hidden>重新連線</button></div>';
    notice.querySelector('button').addEventListener('click', () => flight?.restart?.());
    document.body.append(notice);
  }
  notice.hidden = state === 'ready';
  notice.dataset.state = state;
  notice.querySelector('strong').textContent = state === 'failed' ? '目前無法連接伺服器' : '正在連接伺服器';
  notice.querySelector('p').textContent = state === 'failed'
    ? '目前無法連接伺服器，請稍後再試。'
    : '伺服器可能正在啟動，正在重新連線……首次載入需要稍等片刻，系統將自動重試，無須重新整理頁面。';
  notice.querySelector('button').hidden = state !== 'failed';
}

async function timedFetch(path, options = {}, timeout = 20000) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const signals = [options.signal, pageController.signal].filter(Boolean);
  for (const signal of signals) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', cancel, { once: true });
  }
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
  try {
    const response = await fetch(new URL(path, base), { ...options, signal: controller.signal, cache: 'no-store' });
    // Bound body reading too; a server can send headers and then stall.
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    return { response, body };
  } catch (error) {
    if (signals.some(signal => signal.aborted)) throw abortError();
    if (timedOut) throw new DOMException('查詢逾時', 'TimeoutError');
    throw error;
  } finally {
    clearTimeout(timer);
    for (const signal of signals) signal.removeEventListener('abort', cancel);
  }
}
function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const cancel = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}
function startGate() {
  const controller = new AbortController();
  let resolve, reject, running = false;
  const gate = { controller, users: 0, recovered: false, promise: new Promise((yes, no) => { resolve = yes; reject = no; }) };
  controller.signal.addEventListener('abort', () => reject(abortError()), { once: true });
  gate.restart = async () => {
    if (running || controller.signal.aborted) return;
    running = true;
    if (notice) show('ready');
    const slow = setTimeout(() => show('checking'), 4000);
    const deadline = Date.now() + 90000;
    const delays = [2000, 4000, 8000, 10000];
    let attempt = 0;
    try {
      while (Date.now() < deadline) {
        try {
          const { response, body } = await timedFetch('/api/health', { signal: controller.signal }, Math.min(5000, deadline - Date.now()));
          if (response.ok && body?.status === 'UP') {
            healthyAt = Date.now(); resolve(); return;
          }
          if ([401, 403].includes(response.status)) break;
        } catch (error) { if (error.name === 'AbortError') throw error; }
        gate.recovered = true;
        await pause(Math.min(delays[Math.min(attempt++, delays.length - 1)], Math.max(0, deadline - Date.now())), controller.signal);
      }
      // Automatic retries stop. Pending safe loads resume only on explicit reconnect.
      show('failed');
    } catch (error) { reject(error); }
    finally { clearTimeout(slow); running = false; }
  };
  flight = gate;
  gate.restart();
  return gate;
}
async function ensureReady(signal) {
  if (signal?.aborted || pageController.signal.aborted) throw abortError();
  if (healthyAt && Date.now() - healthyAt < 15000) return false;
  const gate = flight || startGate();
  gate.users++;
  try {
    await new Promise((resolve, reject) => {
      const cancel = () => reject(abortError());
      signal?.addEventListener('abort', cancel, { once: true });
      gate.promise.then(resolve, reject).finally(() => signal?.removeEventListener('abort', cancel));
    });
    return gate.recovered;
  } finally {
    gate.users--;
    if (!gate.users && flight === gate) {
      flight = null; gate.controller.abort(); if (notice) show('ready');
    }
  }
}
window.addEventListener('pagehide', () => {
  pageController.abort(); flight?.controller.abort();
});
// A bfcache restore must create fresh cancellation state.
window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });

export async function apiRequest(path, { method = 'GET', body, signal, safeRead = method === 'GET' } = {}) {
  await ensureReady(signal);
  for (let attempt = 0; ; attempt++) {
    let result;
    try {
      result = await timedFetch(path, {
        method, signal, headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      const timedOut = error.name === 'TimeoutError';
      if (!safeRead || attempt) throw new Error(timedOut ? '查詢逾時，請稍後重試。' : '連線失敗，請稍後重試。');
      healthyAt = 0;
      const recovered = await ensureReady(signal);
      // A slow query on a live server must fail normally, without replaying it.
      if (timedOut && !recovered) throw new Error('查詢逾時，請稍後重試。');
      continue;
    }
    const { response, body: data } = result;
    if (!response.ok) {
      // Structured application errors prove HTTP is up, including AuraDB failures.
      if (data?.code === 'DATABASE_UNAVAILABLE' || data?.code === 'QUERY_FAILED')
        throw new Error('資料服務異常，請稍後再試。');
      if (!data?.code && [502, 503, 504].includes(response.status) && safeRead && !attempt) {
        healthyAt = 0; await ensureReady(signal); continue;
      }
      throw new Error(data?.message || 'API 請求失敗，請稍後重試。');
    }
    if (data === null) throw new Error('API 回應格式錯誤，請確認後端版本及連線設定。');
    return data;
  }
}
