import { globalRippler } from "./rippler";
import { setupAnimationFastForwardOnClick } from "./util";

// Sets up what every page shares, then runs the page's own main once the DOM is ready.
export function bootPage(main: () => unknown) {
  document.addEventListener("DOMContentLoaded", () => {
    globalRippler();
    setupAnimationFastForwardOnClick();
    main();
  });
}
