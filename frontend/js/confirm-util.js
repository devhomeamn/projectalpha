// ✅ Universal Modal Utility (Confirm + Alert)
function showConfirm({
  title = "Confirm Action",
  message = "Are you sure?",
  onConfirm = null,
  type = "confirm", // "confirm" or "success"
}) {
  const modal = document.getElementById("confirmModal");
  const titleEl = document.getElementById("confirmTitle");
  const msgEl = document.getElementById("confirmMessage");
  const yesBtn = document.getElementById("confirmYes");
  const cancelBtn = document.getElementById("confirmCancel");

  if (!modal) return console.error("⚠️ Confirm modal not found!");

  titleEl.textContent = title;
  msgEl.textContent = message;

  modal.style.display = "flex";

  // Reset buttons
  yesBtn.style.display = type === "confirm" ? "inline-block" : "none";
  cancelBtn.textContent = type === "confirm" ? "No" : "Close";

  // Remove old event listeners
  const newYes = yesBtn.cloneNode(true);
  yesBtn.parentNode.replaceChild(newYes, yesBtn);

  newYes.addEventListener("click", () => {
    closeConfirm();
    if (typeof onConfirm === "function") onConfirm();
  });
}

function showSuccess(message = "Action completed successfully!") {
  showConfirm({
    title: "✅ Success",
    message,
    type: "success",
  });
}

function closeConfirm() {
  document.getElementById("confirmModal").style.display = "none";
}

window.showConfirm = showConfirm;
window.showSuccess = showSuccess;
window.closeConfirm = closeConfirm;
