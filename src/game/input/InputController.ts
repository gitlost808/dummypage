export interface InputController {
  left: boolean;
  right: boolean;
  // true while the fire button is held
  fire: boolean;
  // latched on every fresh press so taps shorter than a frame still fire;
  // the consumer clears it once it has fired
  firePressed: boolean;
  update(): void;
}
