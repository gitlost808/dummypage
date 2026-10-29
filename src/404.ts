import { createIntro } from "./common/scripts/intro";
import { bootPage } from "./common/scripts/page";

async function main() {
  await createIntro({
    heading: document.querySelector<HTMLElement>(".textcontainer > h1"),
    lines: Array.from(document.querySelectorAll<HTMLElement>(".subcontainer > *")),
  }).play();
}
bootPage(main);
