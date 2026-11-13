import { BufferAttribute, BufferGeometry, Color } from 'three';
import { REGION_INFO, type Graph } from './types';

/** One allocation and draw for real confirmed edges; never infer missing connections. */
export function filamentGeometry(graph: Graph, selected: string | null, segments = 24) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const positions: number[] = [],
    colors: number[] = [];
  for (const edge of graph.edges) {
    if (edge.status !== 'confirmed') continue;
    if (selected && edge.source_id !== selected && edge.target_id !== selected) continue;
    const a = nodes.get(edge.source_id),
      b = nodes.get(edge.target_id);
    if (!a || !b) continue;
    const ca = new Color(REGION_INFO[a.region].color),
      cb = new Color(REGION_INFO[b.region].color);
    for (let i = 0; i < segments; i++)
      for (const t of [i / segments, (i + 1) / segments]) {
        for (let axis = 0; axis < 3; axis++) {
          const mid = (a.position[axis] + b.position[axis]) * 0.56;
          positions.push(
            (1 - t) ** 2 * a.position[axis] + 2 * (1 - t) * t * mid + t * t * b.position[axis],
          );
        }
        const c = ca.clone().lerp(cb, t);
        colors.push(c.r, c.g, c.b);
      }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeBoundingSphere();
  return geometry;
}

// Camera-space illumination follows the real mesh normals, never deforms anatomy.
export const cortexVertex = `
attribute float regionId;
varying vec3 vColor; varying vec3 vNormal; varying vec3 vView; varying float vRegion;
void main(){
 vColor=color; vRegion=regionId;
 vec4 mv=modelViewMatrix*vec4(position,1.);
 vNormal=normalize(normalMatrix*normal);vView=-mv.xyz;
 gl_Position=projectionMatrix*mv;
}`;
export const cortexFragment = `
uniform float focusRegion;
varying vec3 vColor; varying vec3 vNormal; varying vec3 vView; varying float vRegion;
void main(){
 vec3 n=normalize(vNormal); vec3 view=normalize(vView);
 float facing=max(0.,dot(n,view));
 float key=max(0.,dot(n,normalize(vec3(-.5,.8,1.))));
 float fill=max(0.,dot(n,normalize(vec3(.7,-.2,.4))));
 float rim=pow(1.-facing,3.);
 float focus=focusRegion<.5 || abs(vRegion-focusRegion)<.5 ? 1. : .22;
 vec3 tint=mix(vec3(.09,.14,.2),vColor,.48);
 vec3 light=tint*(.12+.65*key+.16*fill)+vColor*rim*.24;
 gl_FragColor=vec4(light*focus,(.27+.13*key+rim*.12)*focus);
 #include <colorspace_fragment>
}`;
export const glowVertex = `
varying vec3 vColor; varying vec3 vNormal; varying vec3 vView;
void main(){
 vColor=vec3(0.);
 #ifdef USE_INSTANCING_COLOR
 vColor=instanceColor;
 #endif
 vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);
 vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);vView=-mv.xyz;
 gl_Position=projectionMatrix*mv;}`;
export const glowFragment = `
varying vec3 vColor; varying vec3 vNormal; varying vec3 vView;
void main(){float facing=max(0.,dot(normalize(vNormal),normalize(vView)));
 gl_FragColor=vec4(vColor,.18*pow(facing,3.));
 #include <colorspace_fragment>
}`;

/** v1 includes one byte each for region AND hemisphere per vertex. */
export function validateAtlasBuffer(buffer: ArrayBuffer) {
  if (buffer.byteLength < 16) throw new Error('Truncated anatomical asset.');
  const h = new Uint32Array(buffer, 0, 4);
  if (
    h[0] !== 1 ||
    h[1] !== 20484 ||
    h[2] !== 122880 ||
    h[3] !== 10242 ||
    buffer.byteLength !== 16 + h[1] * 14 + h[2] * 4
  )
    throw new Error('Invalid anatomical asset dimensions.');
  return h;
}
