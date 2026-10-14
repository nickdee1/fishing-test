// Android: Vibration API. iOS Safari (18+): no Vibration API, but toggling an
// <input type="checkbox" switch> via its label fires the system haptic.
function iosTick() {
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  document.head.removeChild(label);
}

type Kind = "tap" | "success" | "error";

const patterns: Record<Kind, number | number[]> = {
  tap: 8,
  success: [15, 60, 25],
  error: [40, 50, 40, 50, 40],
};

export function haptic(kind: Kind = "tap") {
  if (typeof window === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function" && navigator.vibrate(patterns[kind])) return;
    iosTick();
    if (kind === "success") setTimeout(iosTick, 100);
    if (kind === "error") {
      setTimeout(iosTick, 100);
      setTimeout(iosTick, 200);
    }
  } catch {
    // haptics are best-effort
  }
}
