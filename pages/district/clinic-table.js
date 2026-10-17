const weekdays = [['monday','一'],['tuesday','二'],['wednesday','三'],['thursday','四'],['friday','五'],['saturday','六'],['sunday','日']];
function node(tag, className, text) {
  const result = document.createElement(tag); if (className) result.className = className;
  if (text !== undefined) result.textContent = text; return result;
}
const validTime = (value, closing = false) => typeof value === 'string' && (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) || closing && value === '24:00');
// The API already parses clinicTimeJson, including legacy open/close. Preserve its intervals verbatim.
export function normalizeClinicWeek(schedule) {
  return weekdays.map(([key, label]) => {
    const day = Array.isArray(schedule?.days) ? schedule.days.find(value => value?.day === key) : null;
    if (day?.status === 'closed') return { key, label, status: 'closed', slots: [] };
    const source = Array.isArray(day?.slots) ? day.slots : [];
    const slots = source.filter(slot => validTime(slot?.open) && validTime(slot?.close, true)).map(slot => ({ open: slot.open, close: slot.close }));
    const invalid = day?.status === 'invalid' || day?.status === 'scheduled' && (!slots.length || slots.length !== source.length);
    return { key, label, status: slots.length ? 'scheduled' : invalid ? 'invalid' : 'missing', slots, invalid };
  });
}
export function taipeiWeekday(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', weekday: 'long' }).format(date).toLowerCase();
}
function nextMidnight(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1) - 8 * 3600000 - date.getTime() + 20;
}
export function createClinicTable(schedule) {
  const days = normalizeClinicWeek(schedule), rows = Math.max(1, ...days.map(day => day.slots.length));
  const section = node('section', 'detail-section clinic-week clinic-week-table');
  section.append(node('h3', '', '診療時間'));
  const wrap = node('div', 'clinic-table-scroll'); wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '每週門診時間表，可左右捲動');
  const table = node('table', 'clinic-table'), caption = node('caption', 'sr-only', '每週門診時間，依原始資料的實際時間區間排列');
  const head = node('thead'), heading = node('tr'), corner = node('th', '', '門診表'); corner.scope = 'col'; heading.append(corner);
  days.forEach(day => { const th = node('th', '', `週${day.label}`); th.scope = 'col'; th.dataset.weekday = day.key; heading.append(th); });
  head.append(heading); const body = node('tbody');
  for (let index = 0; index < rows; index++) {
    const row = node('tr'), label = node('th', 'clinic-slot-label', `第 ${index + 1} 時段`); label.scope = 'row'; row.append(label);
    days.forEach(day => {
      if (day.status !== 'scheduled' && index > 0) return;
      const cell = node('td'); cell.dataset.weekday = day.key;
      if (day.status !== 'scheduled') {
        cell.rowSpan = rows;
        cell.append(node('span', `clinic-cell-state is-${day.status}`, day.status === 'closed' ? '—' : day.status === 'invalid' ? '格式異常' : '未提供資料'));
        if (day.status === 'closed') cell.append(node('span', 'clinic-closed-label', '休診'));
      } else if (day.slots[index]) {
        const slot = day.slots[index], dot = node('span', 'clinic-session-dot'); dot.setAttribute('aria-hidden', 'true');
        cell.append(dot, node('span', 'clinic-interval', `${slot.open}–${slot.close}`));
        if (slot.close < slot.open && slot.close !== '24:00') cell.append(node('span', 'clinic-overnight', '跨日至次日'));
      } else { cell.textContent = '—'; cell.setAttribute('aria-label', `星期${day.label}沒有第 ${index + 1} 時段紀錄`); }
      row.append(cell);
    });
    body.append(row);
  }
  table.append(caption, head, body); wrap.append(table); section.append(wrap);
  if (schedule?.status === 'invalid') section.append(node('p', 'detail-warning', '診療時間資料格式異常，請向院所確認。'));
  else if (schedule?.status === 'partial' || days.some(day => day.invalid)) section.append(node('p', 'detail-warning', '部分診療時間資料格式異常，已保留可辨識的時段。'));
  section.append(node('p', 'clinic-table-legend', '● 有診療時段　— 無該時段紀錄；明確休診另有標示。淡黃色為臺灣時間的今天。'), node('p', 'detail-footnote', '時段依原始資料列出，不代表早、午、晚診分類；實際診療時間請先致電院所確認。'));
  let timer;
  function refresh() {
    const today = taipeiWeekday();
    table.querySelectorAll('[data-weekday]').forEach(cell => {
      const current = cell.dataset.weekday === today; cell.classList.toggle('is-today', current);
      if (cell.tagName === 'TH') { cell.toggleAttribute('data-today', current); if (current) cell.setAttribute('aria-current', 'date'); else cell.removeAttribute('aria-current'); }
    });
    clearTimeout(timer); timer = setTimeout(refresh, Math.max(20, nextMidnight(new Date())));
  }
  refresh(); document.addEventListener('visibilitychange', refresh);
  return { element: section, destroy() { clearTimeout(timer); document.removeEventListener('visibilitychange', refresh); } };
}
