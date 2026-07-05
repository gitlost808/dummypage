import { globalRippler } from "./common/scripts/rippler";
import { createTyper } from "./common/scripts/typer";
import {
  animationSleep,
  getAnimationFastForwardVersion,
  setupAnimationFastForwardOnClick,
  sleep,
} from "./common/scripts/util";

const texts = [
  "processing your click...",
  "awaiting user command...",
  "clicks are being noted...",
  "nothing thrilling here...",
  "listening on port 80...",
  "compiled with stubs.js...",
  "stage zero deployment...",
  "pinging the cosmic void...",
  "rendering placeholder...",
  "user presence confirmed...",
  "logging extra details...",
  "running diagnostics now...",
  "status: serenely idle...",
  "html in super safe mode",
  "echoing into the ether...",
  "system on standby mode...",
  "request gently denied...",
  "zero errors; zero features",
  "running on pure vibes...",
  "input ignored as designed",
];

let lastIndex = -1;
function getNextText() {
  let index;
  do {
    index = Math.floor(Math.random() * texts.length);
  } while (index === lastIndex);
  
  lastIndex = index;
  
  return texts[index];
}

async function main() {
  const fastForwardVersion = getAnimationFastForwardVersion();
  const typers = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".textcontainer > *, .subcontainer > *",
    ),
  ).map((el) => createTyper(el));
  typers.forEach(async (typer) => await typer.hide());
  const typerTypers = typers.map((typer) => {
    return typer.type;
  });
  let firstTyper = typerTypers.shift();
  if (firstTyper) firstTyper();
  await animationSleep(0x29a * 2);
  if (fastForwardVersion === getAnimationFastForwardVersion()) {
    for (const typer of typerTypers) {
      await typer();
      if (fastForwardVersion !== getAnimationFastForwardVersion()) {
        break;
      }
    }
  }

  const lastTyper = typers.at(-1);
  while (true) {
    await sleep(0x29a * 2);
    const text = getNextText();
    await lastTyper?.changeText(text, 0x29a);
  }
}
document.addEventListener("DOMContentLoaded", () => {
  main();
  globalRippler();
  setupAnimationFastForwardOnClick();
});
