document.addEventListener('pointerlockchange', function () {
  document.documentElement.classList.toggle('is-pointer-locked', Boolean(document.pointerLockElement));
});
