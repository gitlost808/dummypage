import { createIntro } from "../common/scripts/intro";
import { bootPage } from "../common/scripts/page";
import localServices from "./service.json";
import { onAnimationsFastForward } from "../common/scripts/util";

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

function hasServices(value: unknown): value is { services: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).services)
  );
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

  if (typeof service.description === "string" && service.description.trim()) {
    const description = document.createElement("p");
    description.classList.add("service-description");
    description.textContent = service.description;
    link.append(description);
  }

  item.append(link);
  return item;
}

async function loadServices() {
  if (!serviceList) return;

  try {
    const payload: unknown = isLocalEnvironment
      ? localServices
      : await fetchLiveServices();
    if (!hasServices(payload)) throw new Error("Expected a services array");

    const services = payload.services.filter(isService);
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
    console.error("Failed to load services:", error);
    serviceList.replaceChildren(message("unable to load services"));
  }
}

async function fetchLiveServices(): Promise<unknown> {
  const response = await fetch("https://www.0x29a.me/services.json");
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json();
}

async function main() {
  await createIntro({
    heading: document.querySelector<HTMLElement>(".services .textcontainer > h1"),
  }).play();
  await loadServices();
}

bootPage(main);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register(new URL("service-worker.ts", import.meta.url), { type: "module" })
      .then((reg) => console.log("ServiceWorker registered:", reg))
      .catch((err) => console.error("ServiceWorker registration failed:", err));
  });
}
