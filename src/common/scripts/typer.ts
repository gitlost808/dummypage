const CURSOR = "|";

import {
  animationSleep,
  onAnimationsFastForward,
} from "./util";

export const createTyper = (letterContainer: HTMLElement) => {
  const text = letterContainer.textContent?.trim() ?? "";
  let splitText: Array<string>, timeout: number;
  let currentText = text;
  let pendingText = text;
  let operationId = 0;

  function updateSplittedTextAndTimeout(text: string) {
    splitText = text.split("");
    timeout = splitText.length === 0 ? 0 : 0x29a / splitText.length;
  }
  updateSplittedTextAndTimeout(text);

  function renderText(value: string, shown: boolean) {
    const letterElems = value.split("").map((c) => {
      const letterElem = document.createElement("span");
      letterElem.textContent = c;
      if (shown) {
        letterElem.classList.add("show");
      }

      return letterElem;
    });

    letterContainer.innerHTML = "";
    letterContainer.append(...letterElems);

    return letterElems;
  }

  function finish() {
    operationId++;
    currentText = pendingText;
    updateSplittedTextAndTimeout(currentText);
    renderText(currentText, true);
    letterContainer.dataset.hidden = "false";
  }

  onAnimationsFastForward(finish);
  
  const typer = {
    async changeText(newText: string, wait: number = 0) {
      pendingText = newText;

      if ("true" === letterContainer.dataset.hidden) {
        await typer.hide();
        updateSplittedTextAndTimeout(newText);
        currentText = newText;
      } else {
        await typer.untype();
        if ("false" === letterContainer.dataset.hidden) {
          finish();
          return;
        }

        updateSplittedTextAndTimeout(newText);
        await typer.hide();
        await animationSleep(wait);
        if ("false" === letterContainer.dataset.hidden) {
          return;
        }
        await typer.type();
      }
    },
    // TODO this actually doesn't just "hide", 
    // it recreates the whole text, 
    // I need to replace this with a real hide function soon(tm)
    async hide() {
      const letterElems = renderText(splitText.join(""), false);
      letterContainer.dataset.hidden = "true";

      return letterElems;
    },
    async type() {
      const currentOperationId = ++operationId;
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

        await animationSleep(timeout);
        if (currentOperationId !== operationId) {
          return;
        }
        letterElem.textContent = tmpLetter;
      }
      currentText = pendingText;
      letterContainer.dataset.hidden = "false";
    },
    async untype() {
      const currentOperationId = ++operationId;
      const letterElems = Array.from(letterContainer.querySelectorAll("span"));

      for (const letterElem of letterElems.toReversed()) {
        let tmpLetter = letterElem.textContent;
        letterElem.textContent = CURSOR;

        await animationSleep(timeout);
        if (currentOperationId !== operationId) {
          return;
        }
        letterElem.classList.remove("glow", "show");
        letterElem.textContent = tmpLetter;
      }

      letterContainer.dataset.hidden = "true";
    },
  };

  return typer;
};
