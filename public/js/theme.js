/* Aplica o tema antes da primeira pintura para evitar piscadas. */
(function () {
  "use strict";

  var THEME_KEY = "bolso.theme";
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function getPreference() {
    try {
      var value = localStorage.getItem(THEME_KEY);
      return value === "light" || value === "dark" ? value : "system";
    } catch (error) {
      return "system";
    }
  }

  function resolve(preference) {
    if (preference === "light" || preference === "dark") {
      return preference;
    }
    return media && media.matches ? "dark" : "light";
  }

  function apply() {
    var preference = getPreference();
    var theme = resolve(preference);
    var root = document.documentElement;
    var meta = document.getElementById("themeColorMeta");

    root.setAttribute("data-theme", theme);
    root.setAttribute("data-theme-preference", preference);
    root.style.colorScheme = theme;

    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#0c1410" : "#f4f1ea");
    }
  }

  apply();

  if (media) {
    var handleChange = function () {
      if (getPreference() === "system") {
        apply();
        window.dispatchEvent(new CustomEvent("bolso:themechange", { detail: { source: "system" } }));
      }
    };

    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else if (media.addListener) {
      media.addListener(handleChange);
    }
  }

  window.addEventListener("storage", function (event) {
    if (event.key === THEME_KEY) {
      apply();
      window.dispatchEvent(new CustomEvent("bolso:themechange", { detail: { source: "storage" } }));
    }
  });

  window.BolsoTheme = {
    key: THEME_KEY,
    getPreference: getPreference,
    resolve: resolve,
    apply: apply,
  };
})();
