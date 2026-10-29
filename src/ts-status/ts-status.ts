import "../common/components/live-value/live-value";
import "../common/components/modal-dialog/modal-dialog";
import { createIntro } from "../common/scripts/intro";
import { bootPage } from "../common/scripts/page";
import { sleep } from "../common/scripts/util";

const retryInterval = 0x29a * 0x69;
const MAX_RETRY_ATTEMPTS = 10;
let retryAttempts = 0;

let filteredUsers = [];
const playerListUl = document.querySelector("#userlist .player-list");
const filteredDbIds = ["76", "75", "107"];
const whatsappParticipantsEndpoint =
  "https://ts.0x29a.me/api/v1/calls/active/participants";

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
    const [usersResponse, whatsappParticipantsResponse] = await Promise.all([
      fetch("https://ts.0x29a.me/api/clientlist"),
      fetch(whatsappParticipantsEndpoint),
    ]);
    const usersJson = await usersResponse.json();
    const whatsappParticipants = await whatsappParticipantsResponse.json();
    const whatsappParticipantCount =
      whatsappParticipants.active &&
      Number.isInteger(whatsappParticipants.participantCount) &&
      whatsappParticipants.participantCount > 0
        ? whatsappParticipants.participantCount
        : 0;

    const teamspeakUsers = usersJson.body.filter((user) => {
      const isNormalClient = user.client_type === "0";
      return isNormalClient &&
       !filteredDbIds.includes(user.client_database_id);
    });
    const whatsappUsers = Array.from(
      { length: whatsappParticipantCount },
      () => ({ client_nickname: "WhatsApp participant" }),
    );
    filteredUsers = [...teamspeakUsers, ...whatsappUsers];
    await updatePlayerList();
    document.querySelector("live-value").value = filteredUsers.length.toString();

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
    const clipboardText = `ts.0x29a.me:4711`;
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

  await intro.play();
}
bootPage(runner);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register(new URL("service-worker.ts", import.meta.url), { type: "module" })
      .then((reg) => console.log("ServiceWorker registered:", reg))
      .catch((err) => console.error("ServiceWorker registration failed:", err));
  });
}
