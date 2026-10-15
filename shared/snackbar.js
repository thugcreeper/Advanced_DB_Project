let notice, timer;
/** Viewport-fixed feedback. Persistent descriptions/actions remain in the page. */
export function showSnackbar(message, { error = false } = {}) {
  if (!notice) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = new URL('./snackbar.css', import.meta.url);
    document.head.append(link);
    notice = document.createElement('div');
    notice.className = 'snackbar'; notice.hidden = true;
    notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); notice.setAttribute('aria-atomic', 'true');
    document.body.append(notice);
  }
  clearTimeout(timer);
  notice.textContent = message; notice.dataset.kind = error ? 'error' : 'info'; notice.hidden = false;
  timer = setTimeout(() => { notice.hidden = true; }, 3000);
}
window.addEventListener('pagehide', () => { clearTimeout(timer); if (notice) notice.hidden = true; });
