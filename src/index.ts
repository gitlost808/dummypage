import { createIntro } from "./common/scripts/intro";
import { bootPage } from "./common/scripts/page";
import { sleep } from "./common/scripts/util";

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
  const intro = createIntro({
    heading: document.querySelector<HTMLElement>(".textcontainer > h1"),
    lines: Array.from(document.querySelectorAll<HTMLElement>(".subcontainer > *")),
  });
  await intro.play();

  const lastTyper = intro.typers.at(-1);
  while (true) {
    await sleep(0x29a * 2);
    const text = getNextText();
    await lastTyper?.changeText(text, 0x29a);
  }
}
bootPage(main);
