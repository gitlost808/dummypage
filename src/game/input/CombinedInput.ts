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

  get dragX(): number {
    return this.inputs.reduce((sum, i) => sum + i.dragX, 0);
  }

  set dragX(value: number) {
    this.inputs.forEach((i) => (i.dragX = value));
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
