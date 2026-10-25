// how something the player meets is introduced in the title screen legend (see ui/Legend)
export type LegendEntry = {
  name: string;
  description: string;
  // shown as the entry's icon; a baked glow version is used when there is one
  texture: string;
  color: number;
};
