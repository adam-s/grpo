// Shared single-track audio player. Calling play() stops any previously
// playing clip across the page, so you never hear two at once.

let currentAudio: HTMLAudioElement | null = null;
let currentEl: Element | null = null;
let currentCls = '';

export function stop(): void {
  currentAudio?.pause();
  if (currentEl && currentCls) currentEl.classList.remove(currentCls);
  currentAudio = null;
  currentEl = null;
  currentCls = '';
}

export function play(id: string, el: Element | null, playingClass = 'playing'): void {
  stop();
  if (el) {
    currentEl = el;
    currentCls = playingClass;
    el.classList.add(playingClass);
  }
  const audio = new Audio(`${import.meta.env.BASE_URL}audio/${id}.mp3`);
  currentAudio = audio;
  const cleanup = () => {
    if (currentEl === el && currentCls) el?.classList.remove(currentCls);
    if (currentAudio === audio) {
      currentAudio = null;
      currentEl = null;
      currentCls = '';
    }
  };
  audio.addEventListener('ended', cleanup);
  audio.addEventListener('error', cleanup);
  audio.play().catch(cleanup);
}
