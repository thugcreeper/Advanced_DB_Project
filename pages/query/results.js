export function initializeResults({ body, count, empty, download, sortButtons, onSort }) {
  let rows = []; let sortKey = null; let ascending = true;
  const formatter = new Intl.NumberFormat("zh-TW");
  const name = (d) => d.county + d.name;
  function render() {
    body.replaceChildren();
    rows.forEach((d, index) => {
      const tr = document.createElement("tr");
      [index + 1, name(d), formatter.format(d.averageIncome), d.hospitalCount, d.clinicCount].forEach((value) => {
        const td = document.createElement("td"); td.textContent = value; tr.append(td);
      });
      body.append(tr);
    });
    count.textContent = rows.length; empty.hidden = rows.length !== 0; download.disabled = rows.length === 0;
  }
  function sort() {
    if (!sortKey) return;
    rows.sort((a, b) => (sortKey === "name" ? name(a).localeCompare(name(b), "zh-TW") : a[sortKey] - b[sortKey]) * (ascending ? 1 : -1));
  }
  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      ascending = sortKey === button.dataset.sort ? !ascending : true; sortKey = button.dataset.sort;
      sortButtons.forEach((b) => b.parentElement.setAttribute("aria-sort", b === button ? (ascending ? "ascending" : "descending") : "none"));
      sort(); render(); onSort(rows);
    });
  });
  download.addEventListener("click", () => {
    if (!rows.length) return;
    const escape = (value) => '"' + String(value).replaceAll('"', '""') + '"';
    const lines = [["地區", "平均所得（千元）", "醫院家數", "診所家數"], ...rows.map((d) => [name(d), d.averageIncome, d.hospitalCount, d.clinicCount])];
    const blob = new Blob(["\uFEFF", lines.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "行政區示範查詢結果.csv";
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return { update(nextRows) { rows = [...nextRows]; sort(); render(); return rows; } };
}
