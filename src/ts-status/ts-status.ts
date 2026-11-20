import "../common/components/live-value/live-value";
import "../common/components/modal-dialog/modal-dialog";
import { createIntro } from "../common/scripts/intro";
import { bootPage } from "../common/scripts/page";

const pollInterval = 30_000;
const MAX_RETRY_ATTEMPTS = 10;
let retryAttempts = 0;
let pollTimer: ReturnType<typeof setTimeout>;
let pendingUpdate: Promise<void> | undefined;
const playerListUl = document.querySelector("#userlist .player-list");

function updatePlayerList(users: { name: string; channel: string }[]) {
  if (users.length === 0) {
    const noUsersLi = document.createElement("li");
    noUsersLi.textContent = "no users connected";
    playerListUl.replaceChildren(noUsersLi);
    return;
  }
  playerListUl.replaceChildren(
    ...users.map((user) => {
      const userElem = document.createElement("li");
      const userIcon = document.createElement("i");
      userIcon.classList.add("fa-solid", "fa-person");
      userElem.textContent = user.name;
      userElem.title = user.channel;
      userElem.prepend(userIcon);
      return userElem;
    }),
  );
}

async function fetchUserCount() {
  try {
    const response = await fetch("https://ts.0x29a.me/api/mumble/users", {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error(`Mumble status returned ${response.status}`);
    const data = await response.json();
    if (
      !Array.isArray(data.users) ||
      data.users.some(
        (user) =>
          !user ||
          typeof user.name !== "string" ||
          typeof user.channel !== "string",
      )
    ) {
      throw new Error("Invalid Mumble status response");
    }
    updatePlayerList(data.users);
    document.querySelector("live-value").value = data.users.length.toString();
    retryAttempts = 0;
  } catch (error) {
    console.error("Failed to fetch Mumble users:", error);
    retryAttempts++;
    document.querySelector("live-value").value = "?";
    const unavailable = document.createElement("li");
    unavailable.textContent = "Mumble status unavailable";
    playerListUl.replaceChildren(unavailable);
  }
}

async function updateUserCount() {
  // Manual refresh and the timer share one request and one polling loop.
  clearTimeout(pollTimer);
  if (pendingUpdate) return pendingUpdate;
  pendingUpdate = fetchUserCount();
  try {
    await pendingUpdate;
  } finally {
    pendingUpdate = undefined;
    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
      pollTimer = setTimeout(updateUserCount, pollInterval);
    }
  }
}

function setupConnectButton() {
  document.querySelector("#connectButton")?.addEventListener("click", () => {
    window.location.replace("mumble://0x29a.me:64738/");
  });
}

function setupRefreshButton() {
  document
    .querySelector("#refreshButton")
    ?.addEventListener("click", async () => {
      retryAttempts = 0; // Reset retry counter on manual refresh
      await updateUserCount();
    });
}

function setupCopyButton() {
  document.querySelector("#copyButton")?.addEventListener("click", async () => {
    const clipboardText = `0x29a.me:64738`;
    navigator.clipboard.writeText(clipboardText);
  });
}

function setupListButton() {
  const modal = document.querySelector("modal-dialog");
  document.querySelector("#listButton")?.addEventListener("click", (e) => {
    // the global click handler would fast-forward the modal's opening animation
    e.stopPropagation();
    modal.open();
  });
}

async function runner() {
  const intro = createIntro({
    lines: [
      document.querySelector<HTMLElement>(".subcontainer > p"),
      document.querySelector<HTMLElement>(".hint"),
    ],
  });

  await updateUserCount();

  setupConnectButton();
  setupRefreshButton();
  setupCopyButton();
  setupListButton();

  await intro.play();
}
bootPage(runner);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register(new URL("service-worker.ts", import.meta.url), {
        type: "module",
      })
      .then((reg) => console.log("ServiceWorker registered:", reg))
      .catch((err) => console.error("ServiceWorker registration failed:", err));
  });
}
