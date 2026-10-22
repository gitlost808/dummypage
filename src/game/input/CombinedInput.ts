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

  get shoot(): boolean {
    return this.inputs.some((i) => i.shoot);
  }

  set shoot(value: boolean) {
    this.inputs.forEach((i) => (i.shoot = value));
  }

  update(): void {
    this.inputs.forEach((i) => i.update());
  }
}
