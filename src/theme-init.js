// Apply a saved theme before first paint. Without one, the system setting applies.
try {
  var saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
} catch (e) {}
