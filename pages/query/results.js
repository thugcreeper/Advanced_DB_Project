export function initializeResults({ body, count, empty, download, sortButtons, onSort, columns = [
  { key: "name", label: "地區" }, { key: "averageIncome", label: "平均所得（千元）" },
  { key: "hospitalCount", label: "醫院家數" }, { key: "clinicCount", label: "診所家數" },
] }) {
  let rows = []; let sortKey = null; let ascending = true;
  const formatter = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 6 });
  const value = (d, key) => key === "name" ? d.county + d.name : d[key];
  function render() {
    body.replaceChildren();
    rows.forEach((d, index) => {
      const tr = document.createElement("tr");
      [index + 1, ...columns.map(column => value(d, column.key))].forEach((raw) => {
        const td = document.createElement("td");
        td.textContent = raw == null ? "未提供" : typeof raw === "number" ? formatter.format(raw) : raw;
        tr.append(td);
      }); body.append(tr);
    });
    count.textContent = rows.length; empty.hidden = rows.length !== 0; download.disabled = rows.length === 0;
  }
  function sort() {
    if (!sortKey) return;
    rows.sort((a, b) => {
      const left = value(a, sortKey), right = value(b, sortKey);
      if (left == null) return right == null ? 0 : 1;
      if (right == null) return -1;
      return (typeof left === "number" ? left - right : String(left).localeCompare(String(right), "zh-TW")) * (ascending ? 1 : -1);
    });
  }
  sortButtons.forEach((button) => button.addEventListener("click", () => {
    ascending = sortKey === button.dataset.sort ? !ascending : true; sortKey = button.dataset.sort;
    sortButtons.forEach((b) => b.parentElement.setAttribute("aria-sort", b === button ? (ascending ? "ascending" : "descending") : "none"));
    sort(); render(); onSort(rows);
  }));
  download.addEventListener("click", () => {
    if (!rows.length) return;
    const escape = raw => {
      let text = raw == null ? "" : String(raw);
      if (typeof raw === "string" && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const lines = [columns.map(column => column.label), ...rows.map(d => columns.map(column => value(d, column.key)))];
    const blob = new Blob(["\uFEFF", lines.map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = "行政區統計查詢結果.csv";
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return { update(nextRows, { resetSort = false } = {}) { if (resetSort) sortKey = null; rows = [...nextRows]; sort(); render(); return rows; } };
}
