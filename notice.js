// sessionStorage keeps dismissal within this tab, including page reloads.
const notice = document.getElementById('education-notice');
const dismiss = document.getElementById('dismiss-education-notice');
const storageKey = 'ocean-bank:education-notice-dismissed';

try {
  notice.hidden = sessionStorage.getItem(storageKey) === 'true';
} catch {
  // When browser storage is blocked, keep the notice visible by default.
}

dismiss.addEventListener('click', () => {
  notice.hidden = true;
  try {
    sessionStorage.setItem(storageKey, 'true');
  } catch {
    // The close button still works; dismissal lasts until the next reload.
  }
  document.querySelector('.brand').focus({ preventScroll: true });
});
