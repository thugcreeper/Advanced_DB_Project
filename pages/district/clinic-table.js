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
// Group whole intervals by opening time; never split a continuous interval.
const sessions = [{ key: 'morning', label: '早診' }, { key: 'afternoon', label: '午診' }, { key: 'evening', label: '晚診' }];
const sessionKey = slot => Number(slot.open.slice(0, 2)) < 12 ? 'morning' : Number(slot.open.slice(0, 2)) < 18 ? 'afternoon' : 'evening';
export function buildClinicSessions(days) {
  return sessions.map(session => {
    const byDay = days.map(day => day.slots.filter(slot => sessionKey(slot) === session.key));
    const counts = new Map(); let common = null, most = 0;
    byDay.flat().forEach(slot => {
      const key = `${slot.open}–${slot.close}`, count = (counts.get(key) || 0) + 1;
      counts.set(key, count); if (count > most) { most = count; common = slot; }
    });
    return { ...session, byDay, common };
  });
}
export function createClinicTable(schedule) {
  const days = normalizeClinicWeek(schedule), rows = buildClinicSessions(days);
  const section = node('section', 'detail-section clinic-week clinic-week-table');
  section.append(node('h3', '', '診療時間'));
  const wrap = node('div', 'clinic-table-scroll'); wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '每週門診時間表，可左右捲動');
  const table = node('table', 'clinic-table'), caption = node('caption', 'sr-only', '每週門診時間，依原始資料的實際時間區間排列');
  const head = node('thead'), heading = node('tr'), corner = node('th', '', '門診表'); corner.scope = 'col'; heading.append(corner);
  days.forEach(day => { const th = node('th', '', `週${day.label}`); th.scope = 'col'; th.dataset.weekday = day.key; heading.append(th); });
  head.append(heading); const body = node('tbody');
  rows.forEach((session, index) => {
    const row = node('tr'), label = node('th', 'clinic-slot-label'); label.scope = 'row'; row.dataset.session = session.key;
    label.append(node('span', 'clinic-session-name', session.label));
    if (session.common) {
      const time = node('span', 'clinic-common-time');
      time.append(node('span', '', session.common.open), node('span', '', session.common.close)); label.append(time);
    } else label.append(node('span', 'clinic-common-time', '—'));
    row.append(label);
    days.forEach((day, dayIndex) => {
      if (day.status !== 'scheduled' && index > 0) return;
      const cell = node('td'); cell.dataset.weekday = day.key;
      if (day.status !== 'scheduled') {
        cell.rowSpan = rows.length;
        cell.append(node('span', `clinic-cell-state is-${day.status}`, day.status === 'closed' ? '—' : day.status === 'invalid' ? '格式異常' : '未提供資料'));
        if (day.status === 'closed') cell.append(node('span', 'clinic-closed-label', '休診'));
      } else if (session.byDay[dayIndex].length) {
        session.byDay[dayIndex].forEach(slot => {
          const item = node('div', 'clinic-session'), dot = node('span', 'clinic-session-dot'); dot.setAttribute('aria-hidden', 'true');
          const different = slot.open !== session.common.open || slot.close !== session.common.close;
          item.append(dot, node('span', `clinic-interval ${different ? 'is-exception' : 'sr-only'}`, `${slot.open}–${slot.close}`));
          if (slot.close < slot.open && slot.close !== '24:00') item.append(node('span', 'clinic-overnight', '跨日至次日'));
          cell.append(item);
        });
      } else { cell.textContent = '—'; cell.setAttribute('aria-label', `星期${day.label}無${session.label}紀錄`); }
      row.append(cell);
    });
    body.append(row);
  });
  table.append(caption, head, body); wrap.append(table); section.append(wrap);
  if (schedule?.status === 'invalid') section.append(node('p', 'detail-warning', '診療時間資料格式異常，請向院所確認。'));
  else if (schedule?.status === 'partial' || days.some(day => day.invalid)) section.append(node('p', 'detail-warning', '部分診療時間資料格式異常，已保留可辨識的時段。'));
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
