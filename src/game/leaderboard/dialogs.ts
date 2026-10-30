import type Phaser from 'phaser';
import { LeaderboardSession, PlayerNameError, validatePlayerName } from './client';
import { leaderboard } from './index';

const playerNameKey = 'galactic-skirmish:playerName';

function loadPlayerName(): string {
  try {
    return localStorage.getItem(playerNameKey) ?? '';
  } catch {
    return '';
  }
}

function rememberPlayerName(name: string): void {
  try {
    localStorage.setItem(playerNameKey, name);
  } catch {
    // Playing still works when browser storage is unavailable.
  }
}

// A remembered name can be rejected later (e.g. by new moderation rules); don't prefill it again.
function forgetPlayerName(name: string): void {
  try {
    if (localStorage.getItem(playerNameKey) === name) localStorage.removeItem(playerNameKey);
  } catch {
    // Nothing to forget when browser storage is unavailable.
  }
}

// Native dialogs supply focus trapping, Escape, scrolling, and a mobile text keyboard.
// Disable Phaser's global keyboard manager while typing so captured Space/arrow keys work normally.
class GameDialog {
  readonly element = document.createElement('dialog');
  readonly controller = new AbortController();
  private readonly inputEnabled: boolean;
  private readonly keyboardEnabled: boolean;
  private closed = false;

  constructor(private readonly scene: Phaser.Scene, title: string, onClose: () => void) {
    this.inputEnabled = scene.input.enabled;
    this.keyboardEnabled = scene.input.keyboard.manager.enabled;
    scene.input.enabled = false;
    scene.input.keyboard.manager.enabled = false;
    this.element.className = 'game-dialog';
    this.element.setAttribute('aria-label', title);
    const header = document.createElement('header');
    const heading = document.createElement('h2');
    heading.textContent = title;
    const close = button('Close');
    close.addEventListener('click', () => this.close());
    header.append(heading, close);
    this.element.append(header);
    this.element.addEventListener('close', () => {
      if (this.closed) return;
      this.closed = true;
      this.controller.abort();
      scene.events.off('shutdown', this.onShutdown);
      scene.input.enabled = this.inputEnabled;
      scene.input.keyboard.manager.enabled = this.keyboardEnabled;
      scene.input.keyboard.resetKeys();
      this.element.remove();
      onClose();
    });
    document.body.append(this.element);
    scene.events.once('shutdown', this.onShutdown);
  }

  private readonly onShutdown = () => this.close();

  show(): void {
    this.element.showModal();
  }

  close(): void {
    this.element.close();
  }
}

function button(label: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  return element;
}

function statusText(): HTMLParagraphElement {
  const element = document.createElement('p');
  element.className = 'game-dialog-status';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  return element;
}

export interface RunSetup {
  session?: LeaderboardSession;
}

export function openRunDialog(scene: Phaser.Scene): Promise<RunSetup | null> {
  return new Promise(resolve => {
    let result: RunSetup = null;
    let starting = false;
    const dialog = new GameDialog(scene, 'Ready, pilot?', () => resolve(result));
    const form = document.createElement('form');
    const label = document.createElement('label');
    label.textContent = 'Pilot name';
    const name = document.createElement('input');
    name.name = 'player_name';
    name.type = 'text';
    name.setAttribute('autocomplete', 'nickname');
    name.required = true;
    name.placeholder = 'Choose your leaderboard name';
    name.value = loadPlayerName();
    name.autofocus = true;
    label.append(name);
    const hint = document.createElement('p');
    hint.textContent = '1–32 characters. Online runs share your name and final score on the leaderboard.';
    const status = statusText();
    const actions = document.createElement('div');
    actions.className = 'game-dialog-actions';
    const start = button('Start run');
    start.type = 'submit';
    const offline = button('Play offline');
    actions.append(start, offline);
    form.append(label, hint, status, actions);
    dialog.element.append(form);

    const rejectName = (message: string) => {
      status.textContent = message;
      name.setAttribute('aria-invalid', 'true');
      name.focus();
      name.select();
    };
    name.addEventListener('input', () => name.removeAttribute('aria-invalid'));

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (starting) return;
      let playerName: string;
      try {
        playerName = validatePlayerName(name.value);
      } catch (error) {
        rejectName(error.message);
        return;
      }
      starting = true;
      start.disabled = offline.disabled = name.disabled = true;
      status.textContent = 'Starting your run…';
      try {
        const session = await leaderboard.startRun(playerName, dialog.controller.signal);
        if (dialog.controller.signal.aborted) return;
        rememberPlayerName(playerName);
        result = { session };
        dialog.close();
      } catch (error) {
        if (dialog.controller.signal.aborted) return;
        if (error instanceof PlayerNameError) {
          forgetPlayerName(playerName);
          // The disabled input can't take focus; re-enable it before moving focus there.
          name.disabled = false;
          rejectName(`${error.message} You can also play offline.`);
        } else {
          // The name wasn't refused, only the request failed: keep it for the next attempt.
          rememberPlayerName(playerName);
          status.textContent = `${error.message} You can retry or play offline.`;
        }
      } finally {
        starting = false;
        start.disabled = offline.disabled = name.disabled = false;
      }
    });
    offline.addEventListener('click', () => {
      if (starting) return;
      result = {};
      dialog.close();
    });
    dialog.show();
  });
}

export function openLeaderboardDialog(scene: Phaser.Scene, sessionId?: string): void {
  const dialog = new GameDialog(scene, 'Leaderboard', () => {});
  const description = document.createElement('p');
  description.textContent = 'Top 20 runs across all pilots';
  const status = statusText();
  const table = document.createElement('table');
  const caption = document.createElement('caption');
  caption.className = 'game-dialog-caption';
  caption.textContent = 'Rank, pilot name, and score';
  const head = document.createElement('thead');
  const headings = document.createElement('tr');
  for (const title of ['Rank', 'Pilot', 'Score']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = title;
    headings.append(cell);
  }
  head.append(headings);
  const body = document.createElement('tbody');
  table.append(caption, head, body);
  table.hidden = true;
  const refresh = button('Refresh');
  dialog.element.append(description, status, table, refresh);

  const load = async () => {
    refresh.disabled = true;
    status.textContent = 'Loading scores…';
    try {
      const entries = await leaderboard.getLeaderboard(dialog.controller.signal);
      if (dialog.controller.signal.aborted) return;
      body.replaceChildren();
      for (const entry of entries) {
        const row = document.createElement('tr');
        if (entry.session_id === sessionId) row.className = 'game-dialog-current-run';
        for (const value of [String(entry.rank), entry.player_name, entry.score.toLocaleString()]) {
          const cell = document.createElement('td');
          // Names are untrusted: keep them as text, never interpolate them into HTML.
          cell.textContent = value;
          row.append(cell);
        }
        body.append(row);
      }
      table.hidden = entries.length === 0;
      status.textContent = entries.length ? '' : 'No scores yet. Be the first pilot on the board!';
    } catch (error) {
      if (!dialog.controller.signal.aborted) status.textContent = error.message;
    } finally {
      refresh.disabled = false;
    }
  };
  refresh.addEventListener('click', load);
  dialog.show();
  void load();
}
