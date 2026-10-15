const weekdays = [
  ["monday", "一"], ["tuesday", "二"], ["wednesday", "三"], ["thursday", "四"],
  ["friday", "五"], ["saturday", "六"], ["sunday", "日"],
];
function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

export function createClinicWeek(schedule) {
  const section = node("section", "detail-section clinic-week");
  section.append(node("h3", "", "診療時間"));
  if (!["available", "partial"].includes(schedule?.status) || !schedule.days?.some(day => ["scheduled", "closed"].includes(day.status))) {
    section.append(node("p", "detail-muted", schedule?.status === "invalid" ? "診療時間資料格式異常，請向院所確認。" : "暫無診療時間資料"));
    return section;
  }
  const days = weekdays.map(([key, label]) => ({ ...(schedule.days.find(day => day.day === key) || { day: key, status: "missing", slots: [] }), label }));
  const tabs = node("div", "clinic-week-tabs");
  tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "每週診療時間");
  const summary = day => day.status === "scheduled" ? `${day.slots.length} 段` : day.status === "closed" ? "休診" : "未提供";
  const buttons = days.map(day => {
    const button = node("button", `clinic-day is-${day.status}`);
    button.type = "button"; button.id = `clinic-tab-${day.day}`;
    button.setAttribute("role", "tab"); button.setAttribute("aria-controls", "clinicDayPanel");
    button.setAttribute("aria-label", `星期${day.label}，${summary(day)}`);
    button.append(node("span", "clinic-day-label", `週${day.label}`), node("span", "clinic-day-summary", summary(day)));
    return button;
  });
  const detail = node("div", "clinic-day-panel");
  detail.id = "clinicDayPanel"; detail.setAttribute("role", "tabpanel"); detail.tabIndex = 0;
  function select(index, focus = false) {
    buttons.forEach((button, i) => {
      button.setAttribute("aria-selected", String(i === index)); button.tabIndex = i === index ? 0 : -1;
    });
    const day = days[index];
    detail.setAttribute("aria-labelledby", buttons[index].id);
    const heading = node("div", "clinic-day-heading");
    heading.append(node("h4", "", `星期${day.label}`), node("span", "detail-muted", summary(day)));
    detail.replaceChildren(heading);
    if (day.status === "scheduled") {
      const times = node("ul", "clinic-slots");
      day.slots.forEach(slot => {
        const item = node("li");
        item.append(node("span", "clinic-time", `${slot.open}–${slot.close}`));
        if (slot.close < slot.open && slot.close !== "24:00") item.append(node("span", "clinic-overnight", "跨日至次日"));
        times.append(item);
      });
      detail.append(times);
    } else detail.append(node("p", "detail-muted", day.status === "closed" ? "此日資料標示為休診。" : "此日暫無診療時間資料。"));
    if (focus) buttons[index].focus({ preventScroll: true });
  }
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => select(index));
    button.addEventListener("keydown", event => {
      const target = event.key === "ArrowRight" ? (index + 1) % 7 : event.key === "ArrowLeft" ? (index + 6) % 7
        : event.key === "Home" ? 0 : event.key === "End" ? 6 : null;
      if (target !== null) { event.preventDefault(); select(target, true); }
    });
  });
  tabs.append(...buttons); select(Math.max(0, days.findIndex(day => day.status === "scheduled")));
  section.append(tabs, node("p", "clinic-week-legend", "段數為資料所載的時間區間；休診與未提供資料分別標示。"), detail);
  if (schedule.status === "partial") section.append(node("p", "detail-muted", "部分時段資料無法解析。"));
  section.append(node("p", "detail-footnote", "實際診療時間請先致電院所確認。"));
  return section;
}
