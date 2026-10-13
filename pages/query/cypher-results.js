export function csvText(columns, rows) {
  const escape = value => {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [columns, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
}
export function initializeCypherResults({ head, body, count, empty }) {
  let columns = [], rows = [];
  const number = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 6 });
  function update(data = { columns: [], rows: [] }) {
    columns = data.columns; rows = data.rows;
    head.replaceChildren(); body.replaceChildren();
    const header = document.createElement('tr');
    ['#', ...columns].forEach(label => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; header.append(th); });
    head.append(header);
    rows.forEach((row, index) => {
      const tr = document.createElement('tr');
      [index + 1, ...row].forEach(value => {
        const td = document.createElement('td');
        td.textContent = value == null ? '未提供' : typeof value === 'number' ? number.format(value) : typeof value === 'object' ? JSON.stringify(value) : String(value);
        td.title = td.textContent;
        tr.append(td);
      }); body.append(tr);
    });
    count.textContent = rows.length; empty.hidden = rows.length !== 0;
  }
  return { update, download() {
    if (!rows.length) return;
    const url = URL.createObjectURL(new Blob([csvText(columns, rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'Cypher查詢結果.csv';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } };
}
