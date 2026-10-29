import "../common/components/live-value/live-value";
import { createIntro } from "../common/scripts/intro";
import { bootPage } from "../common/scripts/page";

const IFC_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "Sol",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const IFC_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = current.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000) + 1;
}

function toIFCDate(date: Date) {
  const year = date.getFullYear();
  const leapYear = isLeapYear(year);
  const dayOfYear = getDayOfYear(date);
  const isLeapDay = leapYear && dayOfYear === 180;
  const isYearDay = dayOfYear === (leapYear ? 366 : 365);

  if (isLeapDay) {
    return {
      display: `Leap Day ${year}`,
      copyText: `Leap Day, ${year} (International Fixed Calendar)`,
    };
  }

  if (isYearDay) {
    return {
      display: `Year Day ${year}`,
      copyText: `Year Day, ${year} (International Fixed Calendar)`,
    };
  }

  const normalizedDay = leapYear && dayOfYear > 180 ? dayOfYear - 1 : dayOfYear;
  const monthIndex = Math.floor((normalizedDay - 1) / 28);
  const dayOfMonth = ((normalizedDay - 1) % 28) + 1;
  const weekday = IFC_WEEKDAYS[(dayOfMonth - 1) % 7];
  const month = IFC_MONTHS[monthIndex];

  return {
    display: `${weekday}, ${month} ${dayOfMonth}, ${year}`,
    copyText: `${weekday}, ${month} ${dayOfMonth}, ${year} (International Fixed Calendar)`,
  };
}

function renderDate(force = false) {
  document
    .querySelector("live-value")
    ?.update(toIFCDate(new Date()).display, { force });
}

function setupButtons() {
  const refreshButton = document.querySelector("#refreshButton");
  refreshButton?.addEventListener("click", () => {
    renderDate(true);
  });

  const copyButton = document.querySelector("#copyButton");
  copyButton?.addEventListener("click", async () => {
    const ifcDate = toIFCDate(new Date());
    await navigator.clipboard.writeText(ifcDate.copyText);
  });
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const msToMidnight = tomorrow.getTime() - now.getTime() + 100;

  setTimeout(() => {
    renderDate();
    scheduleMidnightRefresh();
  }, msToMidnight);
}

async function runner() {
  setupButtons();
  renderDate();
  scheduleMidnightRefresh();

  await createIntro({
    lines: [
      document.querySelector<HTMLElement>(".subcontainer > p"),
      document.querySelector<HTMLElement>(".hint"),
    ],
  }).play();
}

bootPage(runner);
