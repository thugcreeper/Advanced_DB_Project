import { showSnackbar } from '../../shared/snackbar.js';
import { examples } from "./examples.js";
export function initializeEditor({ input, clearButton, form, status, exampleSelect, description, copyButton, onExecute, onChange, onStart, onSuccess, onError }) {
  let controller, revision = 0;
  const submit = form.querySelector('[type="submit"]');
  function cancel() {
    revision++; controller?.abort(); controller = null;
    submit.disabled = false; form.setAttribute('aria-busy', 'false');
    submit.textContent = '執行查詢';
  }
  examples.forEach((example) => {
    const option = document.createElement("option");
    option.value = example.id; option.textContent = example.label; exampleSelect.append(option);
  });
  exampleSelect.value = examples[0].id;
  const selected = () => examples.find((example) => example.id === exampleSelect.value);
  const loadExample = () => {
    cancel(); const example = selected(); input.value = example.query;
    description.replaceChildren();
    [example.description, example.threshold, example.years, '百分位門檻為目前觀察值，資料更新後動態計算結果可能改變。院所家數、人員數與每萬人口比率不直接等同就醫可近性。'].forEach(text => {
      const p = document.createElement('p'); p.textContent = text; description.append(p);
    });
    status.textContent = ''; onChange?.();
  };
  loadExample();
  exampleSelect.addEventListener("change", loadExample);
  async function execute() {
    if (controller) return;
    if (!input.value.trim()) { showSnackbar('請輸入 Cypher 查詢。');status.textContent = '請輸入 Cypher 查詢。'; input.focus(); return; }
    controller = new AbortController(); const current = ++revision;
    submit.disabled = true; submit.textContent = '查詢中…'; form.setAttribute('aria-busy', 'true');
    status.setAttribute('role', 'status'); status.textContent = '查詢中…'; onStart?.();
    try {
      const data = await onExecute(input.value, { signal: controller.signal });
      if (current !== revision) return;
      status.textContent = `查詢完成，共 ${data.rowCount} 筆${data.truncated ? '（已達輸出上限，結果已截斷）' : ''}。`;
      onSuccess?.(data);
    } catch (error) {
      if (current !== revision || error.name === 'AbortError') return;
      status.setAttribute('role', 'alert'); status.textContent = error.message; onError?.(error);
    } finally {
      if (current === revision) cancel();
    }
  }
  form.addEventListener("submit", (event) => { event.preventDefault(); execute(); });
  input.addEventListener("input", () => { cancel(); status.textContent = ''; onChange?.(); });
  copyButton.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(input.value); showSnackbar('已複製查詢。');status.textContent = '已複製查詢。'; }
    catch { showSnackbar('無法自動複製，已選取查詢文字，請使用系統複製。',{error:true});input.focus(); input.select(); status.textContent = '請使用系統複製操作複製已選取的查詢。'; }
  });
  clearButton.addEventListener("click", () => {
    input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); input.focus();
  });
  return { execute, cancel };
}
