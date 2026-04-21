import { readable } from 'svelte/store';

// Tablets (iPad portrait is 768px) rendered the 44k-cell desktop ModelDiagram
// when the breakpoint was 720px. Treat anything under a conventional laptop
// width as "mobile" for the purposes of swapping in the lightweight view.
const MOBILE_QUERY = '(max-width: 1023px)';

// `null` means "not yet resolved on the client" — consumers should gate
// rendering on an explicit `true`/`false` to avoid hydrating the wrong
// variant and paying a full re-mount on mismatch.
export const isMobile = readable<boolean | null>(null, (set) => {
  if (typeof window === 'undefined') return;
  const mql = window.matchMedia(MOBILE_QUERY);
  set(mql.matches);
  const update = () => set(mql.matches);
  mql.addEventListener('change', update);
  return () => mql.removeEventListener('change', update);
});
