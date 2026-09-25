/** A brief, non-blocking message ("✓ Solved!") that fades out on its own. */

let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(host: HTMLElement, message: string, durationMs = 1800): HTMLElement {
  let toast = host.querySelector<HTMLElement>(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    host.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("toast-visible");
  clearTimeout(timer);
  timer = setTimeout(() => toast!.classList.remove("toast-visible"), durationMs);
  return toast;
}
