export const DESKTOP_WELCOME_KEY = 'al-welcome-snoozed-at-v1';

// The captured upstream UI treats a recent timestamp as dismissal of its
// desktop-download welcome dialog. Refresh it before the app mounts because
// open-aim is browser-only and does not ship that desktop client.
export function suppressDesktopWelcome(storage, now = Date.now()) {
  try {
    storage.setItem(DESKTOP_WELCOME_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

// The captured upstream client can open its own changelog on first visit. It
// advertises iShoutU services and also covers the open-aim controls, so close
// that one upstream-only dialog whenever Vue recreates it.
export function suppressOriginalUi(documentRef = document) {
  const close = () => {
    const button = documentRef.querySelector('[data-action="changelog-close"],[data-action="changelog-confirm"]');
    if (button) button.click();
  };
  close();
  const observer = window.AimDom.watch(documentRef.body, '[data-action="changelog-close"],[data-action="changelog-confirm"]', close);
  return observer;
}

// Keep local controls hidden during bootstrap, then mount them into the same
// top navigation that owns Training history and Settings. The retained node is
// reattached if Vue recreates the header during a route change.
export function mountLocalControls(documentRef = document) {
  const controls = documentRef.querySelector('.aim-local-actions');
  if (!controls) return null;
  const mount = () => {
    const navigation = documentRef.querySelector('.hall-topnav,.am-bar');
    if (!navigation) return;
    if (controls.parentElement !== navigation) navigation.append(controls);
    if (!controls.classList.contains('is-mounted')) controls.classList.add('is-mounted');
  };
  mount();
  const observer = window.AimDom.watch(documentRef.querySelector('#app') ?? documentRef.body, '.hall-topnav,.am-bar', mount);
  return observer;
}
