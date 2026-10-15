const configured = document.querySelector('meta[name="api-base"]')?.content;
const base = configured || window.location.origin;

export async function request(path, { signal } = {}) {
  let response;
  try {
    response = await fetch(new URL(path, base), { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("無法連線到後端，請確認後端服務已啟動。", { cause: error });
  }
  let body;
  try { body = await response.json(); }
  catch { throw new Error("API 回應格式錯誤，請確認後端版本及連線設定。"); }
  if (!response.ok) throw new Error(body.message || "API 請求失敗，請稍後重試。");
  return body;
}
