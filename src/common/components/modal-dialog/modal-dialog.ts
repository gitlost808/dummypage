// Wraps a native <dialog>, which brings focus handling and Escape for free. On top of
// that it closes on backdrop clicks and takes a history entry, so the browser's back
// button closes it on phones.
export class ModalDialog extends HTMLElement {
  #dialog: HTMLDialogElement;

  connectedCallback() {
    this.#dialog = this.querySelector("dialog");
    this.#dialog.addEventListener("click", this.#onClick);
    this.#dialog.addEventListener("close", this.#onClose);
    window.addEventListener("popstate", this.#onPopState);
  }

  disconnectedCallback() {
    this.#dialog.removeEventListener("click", this.#onClick);
    this.#dialog.removeEventListener("close", this.#onClose);
    window.removeEventListener("popstate", this.#onPopState);
  }

  get isOpen() {
    return this.#dialog.open;
  }

  open() {
    if (this.isOpen) return;

    this.#dialog.showModal();
    history.pushState({ modalOpen: true }, "", window.location.href);
  }

  close() {
    this.#dialog.close();
  }

  #onClick = (event: MouseEvent) => {
    // a click on the backdrop targets the dialog itself, but so does one on its padding
    const rect = this.#dialog.getBoundingClientRect();
    const onBackdrop =
      event.target === this.#dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom);
    if (onBackdrop) {
      this.close();
      return;
    }

    // clicks inside must not ripple or fast-forward the opening animation
    event.stopPropagation();
    if ((event.target as Element).closest("[data-modal-close]")) {
      this.close();
    }
  };

  // runs for every way of closing, Escape included
  #onClose = () => {
    if (history.state?.modalOpen) history.back();
  };

  // back has already left the modal's history entry, so #onClose won't go back again
  #onPopState = () => {
    if (this.isOpen) this.close();
  };
}

customElements.define("modal-dialog", ModalDialog);

declare global {
  interface HTMLElementTagNameMap {
    "modal-dialog": ModalDialog;
  }
}
