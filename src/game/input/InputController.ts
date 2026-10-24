export interface InputController {
  // held steering keys; ignored while dragging
  left: boolean;
  right: boolean;
  // true while a finger is down: the ship follows dragX instead of left/right
  dragging: boolean;
  // horizontal finger travel (playfield px) since the consumer last cleared it
  dragX: number;
  // true while the fire button is held
  fire: boolean;
  // latched on every fresh press so taps shorter than a frame still fire;
  // the consumer clears it once it has fired
  firePressed: boolean;
  update(): void;
}
