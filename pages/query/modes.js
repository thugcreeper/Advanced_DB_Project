export function initializeModes({ tabs, panes }) {
  function activate(mode) {
    tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panes.forEach((pane) => {
      const active = pane.dataset.pane === mode;
      pane.classList.toggle("is-active", active);
      pane.hidden = !active;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab.dataset.mode));
    tab.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else return;

      event.preventDefault();
      activate(tabs[nextIndex].dataset.mode);
      tabs[nextIndex].focus();
    });
  });

  activate(tabs.find((tab) => tab.getAttribute("aria-selected") === "true").dataset.mode);
}
