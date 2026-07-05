const pendingAnimationSleeps = new Set<() => void>();
const fastForwardListeners = new Set<() => void>();
let fastForwardVersion = 0;

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const animationSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      pendingAnimationSleeps.delete(cancelSleep);
      resolve();
    }, ms);

    const cancelSleep = () => {
      window.clearTimeout(timeoutId);
      pendingAnimationSleeps.delete(cancelSleep);
      resolve();
    };

    pendingAnimationSleeps.add(cancelSleep);
  });

export function onAnimationsFastForward(listener: () => void) {
  fastForwardListeners.add(listener);

  return () => {
    fastForwardListeners.delete(listener);
  };
}

export function getAnimationFastForwardVersion() {
  return fastForwardVersion;
}

export function fastForwardPageAnimations() {
  fastForwardVersion++;
  Array.from(pendingAnimationSleeps).forEach((cancelSleep) => cancelSleep());
  Array.from(fastForwardListeners).forEach((listener) => listener());

  const animations =
    document.getAnimations?.() ??
    document.documentElement.getAnimations?.({ subtree: true }) ??
    [];

  animations.forEach((animation) => {
    try {
      animation.finish();
    } catch {
      // Ignore animations that cannot be finished.
    }
  });
}

export function setupAnimationFastForwardOnClick() {
  document.addEventListener("click", () => {
    fastForwardPageAnimations();
  }, { capture: true });
}
