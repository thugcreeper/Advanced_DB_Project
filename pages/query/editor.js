import { examples } from "./examples.js";
export function initializeEditor({ input, clearButton, form, status, exampleSelect, onExecute }) {
  examples.forEach((example) => {
    const option = document.createElement("option");
    option.value = example.id; option.textContent = example.label; exampleSelect.append(option);
  });
  exampleSelect.value = examples[0].id;
  const selected = () => examples.find((example) => example.id === exampleSelect.value);
  const loadExample = () => { input.value = selected().query; status.textContent = ""; };
  loadExample();
  exampleSelect.addEventListener("change", loadExample);
  function execute() {
    if (!input.value.trim()) { status.textContent = "請先選擇範例查詢。"; input.focus(); return; }
    const example = selected();
    if (input.value !== example.query) {
      status.textContent = "目前為 UI 展示模式，尚未支援自訂 Cypher 執行"; return;
    }
    onExecute(example);
    status.textContent = "已顯示示範資料，未執行真正的 Cypher 查詢。";
  }
  form.addEventListener("submit", (event) => { event.preventDefault(); execute(); });
  input.addEventListener("input", () => { status.textContent = ""; });
  clearButton.addEventListener("click", () => {
    input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); input.focus();
  });
  return { execute };
}
