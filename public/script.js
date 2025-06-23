document.addEventListener("DOMContentLoaded", () => {
  /* ---- LIKE (AJAX) ----------------------------------------- */
  document.querySelectorAll(".like-form").forEach(form => {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const id = form.dataset.id;

      const res = await fetch(`/like/${id}`, {
        method: "POST",
        credentials: "same-origin"   // keep session cookie
      });

      if (res.ok) {
        const { likes } = await res.json();
        form.querySelector("button").innerHTML = `❤️ ${likes}`;
      }
    });
  });

  /* ---- EDIT (no jump) -------------------------------------- */
  document.querySelectorAll(".edit-form").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      // save scroll position, then navigate
      localStorage.setItem("scrollPos", window.scrollY);
      window.location.href = form.action;
    });
  });

  /* ---- Restore scroll -------------------------------------- */
  const pos = localStorage.getItem("scrollPos");
  if (pos) {
    window.scrollTo(0, +pos);
    localStorage.removeItem("scrollPos");
  }
});

