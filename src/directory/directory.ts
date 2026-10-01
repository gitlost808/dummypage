import { globalRippler } from "../common/scripts/rippler";

type Service = {
  name: string;
  url: string;
  description?: string;
};

const serviceList = document.querySelector<HTMLUListElement>("#serviceList");

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

  link.href = service.url;
  link.classList.add("service-link");
  icon.classList.add("fa-solid", "fa-list");
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
    const response = await fetch("/services.json");
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("Expected an array");

    const services = payload.filter(isService);
    serviceList.replaceChildren(
      ...(services.length
        ? services.map(createServiceItem)
        : [message("no services available")]),
    );
  } catch (error) {
    console.error("Failed to load service directory:", error);
    serviceList.replaceChildren(message("unable to load services"));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  globalRippler();
  loadServices();
});
