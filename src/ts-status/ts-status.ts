import { rippleCenter, globalRippler } from "../common/scripts/rippler";
import { createTyper } from "../common/scripts/typer";
import { sleep } from "../common/scripts/util";

const retryInterval = 0x29a * 0x69;
const MAX_RETRY_ATTEMPTS = 10;
let retryAttempts = 0;

let firstFetch = true;
let userCount = "0";
let filteredUsers = [];
const playerListUl = document.querySelector("#modalBackdrop .modal-body > ul");

async function updatePlayerList() {
  if (filteredUsers.length === 0) {
    const noUsersLi = document.createElement("li");
    noUsersLi.textContent = "no users connected";
    playerListUl.replaceChildren(noUsersLi);
    return;
  }
  playerListUl.replaceChildren(
    ...filteredUsers.map((user) => {
      const userElem = document.createElement("li");
      const userIcon = document.createElement("i");
      switch (user.cid) {
        case "14":
          userIcon.classList.add("fa-solid", "fa-moon");
          break;
        case "28":
          userIcon.classList.add("fa-solid", "fa-baby");
          break;
        case "45":
          userIcon.classList.add("fa-solid", "fa-music");
          break;
        default:
          userIcon.classList.add("fa-solid", "fa-person");
          break;
      }

      userElem.textContent = user.client_nickname;
      userElem.prepend(userIcon);

      return userElem;
    }),
  );
}

async function updateUserCount(noRetry = false) {
  try {
    let users = await fetch("https://ts.0x29a.me/api/clientlist");
    let usersJson = await users.json();
    filteredUsers = usersJson.body.filter((user) => {
      const isNormalClient = user.client_type === "0";
      const filteredDbIds = [
        "76", "75"
      ];
      return isNormalClient &&
       !filteredDbIds.includes(user.client_database_id);
    });
    await updatePlayerList();
    const el = document.querySelector(".textcontainer > h1");
    userCount = filteredUsers.length.toString();

    if (el.textContent !== userCount) {
      el.innerHTML = "";
      userCount.split("").forEach((c) => {
        const userNumberSpan = document.createElement("span");
        userNumberSpan.classList.add("fadetext");
        userNumberSpan.textContent = c;
        el.appendChild(userNumberSpan);
      });

      if (firstFetch) {
        firstFetch = false;
      } else {
        rippleCenter(el);
      }
    }

    // Reset retry attempts on successful fetch
    retryAttempts = 0;
  } catch (error) {
    console.error("Failed to fetch user data:", error);

    // Increment retry attempts
    retryAttempts++;

    // If we've exceeded max retry attempts, stop retrying
    if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
      console.warn(`Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached. Stopping retries.`);
      retryAttempts = 0; // Reset for potential manual refresh
      return;
    }

    console.warn(`Retry attempt ${retryAttempts}/${MAX_RETRY_ATTEMPTS} failed. Retrying in ${retryInterval}ms...`);
  }

  if (noRetry) return;
  retry();
}

async function retry() {
  // If we've exceeded max retry attempts, stop retrying
  if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
    console.warn(`Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached. Stopping automatic retries.`);
    return;
  }

  await sleep(retryInterval);
  requestAnimationFrame(async () => {
    try {
      await updateUserCount();
    } catch (error) {
      console.error("Retry failed:", error);
      // Error handling is now in updateUserCount, so we don't need to handle it here
    }
  });
}

function setupConnectButton() {
  document.querySelector("#connectButton")?.addEventListener("click", () => {
    window.location.replace("ts3server://0x29a.me:4711");
  });
}

function setupRefreshButton() {
  document
    .querySelector("#refreshButton")
    ?.addEventListener("click", async () => {
      retryAttempts = 0; // Reset retry counter on manual refresh
      await updateUserCount(true);
    });
}

function setupCopyButton() {
  document.querySelector("#copyButton")?.addEventListener("click", async () => {
    const clipboardText = `There are currently ${userCount} users in teamspeak.`;
    navigator.clipboard.writeText(clipboardText);
  });
}

function setupListButton() {
  const listButton = document.querySelector("#listButton");
  const modalClose = document.querySelector("#modalClose") as HTMLElement | null;
  const modalBackdrop = document.querySelector("#modalBackdrop");
  const modal = document.querySelector("#modalBackdrop .modal");
  let previouslyFocused: Element | null = null;

  function openModal() {
    previouslyFocused = document.activeElement as Element;
    modalBackdrop.classList.add("active");
    history.pushState({ modalOpen: true }, "", window.location.href);
    modalClose?.focus();
  }

  function closeModal(fromPopState = false) {
    modalBackdrop.classList.remove("active");

    if (!fromPopState && history.state?.modalOpen) {
      history.back();
    }
    if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus();
    }
  }

  window.addEventListener("popstate", (e) => {
    if (modalBackdrop.classList.contains("active")) {
      closeModal(true);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalBackdrop.classList.contains("active")) {
      e.preventDefault();
      closeModal();
    }
  });

  listButton.addEventListener("click", (e) => {
    e.stopPropagation();

    if (modalBackdrop.classList.contains("active")) {
      closeModal();
    } else {
      openModal();
    }
  });

  modal.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", (e) => {
    if (
      !modal.contains(e.target as Node) &&
      modalBackdrop.classList.contains("active")
    ) {
      closeModal();
    }
  });

  modalClose.addEventListener("click", () => {
    closeModal();
  });
}

async function runner() {
  try {
    await updateUserCount();
  } catch (err) {
    console.error("Initial fetch failed:", err);
    retry();
  }

  setupConnectButton();
  setupRefreshButton();
  setupCopyButton();
  setupListButton();

  const typers = [
    createTyper(document.querySelector(".subcontainer > p")),
    createTyper(document.querySelector(".hint")),
  ];
  typers.forEach(async (typer) => await typer.hide());

  await sleep(0x29a * 2);
  await typers[0].type();
  await typers[1].type();
}
document.addEventListener("DOMContentLoaded", () => {
  runner();
  globalRippler();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register(new URL("service-worker.ts", import.meta.url), { type: "module" })
      .then((reg) => console.log("ServiceWorker registered:", reg))
      .catch((err) => console.error("ServiceWorker registration failed:", err));
  });
}
