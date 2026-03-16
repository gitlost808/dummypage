const CURSOR = "|";

import { sleep } from "./util";

export const createTyper = (letterContainer: HTMLElement) => {
  const text = letterContainer.textContent?.trim() ?? "";
  let splitText: Array<string>, timeout: number;

  function updateSplittedTextAndTimeout(text: string) {
    splitText = text.split("");
    timeout = 0x29a / splitText.length;
  }
  updateSplittedTextAndTimeout(text)
  
  const typer = {
    async changeText(newText: string, wait: number = 0) {
      if ("true" === letterContainer.dataset.hidden) {
        await typer.hide();
        updateSplittedTextAndTimeout(newText)
      } else {
        await typer.untype();
        updateSplittedTextAndTimeout(newText)
        await typer.hide();
        await sleep(wait);
        await typer.type();
      }
    },
    // TODO this actually doesn't just "hide", 
    // it recreates the whole text, 
    // I need to replace this with a real hide function soon(tm)
    async hide() {
      const letterElems = splitText.map((c) => {
        const letterElem = document.createElement("span");
        letterElem.textContent = c;

        return letterElem;
      });

      letterContainer.innerHTML = "";
      letterContainer.append(...letterElems);
      letterContainer.dataset.hidden = "true";

      return letterElems;
    },
    async type() {
      let letterElems: HTMLElement[] = [];
      if (!letterContainer.dataset.hidden) {
        letterElems = await typer.hide();
      } else {
        letterElems = Array.from(letterContainer.querySelectorAll("span"));
      }
      for (const letterElem of letterElems) {
        let tmpLetter = letterElem.textContent;
        letterElem.textContent = CURSOR;
        letterElem.classList.add("glow", "show");

        await sleep(timeout);
        letterElem.textContent = tmpLetter;
      }
      letterContainer.dataset.hidden = "false";
    },
    async untype() {
      const letterElems = Array.from(letterContainer.querySelectorAll("span"));

      for (const letterElem of letterElems.toReversed()) {
        let tmpLetter = letterElem.textContent;
        letterElem.textContent = CURSOR;

        await sleep(timeout);
        letterElem.classList.remove("glow", "show");
        letterElem.textContent = tmpLetter
      }

      letterContainer.dataset.hidden = "true";
    },
  };

  return typer;
};
