const form = document.getElementById("idea-form");
const submitButton = document.getElementById("submit");
const formStatus = document.getElementById("form-status");

const FIELDS = ["idea", "workingTitle", "channelUrl", "lengthMinutes", "costUsd", "productionDays", "newsTied", "email"];

function showErrors(errors) {
  for (const field of FIELDS) {
    const message = errors[field] || "";
    document.getElementById(`${field}-error`).textContent = message;
    const input = form.elements[field];
    if (input && input.setAttribute) input.setAttribute("aria-invalid", message ? "true" : "false");
  }
  const first = FIELDS.find((f) => errors[f]);
  if (first) {
    const input = form.elements[first];
    (input.focus ? input : input[0]).focus();
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  // The page's language decides the YouTube search language and the emails.
  const data = { ...Object.fromEntries(new FormData(form)), language: I18N.lang };

  submitButton.disabled = true;
  submitButton.classList.add("loading");
  formStatus.textContent = I18N.t("common.saving");
  try {
    const response = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok) {
      showErrors(body.errors || {});
      formStatus.textContent = body.error || I18N.t("common.fix_fields");
      return;
    }
    // The report page shows progress while the report is built.
    window.location.href = `/report.html?id=${encodeURIComponent(body.id)}`;
  } catch {
    formStatus.textContent = I18N.t("common.no_connection");
  } finally {
    submitButton.disabled = false;
    submitButton.classList.remove("loading");
  }
});
