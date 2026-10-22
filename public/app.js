const form = document.getElementById("idea-form");
const submitButton = document.getElementById("submit");
const formStatus = document.getElementById("form-status");

const FIELDS = ["idea", "workingTitle", "channelUrl", "lengthMinutes", "costUsd", "productionDays", "newsTied"];

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
  const data = Object.fromEntries(new FormData(form));

  submitButton.disabled = true;
  formStatus.textContent = "Saving and building your report… this can take up to a minute.";
  try {
    const response = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok) {
      showErrors(body.errors || {});
      formStatus.textContent = body.error || "Please fix the highlighted fields.";
      return;
    }
    window.location.href = `/report.html?id=${encodeURIComponent(body.id)}`;
  } catch {
    formStatus.textContent = "Could not save. Check your connection and try again.";
  } finally {
    submitButton.disabled = false;
  }
});
