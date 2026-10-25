import Phaser from 'phaser';
import { constants } from '../constants';

// scale the fixed-size playfield to fit a width × height window and centre it; returns the zoom.
// The camera covers the whole canvas: ship glows got clipped away when its viewport was offset (v3),
// and a camera mask hid the whole playfield on some phones
export function fitPlayfieldCamera(camera: Phaser.Cameras.Scene2D.Camera, width: number, height: number): number {
  const zoom = Math.min(width / constants.width, height / constants.height);
  camera
    .setViewport(0, 0, width, height)
    .setZoom(zoom)
    .centerOn(constants.width / 2, constants.height / 2);
  return zoom;
}
