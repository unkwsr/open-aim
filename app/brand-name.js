// Lobby branding and window title.
(() => {
  if (window.__aimBrandName) return;
  window.__aimBrandName = true;
  const NAME = "openVaim";

  function fix() {
    if (/open-aim/i.test(document.title)) document.title = document.title.replace(/open-aim/gi, NAME);
    const brand = document.querySelector(".hall-topnav .hall-brand");
    if (!brand || brand.querySelector(".hall-brand-logo")) return;

    const logo = new Image();
    logo.className = "hall-brand-logo";
    logo.alt = "openVaim";
    logo.onload = () => {
      if (!brand.querySelector(".hall-brand-logo")) brand.append(logo);
    };
    logo.src = "/local/openvaim-logo.png"; // openVaim wordmark (14 Nov 2026); old: open-aim-trainer-logo.png
  }

  fix();
  const title = document.querySelector("head > title");
  if (title) new MutationObserver(fix).observe(title, { childList: true, characterData: true, subtree: true });
  setInterval(fix, 1000);
})();
