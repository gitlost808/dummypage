import Phaser from 'phaser';
import { constants } from '../constants';

const textResolutions = new WeakMap<Phaser.Scene, { value: number }>();

function fitTextResolution(scene: Phaser.Scene, zoom: number): void {
  const value = Math.max(1, Math.ceil(zoom));
  let resolution = textResolutions.get(scene);
  if (!resolution) {
    resolution = { value };
    textResolutions.set(scene, resolution);
    const onAdd = (object: Phaser.GameObjects.GameObject) => {
      if (object instanceof Phaser.GameObjects.Text) object.setResolution(resolution.value);
    };
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdd);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdd);
      textResolutions.delete(scene);
    });
  } else if (resolution.value === value) {
    return;
  }
  resolution.value = value;
  // Text inside containers (the legend and overlays) also needs redrawing after
  // a resize. New text, including game over, is handled by the scene event.
  const update = (objects: Phaser.GameObjects.GameObject[]) => {
    for (const object of objects) {
      if (object instanceof Phaser.GameObjects.Text) object.setResolution(value);
      else if (object instanceof Phaser.GameObjects.Container) update(object.list);
    }
  };
  update(scene.children.list);
}

// scale the fixed-size playfield to fit the window, centred horizontally and aligned to the top;
// returns the zoom. Tall phones keep any extra space below the playfield instead of above the UI.
// The camera covers the whole canvas: ship glows got clipped away when its viewport was offset (v3),
// and a camera mask hid the whole playfield on some phones
export function fitPlayfieldCamera(camera: Phaser.Cameras.Scene2D.Camera, width: number, height: number): number {
  const zoom = Math.min(width / constants.width, height / constants.height);
  fitTextResolution(camera.scene, zoom);
  camera
    .setViewport(0, 0, width, height)
    .setZoom(zoom)
    .centerOn(constants.width / 2, height / zoom / 2);
  return zoom;
}
