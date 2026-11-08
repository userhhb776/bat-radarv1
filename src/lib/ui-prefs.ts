// Preferências visuais salvas no navegador (modelo do Início e sons do painel).
export type DashStyle = "classico" | "radar";
const KD = "br-dash-style", KS = "br-ui-sound";

export function getDashStyle(): DashStyle {
  if (typeof window === "undefined") return "radar";
  return localStorage.getItem(KD) === "classico" ? "classico" : "radar";
}
export function setDashStyle(v: DashStyle) { localStorage.setItem(KD, v); window.dispatchEvent(new Event("br-prefs")); }
export function getSound(): boolean { return typeof window !== "undefined" && localStorage.getItem(KS) === "1"; }
export function setSound(v: boolean) { localStorage.setItem(KS, v ? "1" : "0"); window.dispatchEvent(new Event("br-prefs")); }

let ctx: AudioContext | null = null;
function tone(freq: number, start: number, dur: number, vol = 0.05, type: OscillatorType = "sine", to?: number) {
  if (!ctx) ctx = new AudioContext();
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
export function playTap(force = false) {
  if (!force && !getSound()) return;
  try { tone(1800, 0, 0.06, 0.04, "square"); tone(2600, 0.04, 0.05, 0.025, "sine"); } catch { /* sem áudio */ }
}
export function playBoot(force = false) {
  if (!force && !getSound()) return;
  try { tone(300, 0, 0.35, 0.04, "sawtooth", 1200); tone(1200, 0.32, 0.08, 0.04); tone(1600, 0.42, 0.12, 0.035); } catch { /* sem áudio */ }
}
