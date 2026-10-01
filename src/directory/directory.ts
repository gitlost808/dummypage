import { globalRippler } from "../common/scripts/rippler";
import { createTyper } from "../common/scripts/typer";
import localServices from "./service.json";
import {
  getAnimationFastForwardVersion,
  onAnimationsFastForward,
  setupAnimationFastForwardOnClick,
} from "../common/scripts/util";

type Service = {
  name: string;
  url: string;
  description?: string;
};

const serviceList = document.querySelector<HTMLUListElement>("#serviceList");
const isLocalEnvironment = ["localhost", "127.0.0.1", "::1"].includes(
  window.location.hostname,
);
let serviceAnimationsSkipped = false;

onAnimationsFastForward(() => {
  serviceAnimationsSkipped = true;
});

function message(text: string) {
  const item = document.createElement("li");
  item.classList.add("service-list-message");
  item.textContent = text;
  return item;
}

function isService(value: unknown): value is Service {
  if (typeof value !== "object" || value === null) return false;

  const service = value as Record<string, unknown>;
  return typeof service.name === "string" && typeof service.url === "string";
}

function createServiceItem(service: Service) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  const icon = document.createElement("i");
  const name = document.createElement("span");

  item.classList.add("service-list-item");
  link.href = service.url;
  link.classList.add("service-link");
  icon.classList.add("fa-solid", "fa-link");
  icon.setAttribute("aria-hidden", "true");
  name.textContent = service.name;
  link.append(icon, name);
  item.append(link);

  if (typeof service.description === "string" && service.description.trim()) {
    const description = document.createElement("p");
    description.classList.add("service-description");
    description.textContent = service.description;
    item.append(description);
  }

  return item;
}

async function loadServices() {
  if (!serviceList) return;

  try {
    const payload: unknown = isLocalEnvironment
      ? localServices
      : await fetchLiveServices();
    if (!Array.isArray(payload)) throw new Error("Expected an array");

    const services = payload.filter(isService);
    const serviceItems = services.map(createServiceItem);
    serviceItems.forEach((item, index) => {
      if (serviceAnimationsSkipped) {
        item.style.animation = "none";
        item.style.opacity = "1";
      } else {
        item.style.animationDelay = `${index * 0x29a * 0.2}ms`;
      }
    });
    serviceList.replaceChildren(
      ...(serviceItems.length ? serviceItems : [message("no services available")]),
    );
  } catch (error) {
    console.error("Failed to load service directory:", error);
    serviceList.replaceChildren(message("unable to load services"));
  }
}

async function fetchLiveServices(): Promise<unknown> {
  const response = await fetch("https://www.0x29a.me/services.json");
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json();
}

async function animateIntro() {
  const fastForwardVersion = getAnimationFastForwardVersion();
  const typers = Array.from(
    document.querySelectorAll<HTMLElement>(".directory .textcontainer > *"),
  ).map((element) => createTyper(element));

  await Promise.all(typers.map((typer) => typer.hide()));
  const [headingTyper, ...remainingTypers] = typers;
  await headingTyper?.type();

  if (fastForwardVersion === getAnimationFastForwardVersion()) {
    for (const typer of remainingTypers) {
      await typer.type();
      if (fastForwardVersion !== getAnimationFastForwardVersion()) break;
    }
  }
}

async function main() {
  globalRippler();
  setupAnimationFastForwardOnClick();
  await animateIntro();
  await loadServices();
}

document.addEventListener("DOMContentLoaded", () => {
  main();
});
