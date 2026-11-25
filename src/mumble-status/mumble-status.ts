import "../common/components/live-value/live-value";
import "../common/components/modal-dialog/modal-dialog";
import { createIntro } from "../common/scripts/intro";
import { bootPage } from "../common/scripts/page";

const pollInterval = 30_000;
const MAX_RETRY_ATTEMPTS = 10;
// Service accounts connected to Mumble that are not people.
const EXCLUDED_USER_NAMES = new Set(["WhatsAppBridge", "MumpeerRelay"]);
const USERS_ENDPOINT = "https://mumble.0x29a.me/status/users";
const TEAMSPEAK_ENDPOINT = "https://mumble.0x29a.me/status/teamspeak";
const BRIDGE_PARTICIPANTS_ENDPOINT =
  "https://mumble.0x29a.me/status/bridge/participants";
let retryAttempts = 0;
let pollTimer: ReturnType<typeof setTimeout>;
let pendingUpdate: Promise<void> | undefined;
const playerListUl = document.querySelector("#userlist .player-list");

type User = { name: string; channel?: string; teamspeak?: boolean };

// Clients on the TeamSpeak server, which still runs next to Mumble. A
// TeamSpeak outage only hides them.
async function fetchTeamSpeakUsers(): Promise<User[]> {
  try {
    const response = await fetch(TEAMSPEAK_ENDPOINT, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error(`TeamSpeak status returned ${response.status}`);
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
      throw new Error("Invalid TeamSpeak status response");
    }
    return data.users.map((user) => ({
      name: user.name,
      channel: user.channel,
      teamspeak: true,
    }));
  } catch (error) {
    console.error("Failed to fetch TeamSpeak users:", error);
    return [];
  }
}

// People in the bridged WhatsApp call. A bridge outage only hides them.
async function fetchWhatsappParticipantCount() {
  try {
    const response = await fetch(BRIDGE_PARTICIPANTS_ENDPOINT, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error(`WhatsApp bridge status returned ${response.status}`);
    const data = await response.json();
    return data.active &&
      Number.isInteger(data.participantCount) &&
      data.participantCount > 0
      ? data.participantCount
      : 0;
  } catch (error) {
    console.error("Failed to fetch WhatsApp participants:", error);
    return 0;
  }
}

function updatePlayerList(users: User[]) {
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
      // TeamSpeak users get a headset icon and a muted row.
      userIcon.classList.add(
        "fa-solid",
        user.teamspeak ? "fa-headset" : "fa-person",
      );
      if (user.teamspeak) userElem.classList.add("teamspeak");
      userElem.textContent = user.name;
      if (user.channel)
        userElem.title = user.teamspeak
          ? `TeamSpeak · ${user.channel}`
          : user.channel;
      userElem.prepend(userIcon);
      return userElem;
    }),
  );
}

async function fetchUserCount() {
  try {
    const whatsappParticipantCount = fetchWhatsappParticipantCount();
    const teamspeakUsers = fetchTeamSpeakUsers();
    const response = await fetch(USERS_ENDPOINT, {
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
    const users: User[] = [
      ...data.users.filter((user) => !EXCLUDED_USER_NAMES.has(user.name)),
      ...(await teamspeakUsers),
      ...Array.from({ length: await whatsappParticipantCount }, () => ({
        name: "WhatsApp participant",
      })),
    ];
    updatePlayerList(users);
    document.querySelector("live-value").value = users.length.toString();
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
    // The browser client; desktop users can copy the address instead.
    window.location.assign("https://mumble.0x29a.me/");
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
