/** Kit first-run Welcome motion + wash (injected so patch-coverage stays on TS). */
import { ensureKitTypeStyles, KIT_DISPLAY_FONT } from './kitTypeStyles'

const STYLE_TEXT = `
@keyframes pb-welcome-drift {
  from { transform: scale(1.03) translate(0, 0); }
  to { transform: scale(1.09) translate(-1.2%, -0.6%); }
}
@keyframes pb-welcome-rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: none; }
}
.pb-welcome {
  background: linear-gradient(
    180deg,
    var(--chrome) 0%,
    color-mix(in srgb, var(--chrome) 68%, var(--canvas)) 55%,
    var(--canvas) 100%
  );
}
.pb-welcome-hero-mask {
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, black 35%, transparent) 22%,
    black 46%
  );
  mask-image: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, black 35%, transparent) 22%,
    black 46%
  );
}
.pb-welcome-hero {
  background-image: url('/photos/hi/c18.jpg');
  background-position: 74% 62%;
  background-size: cover;
  transform-origin: 80% 60%;
  animation: pb-welcome-drift 34s ease-in-out infinite alternate;
}
.pb-welcome-rise {
  animation: pb-welcome-rise 1s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.pb-welcome-rise--d1 { animation-delay: 0.1s; }
.pb-welcome-rise--d25 { animation-delay: 0.25s; }
.pb-welcome-rise--d4 { animation-delay: 0.4s; }
.pb-welcome-rise--d5 { animation-delay: 0.5s; }
.pb-welcome .pb-button.pb-welcome-create {
  height: calc(var(--spacing) * 12);
  border-radius: var(--radius-full);
  padding-inline: calc(var(--spacing) * 7);
  font-size: var(--text-md);
  box-shadow: var(--shadow-ink);
}
.pb-welcome-headline {
  margin-bottom: 0; /* no preflight: the UA h1 margin (0.67em = 61px) pushed the paragraph down */
  font-family: ${KIT_DISPLAY_FONT};
  font-size: var(--text-welcome-display);
  font-weight: 400;
}
.pb-welcome-headline--regrant {
  font-size: var(--text-welcome-regrant);
}
@media (prefers-reduced-motion: reduce) {
  .pb-welcome-rise,
  .pb-welcome-hero { animation: none !important; }
}
`

/** Idempotent inject for Welcome kit chrome. */
export function ensureWelcomeScreenStyles(): void {
  if (typeof document === 'undefined') {
    return
  }
  ensureKitTypeStyles()
  if (document.querySelector('style[data-pb-welcome]')) {
    return
  }
  const el = document.createElement('style')
  el.setAttribute('data-pb-welcome', '1')
  el.textContent = STYLE_TEXT
  document.head.appendChild(el)
}
