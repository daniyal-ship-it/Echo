'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Line, Billboard } from '@react-three/drei';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  FrontSide,
  InstancedMesh,
  Object3D,
  PerspectiveCamera,
  Spherical,
  Vector3,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { REGION_INFO, type Graph, type GraphNode, type Region } from '@/lib/types';
import { cameraFov, fitAnatomy } from '@/lib/brain-camera';

export type ViewCommand = {
  key: number;
  type: 'reset' | 'region' | 'topic' | 'memory' | 'front' | 'side' | 'quarter';
  region?: Region;
  position?: [number, number, number];
};
type Props = {
  graph: Graph;
  selected: string | null;
  region: Region | null;
  command: ViewCommand;
  quality: 'low' | 'balanced' | 'high';
  reducedMotion: boolean;
  onSelect: (node: GraphNode) => void;
  onRegion: (region: Region) => void;
  onReady?: () => void;
};
type Asset = {
  geometry: BufferGeometry;
  positions: Float32Array;
  colors: Float32Array;
  regions: Uint8Array;
};
const colorValues = ['#40566e', ...Object.values(REGION_INFO).map((r) => r.color)];
const regionKeys = Object.keys(REGION_INFO) as Region[];

async function loadAsset(): Promise<Asset> {
  const response = await fetch('/anatomy/brain.bin');
  if (!response.ok) throw new Error('Anatomical asset could not be loaded.');
  const buffer = await response.arrayBuffer();
  const header = new Uint32Array(buffer, 0, 4);
  if (header[0] !== 1) throw new Error('Unsupported anatomical asset.');
  const positions = new Float32Array(buffer, 16, header[1] * 3);
  const indices = new Uint32Array(buffer, 16 + header[1] * 12, header[2]);
  const regions = new Uint8Array(buffer, 16 + header[1] * 12 + header[2] * 4, header[1]);
  const colors = new Float32Array(header[1] * 3);
  const palette = colorValues.map((c) => new Color(c));
  for (let i = 0; i < header[1]; i++) palette[regions[i]].toArray(colors, i * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, positions, colors, regions };
}

function Cortex({
  asset,
  quality,
  onRegion,
  region,
}: {
  asset: Asset;
  quality: Props['quality'];
  onRegion: Props['onRegion'];
  region: Region | null;
}) {
  const { gl } = useThree();
  const points = useMemo(() => {
    // Keep enough genuine vertices to read sulci on a phone; low still uses half
    // the points and a single device pixel ratio instead of the desktop preset.
    const stride = quality === 'low' ? 2 : 1;
    const p: number[] = [],
      n: number[] = [],
      c: number[] = [];
    const normals = asset.geometry.getAttribute('normal');
    for (let i = 0; i < asset.regions.length; i += stride) {
      p.push(...asset.positions.slice(i * 3, i * 3 + 3));
      n.push(normals.getX(i), normals.getY(i), normals.getZ(i));
      const emphasis = !region || asset.regions[i] === REGION_INFO[region].index ? 1 : 0.32;
      c.push(...Array.from(asset.colors.slice(i * 3, i * 3 + 3), (x) => x * emphasis));
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(c), 3));
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(n), 3));
    return geo;
  }, [asset, quality, region]);
  useEffect(() => () => points.dispose(), [points]);
  const focus = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const index = event.face?.a;
    if (index !== undefined) {
      const r = asset.regions[index];
      if (r > 0) onRegion(regionKeys[r - 1]);
    }
  };
  return (
    <group>
      {/* Depth-only anatomy hides far-side colour bleed while the visible layer stays point-led. */}
      <mesh geometry={asset.geometry} onDoubleClick={focus} renderOrder={-1}>
        <meshBasicMaterial colorWrite={false} depthWrite side={FrontSide} />
      </mesh>
      <mesh geometry={asset.geometry} raycast={() => null} renderOrder={0}>
        <meshPhongMaterial
          color="#7891a7"
          transparent
          opacity={0.028}
          shininess={8}
          side={FrontSide}
          depthWrite={false}
          specular="#7d9eb0"
        />
      </mesh>
      <mesh geometry={asset.geometry} scale={1.001} raycast={() => null} renderOrder={1}>
        <shaderMaterial
          transparent
          depthWrite={false}
          side={FrontSide}
          blending={AdditiveBlending}
          vertexColors
          vertexShader={`varying vec3 vColor; varying vec3 vNormal; varying vec3 vView; void main(){vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`}
          fragmentShader={`varying vec3 vColor; varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),3.);gl_FragColor=vec4(vColor,rim*0.025);}`}
        />
      </mesh>
      <points geometry={points} raycast={() => null} renderOrder={2}>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexColors
          uniforms={{ size: { value: 2.9 }, pixelRatio: { value: gl.getPixelRatio() } }}
          vertexShader={`uniform float size; uniform float pixelRatio; varying vec3 vColor; varying float vFacing; void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.);vFacing=abs(dot(normalize(normalMatrix*normal),normalize(-mv.xyz)));gl_PointSize=clamp(size*pixelRatio*5.5/-mv.z,1.2,5.);gl_Position=projectionMatrix*mv;gl_Position.z-=0.00008*gl_Position.w;}`}
          fragmentShader={`varying vec3 vColor;varying float vFacing;void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;float a=smoothstep(.24,.04,d)*.72+exp(-d*d*16.)*.25;gl_FragColor=vec4(vColor*(.55+.75*vFacing),min(.95,a));
          #include <colorspace_fragment>
          }`}
        />
      </points>
    </group>
  );
}
function Memories({
  graph,
  selected,
  onSelect,
}: {
  graph: Graph;
  selected: string | null;
  onSelect: Props['onSelect'];
}) {
  const ref = useRef<InstancedMesh>(null);
  const halo = useRef<InstancedMesh>(null);
  const nodes = useMemo(() => graph.nodes.filter((n) => n.kind !== 'topic'), [graph.nodes]);
  const { invalidate } = useThree();
  useEffect(() => {
    if (!ref.current || !halo.current) return;
    const dummy = new Object3D();
    nodes.forEach((node, i) => {
      const size =
        node.count > 1
          ? Math.min(0.075, 0.025 + Math.log10(node.count) * 0.014)
          : node.id === selected
            ? 0.038
            : 0.024;
      dummy.position.set(...node.position);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
      ref.current!.setColorAt(
        i,
        new Color(node.id === selected ? '#ffffff' : REGION_INFO[node.region].color),
      );
      dummy.scale.setScalar(size * 2.5);
      dummy.updateMatrix();
      halo.current!.setMatrixAt(i, dummy.matrix);
      halo.current!.setColorAt(i, new Color(REGION_INFO[node.region].color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    halo.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    if (halo.current.instanceColor) halo.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
    halo.current.computeBoundingSphere();
    invalidate();
  }, [nodes, selected, invalidate]);
  if (!nodes.length) return null;
  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, nodes.length]}
        renderOrder={5}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) onSelect(nodes[e.instanceId]);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial toneMapped={false} depthTest={false} />
      </instancedMesh>
      <instancedMesh
        ref={halo}
        args={[undefined, undefined, nodes.length]}
        raycast={() => null}
        renderOrder={4}
      >
        <sphereGeometry args={[1, 10, 6]} />
        <meshBasicMaterial
          transparent
          opacity={0.075}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
        />
      </instancedMesh>
    </group>
  );
}
function TopicGlyphs({ graph, onSelect }: { graph: Graph; onSelect: Props['onSelect'] }) {
  return (
    <group>
      {graph.nodes
        .filter((n) => n.kind === 'topic')
        .map((node) => {
          const radius = 0.055 + Math.min(0.045, Math.log2(node.count + 1) * 0.009);
          return (
            <Billboard key={node.id} position={node.position}>
              <mesh
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(node);
                }}
                renderOrder={7}
              >
                <circleGeometry args={[radius * 1.3, 32]} />
                <meshBasicMaterial
                  color={REGION_INFO[node.region].color}
                  transparent
                  opacity={0.09}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
              <mesh raycast={() => null} renderOrder={8}>
                <ringGeometry args={[radius * 0.82, radius, 40]} />
                <meshBasicMaterial
                  color={REGION_INFO[node.region].color}
                  transparent
                  opacity={0.85}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            </Billboard>
          );
        })}
    </group>
  );
}
function Pathways({ graph, selected }: { graph: Graph; selected: string | null }) {
  const nodes = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  return (
    <group>
      {graph.edges
        .filter((edge) => !selected || edge.source_id === selected || edge.target_id === selected)
        .map((edge) => {
          const a = nodes.get(edge.source_id),
            b = nodes.get(edge.target_id);
          if (!a || !b) return null;
          const mid = new Vector3(...a.position)
            .add(new Vector3(...b.position))
            .multiplyScalar(0.5);
          mid.multiplyScalar(1.12);
          const points = Array.from({ length: 25 }, (_, i) => {
            const t = i / 24;
            return new Vector3(...a.position)
              .multiplyScalar((1 - t) ** 2)
              .add(mid.clone().multiplyScalar(2 * (1 - t) * t))
              .add(new Vector3(...b.position).multiplyScalar(t * t));
          });
          return (
            <Line
              key={edge.id}
              points={points}
              color={REGION_INFO[a.region].color}
              transparent
              opacity={selected ? 0.65 : 0.22}
              lineWidth={selected ? 1.2 : 0.65}
              depthTest={false}
              depthWrite={false}
              renderOrder={3}
              raycast={() => null}
            />
          );
        })}
    </group>
  );
}
function Controls({
  command,
  reducedMotion,
  positions,
}: {
  command: ViewCommand;
  reducedMotion: boolean;
  positions: Float32Array;
}) {
  const ref = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate, size } = useThree();
  const destination = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  useEffect(() => {
    if (camera instanceof PerspectiveCamera) {
      camera.fov = cameraFov(size.width / size.height);
      camera.updateProjectionMatrix();
      invalidate();
    }
  }, [camera, size.width, size.height, invalidate]);
  useEffect(() => {
    let position = new Vector3(-4.8, 1.1, -2.8),
      target = new Vector3(0, 0, 0);
    if (command.type === 'front') position = new Vector3(0, 0.4, -5.7);
    if (command.type === 'side') position = new Vector3(-5.8, 0.5, 0);
    if (command.type === 'region') {
      const locations: Record<Region, [number, number, number]> = {
        frontal: [-2.7, 1, -3.2],
        parietal: [-2.7, 3, 1],
        temporal: [-3.8, -0.5, -0.4],
        occipital: [-2, 1.2, 3.8],
      };
      position = new Vector3(...locations[command.region!]);
      target = position.clone().multiplyScalar(0.17);
    }
    if ((command.type === 'memory' || command.type === 'topic') && command.position) {
      const anchor = new Vector3(...command.position);
      target = anchor.clone().multiplyScalar(0.22);
      position = anchor.length() > 0.1 ? anchor.normalize().multiplyScalar(4.6) : position;
    }
    const framed = fitAnatomy(
      positions,
      position.toArray(),
      target.toArray(),
      cameraFov(size.width / size.height),
      size.width / size.height,
    );
    position.set(...framed);
    destination.current = { position, target };
    if (reducedMotion) {
      camera.position.copy(position);
      ref.current?.target.copy(target);
      ref.current?.update();
      destination.current = null;
    }
    invalidate();
  }, [command, reducedMotion, camera, invalidate, positions, size.width, size.height]);
  useFrame((_, dt) => {
    if (!destination.current || !ref.current) return;
    const { position, target } = destination.current;
    const alpha = 1 - Math.exp(-dt * 5);
    // Orbit around the cortex rather than crossing through it on opposite-side selections.
    const current = new Spherical().setFromVector3(camera.position.clone().sub(ref.current.target));
    const next = new Spherical().setFromVector3(position.clone().sub(target));
    const turn = Math.atan2(
      Math.sin(next.theta - current.theta),
      Math.cos(next.theta - current.theta),
    );
    current.theta += turn * alpha;
    current.phi += (next.phi - current.phi) * alpha;
    current.radius += (next.radius - current.radius) * alpha;
    ref.current.target.lerp(target, alpha);
    camera.position.setFromSpherical(current).add(ref.current.target);
    ref.current.update();
    if (camera.position.distanceTo(position) < 0.008) {
      destination.current = null;
    } else invalidate();
  });
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping={!reducedMotion}
      dampingFactor={0.08}
      minDistance={1.4}
      maxDistance={9}
      zoomSpeed={0.8}
      panSpeed={0.6}
      onStart={() => {
        destination.current = null;
      }}
    />
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function Brain(props: Props) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    let loaded: Asset | undefined;
    loadAsset()
      .then((a) => {
        loaded = a;
        if (live) setAsset(a);
        else a.geometry.dispose();
      })
      .catch((e) => setError(e.message));
    return () => {
      live = false;
      loaded?.geometry.dispose();
    };
  }, []);
  const fallback = (
    <div className="scene-fallback">
      <span>3D view unavailable</span>
      <p>
        Your memories are still accessible from the library. Enable WebGL or try another browser.
      </p>
    </div>
  );
  if (error)
    return (
      <div className="scene-fallback">
        <span>{error}</span>
        <p>The library remains available. No substitute geometry has been loaded.</p>
      </div>
    );
  if (!asset)
    return (
      <div className="scene-fallback loading">
        <span>Loading cortical geometry</span>
        <p>FreeSurfer fsaverage5 · 20,484 vertices</p>
      </div>
    );
  return (
    <SceneBoundary fallback={fallback}>
      <Canvas
        aria-label="Interactive MRI-derived brain. Drag to rotate, scroll to zoom, right-drag to pan. Double-click a lobe to focus. Memory selection is also available in the library."
        camera={{ position: [-4.8, 1.1, -2.8], fov: 32, near: 0.01, far: 50 }}
        dpr={props.quality === 'low' ? 1 : props.quality === 'high' ? [1, 2] : [1, 1.5]}
        frameloop="demand"
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        fallback={fallback}
        onCreated={() => props.onReady?.()}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[-3, 5, -4]} intensity={2} />
        <directionalLight position={[3, 1, 2]} intensity={0.9} color="#739fc4" />
        <Suspense fallback={null}>
          <Cortex
            asset={asset}
            quality={props.quality}
            onRegion={props.onRegion}
            region={props.region}
          />
          <Memories graph={props.graph} selected={props.selected} onSelect={props.onSelect} />
          <TopicGlyphs graph={props.graph} onSelect={props.onSelect} />
          <Pathways graph={props.graph} selected={props.selected} />
        </Suspense>
        <Controls
          command={props.command}
          reducedMotion={props.reducedMotion}
          positions={asset.positions}
        />
      </Canvas>
    </SceneBoundary>
  );
}
