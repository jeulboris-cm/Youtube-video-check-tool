const form = document.getElementById("find-form");
const button = document.getElementById("find-submit");
const status = document.getElementById("find-status");
const emailError = document.getElementById("email-error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  emailError.textContent = "";
  status.textContent = "Sending…";
  try {
    const response = await fetch("/api/find-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.elements.email.value }),
    });
    const body = await response.json();
    if (!response.ok) {
      emailError.textContent = body.errors?.email || "";
      status.textContent = body.error || "";
      if (body.errors?.email) form.elements.email.focus();
      return;
    }
    status.textContent = body.message;
  } catch {
    status.textContent = "Could not send. Check your connection and try again.";
  } finally {
    button.disabled = false;
  }
});
