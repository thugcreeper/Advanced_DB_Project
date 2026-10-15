const configured = document.querySelector('meta[name="api-base"]')?.content;
const base = configured || window.location.origin;

export async function statisticsRequest(path, { body, signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
  try {
    const response = await fetch(new URL(path, base), { method: body === undefined ? "GET" : "POST", signal: controller.signal,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "統計查詢失敗。");
    return data;
  } catch (error) {
    if (timedOut) throw new Error("查詢逾時，請稍後重試。");
    if (error.name === "AbortError") throw error;
    if (error instanceof TypeError) throw new Error("無法連線到統計後端，請確認服務已啟動。");
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
