import { rippleCenter } from "../../scripts/rippler";

// A value that changes while the page is open: every new value fades in letter by
// letter, and every change after the first one ripples from the value's center.
export class LiveValue extends HTMLElement {
  #value: string | undefined;

  get value() {
    return this.#value ?? this.textContent;
  }

  set value(value: string) {
    this.update(value);
  }

  // force re-renders (and ripples) even when the value hasn't changed
  update(value: string, { force = false } = {}) {
    if (value === this.#value && !force) return;

    const isFirstValue = this.#value === undefined;
    this.#value = value;
    this.replaceChildren(
      ...value.split("").map((char) => {
        const span = document.createElement("span");
        span.classList.add("fadetext");
        span.textContent = char;
        return span;
      }),
    );

    if (!isFirstValue) rippleCenter(this);
  }
}

customElements.define("live-value", LiveValue);

declare global {
  interface HTMLElementTagNameMap {
    "live-value": LiveValue;
  }
}
