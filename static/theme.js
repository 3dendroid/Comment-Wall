// Loaded in <head> without defer: sets the theme before anything is drawn, so a dark theme doesn't flash light.
// A saved choice wins; without one, follow the device's light/dark setting.
(function () {
  var saved = null;
  try {
    saved = localStorage.getItem('theme');
  } catch (e) {}
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
})();
