import { createTyper } from "./typer";
import { animationSleep, getAnimationFastForwardVersion } from "./util";

type IntroOptions = {
  // typed right away
  heading?: HTMLElement | null;
  // typed one after another once the delay has passed
  lines?: HTMLElement[];
  delay?: number;
};

// Hides the elements immediately and types them back in on play(). Once the page
// animations are fast-forwarded, whatever hasn't been typed yet is skipped.
export function createIntro({ heading, lines = [], delay = 0x29a * 2 }: IntroOptions) {
  const fastForwardVersion = getAnimationFastForwardVersion();
  const skipped = () => fastForwardVersion !== getAnimationFastForwardVersion();

  const headingTyper = heading ? createTyper(heading) : undefined;
  const lineTypers = lines.filter(Boolean).map((line) => createTyper(line));
  const typers = headingTyper ? [headingTyper, ...lineTypers] : lineTypers;
  typers.forEach((typer) => typer.hide());

  return {
    typers,
    async play() {
      if (skipped()) return;

      const headingTyping = headingTyper?.type();
      if (lineTypers.length) await animationSleep(delay);
      for (const typer of lineTypers) {
        if (skipped()) break;
        await typer.type();
      }
      await headingTyping;
    },
  };
}
