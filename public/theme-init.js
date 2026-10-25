(function () {
  var scheme = "light";
  try {
    scheme = window.localStorage.getItem("server-pages-standalone:theme:v1") === "dark" ? "dark" : "light";
  } catch (error) {}
  document.documentElement.setAttribute("data-color-scheme", scheme);
})();
