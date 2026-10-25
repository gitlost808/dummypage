import { InputController } from './InputController';

// merges several input sources, e.g. keyboard + touch on touch-capable desktops
export class CombinedInput implements InputController {
  private inputs: InputController[];

  constructor(inputs: InputController[]) {
    this.inputs = inputs;
  }

  get left(): boolean {
    return this.inputs.some((i) => i.left);
  }

  get right(): boolean {
    return this.inputs.some((i) => i.right);
  }

  get dragging(): boolean {
    return this.inputs.some((i) => i.dragging);
  }

  // the first input with a finger down steers
  get targetX(): number {
    return this.inputs.find((i) => i.dragging)?.targetX ?? 0;
  }

  get fire(): boolean {
    return this.inputs.some((i) => i.fire);
  }

  get firePressed(): boolean {
    return this.inputs.some((i) => i.firePressed);
  }

  set firePressed(value: boolean) {
    this.inputs.forEach((i) => (i.firePressed = value));
  }

  update(): void {
    this.inputs.forEach((i) => i.update());
  }
}
