import { groupApiValues } from "./medical-categories.js";

export function initializeHierarchicalSelector({ root, input, label, groups, multiple = false }) {
  const trigger = root.querySelector(".selector-trigger"), valueLabel = root.querySelector(".selector-value");
  const clearButton = root.querySelector(".selector-clear"), popup = root.querySelector(".selector-popup");
  const search = popup.querySelector("input[type=search]"), list = popup.querySelector(".selector-groups");
  const message = popup.querySelector(".selector-empty"), notice = root.querySelector(".selector-notice");
  let entries = [], opened = false, savedExpansion = null;
  const visibleOptions = () => [...popup.querySelectorAll(".selector-option")].filter(button => !button.hidden && (!button.closest("details") || button.closest("details").open));
  const values=()=>multiple?JSON.parse(input.value||'[]'):(input.value?[input.value]:[]);
  const chips=multiple?document.createElement('div'):null;
  if(chips){chips.className='selector-chips';root.querySelector('.selector-control').after(chips);}
  function sync() {
    const chosen=values();valueLabel.textContent = multiple?(chosen.length?`已選 ${chosen.length} 科`:'不限'):input.value||'不限'; clearButton.disabled = !chosen.length;
    if(chips)chips.replaceChildren(...chosen.map(name=>{const chip=document.createElement('button');chip.type='button';chip.className='selector-chip';chip.textContent=name+' ×';chip.setAttribute('aria-label','移除'+name);chip.addEventListener('click',()=>{choose(name);if(!opened)trigger.focus();});return chip;}));
    popup.querySelectorAll(".selector-option").forEach(button => {
      const selected = chosen.includes(button.dataset.value);
      button.setAttribute(button.getAttribute("role") === "option" ? "aria-selected" : "aria-pressed", String(selected)); button.classList.toggle("is-selected", selected);
    });
  }
  function choose(value) {
    const previous=input.value;
    if(multiple){const chosen=values();const next=value===''?[]:chosen.includes(value)?chosen.filter(v=>v!==value):[...chosen,value];input.value=next.length?JSON.stringify(next):'';}
    else input.value=value;
    sync();if(!multiple||value==='')close();
    if(previous!==input.value){input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  function position() {
    if (!opened) return;
    const rect = trigger.getBoundingClientRect(), height = window.visualViewport?.height || window.innerHeight;
    const width = Math.min(380, window.innerWidth - 24), below = height - rect.bottom - 18, above = rect.top - 18;
    const useBelow = below >= 240 || below >= above;
    popup.style.width = `${width}px`;
    popup.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    popup.style.maxHeight = `${Math.max(120, Math.min(480, useBelow ? below : above))}px`;
    popup.style.top = useBelow ? `${rect.bottom + 6}px` : "auto";
    popup.style.bottom = useBelow ? "auto" : `${Math.max(12, window.innerHeight - rect.top + 6)}px`;
  }
  function open() {
    if (trigger.disabled) return;
    opened = true; popup.hidden = false; popup.showPopover?.(); trigger.setAttribute("aria-expanded", "true"); position(); search.focus();
  }
  function close(restoreFocus = true) {
    if (!opened) return;
    opened = false; if (popup.hidePopover && popup.matches(":popover-open")) popup.hidePopover(); popup.hidden = true; trigger.setAttribute("aria-expanded", "false");
    search.value = ""; filter();
    if (restoreFocus) trigger.focus();
  }
  function filter() {
    const query = search.value.trim().toLocaleLowerCase();
    if (query && !savedExpansion) savedExpansion = entries.map(entry => entry.details.open);
    let count = 0;
    entries.forEach((entry, index) => {
      let matches = 0;
      entry.buttons.forEach(button => { button.hidden = !button.dataset.value.toLocaleLowerCase().includes(query); if (!button.hidden) matches++; });
      entry.details.hidden = query !== "" && matches === 0;
      if (query) entry.details.open = matches > 0;
      else if (savedExpansion) entry.details.open = savedExpansion[index];
      count += matches;
    });
    if (!query) savedExpansion = null;
    message.hidden = count !== 0;
  }
  popup.querySelector(".selector-close").addEventListener("click", () => close());
  popup.querySelector(".selector-unlimited").addEventListener("click", () => choose(""));
  clearButton.addEventListener("click", () => choose(""));
  trigger.addEventListener("click", () => opened ? close() : open());
  trigger.addEventListener("keydown", event => { if (event.key === "ArrowDown") { event.preventDefault(); open(); } });
  search.addEventListener("input", filter);
  popup.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    const options = visibleOptions(), index = options.indexOf(document.activeElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && (index !== -1 || document.activeElement === search)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : event.key === "ArrowDown" ? (index + 1) % options.length : index < 0 ? options.length - 1 : (index - 1 + options.length) % options.length;
      options[next]?.focus();
    } else if (event.key === "Enter" && document.activeElement === search) { event.preventDefault(); options.find(button => button.dataset.value)?.click(); }
  });
  document.addEventListener("pointerdown", event => { if (opened && !root.contains(event.target)) close(false); });
  document.addEventListener("focusin", event => { if (opened && !root.contains(event.target)) close(false); });
  window.addEventListener("resize", position); window.addEventListener("scroll", position, true);
  return {
    values,
    setOptions(values) {
      const data = groupApiValues(values, groups); list.replaceChildren(); entries = []; savedExpansion = null;
      data.groups.forEach((group, index) => {
        const details = document.createElement("details"), summary = document.createElement("summary"), items = document.createElement("div");
        details.className = "selector-category"; details.open = index === 0;
        const title = document.createElement("span"), count = document.createElement("span"); title.textContent = group.label; count.textContent = group.values.length; count.className = "category-count";
        summary.style.listStyle = "none"; summary.style.display = "flex";
        const state = document.createElement("span"); state.className = "group-state"; state.setAttribute("aria-hidden", "true");
        const expand = document.createElement("span"), collapse = document.createElement("span");
        expand.className = "when-closed"; expand.textContent = "展開"; collapse.className = "when-open"; collapse.textContent = "收合";
        state.append(expand, collapse); summary.append(title, count, state); items.setAttribute("role", "listbox"); items.setAttribute("aria-label", `${label}・${group.label}`);if(multiple)items.setAttribute("aria-multiselectable","true");
        const buttons = group.values.map(value => {
          const button = document.createElement("button"); button.type = "button"; button.className = "selector-option"; button.dataset.value = value;
          button.textContent = value; button.setAttribute("aria-label", value); button.setAttribute("role", "option"); button.addEventListener("click", () => choose(value)); items.append(button); return button;
        });
        details.append(summary, items); list.append(details); entries.push({ details, buttons });
      });
      notice.hidden = !data.unknown.length && !data.missing.length && !data.duplicates;
      notice.textContent = [data.unknown.length ? `新增選項：${data.unknown.join("、")}` : "", data.missing.length ? `API 未提供：${data.missing.join("、")}` : "", data.duplicates ? `重複選項 ${data.duplicates} 筆已合併` : ""].filter(Boolean).join("；");
      if (!notice.hidden) console.warn(`${label}選項差異`, data);
      trigger.disabled = false; search.value = ""; filter(); sync(); return data;
    },
    reset() { close(false); input.value = ""; search.value = ""; savedExpansion = null; entries.forEach((entry, index) => { entry.details.open = index === 0; }); filter(); sync(); },
    close() { close(false); },
  };
}
