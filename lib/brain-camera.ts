type Point = [number, number, number];
export const cameraFov = (aspect: number) => 32 + Math.max(0, 1.25 - aspect) * 22;

/** Fit the unchanged anatomical vertices, including asymmetric focus targets. */
export function fitAnatomy(
  positions: ArrayLike<number>,
  desired: Point,
  target: Point,
  fov: number,
  aspect: number,
): Point {
  const offset = desired.map((v, i) => v - target[i]);
  const distance = Math.hypot(...offset);
  const direction = offset.map((v) => v / distance);
  const horizontal = Math.hypot(direction[0], direction[2]);
  const right =
    horizontal > 1e-6 ? [direction[2] / horizontal, 0, -direction[0] / horizontal] : [1, 0, 0];
  const up = [
    direction[1] * right[2],
    direction[2] * right[0] - direction[0] * right[2],
    -direction[1] * right[0],
  ];
  const tanV = Math.tan((fov * Math.PI) / 360);
  const tanH = tanV * Math.max(0.1, aspect);
  let fit = distance;
  for (let i = 0; i < positions.length; i += 3) {
    const p = [
      positions[i] - target[0],
      positions[i + 1] - target[1],
      positions[i + 2] - target[2],
    ];
    const z = p.reduce((sum, v, j) => sum + v * direction[j], 0);
    const x = p.reduce((sum, v, j) => sum + v * right[j], 0);
    const y = p.reduce((sum, v, j) => sum + v * up[j], 0);
    fit = Math.max(fit, z + (Math.abs(x) * 1.12) / tanH, z + (Math.abs(y) * 1.12) / tanV);
  }
  return direction.map((v, i) => target[i] + v * fit) as Point;
}
