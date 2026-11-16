/* three r170 (the kit's vendored `three.module.min.js`, no @types/three): typed by hand, only the API `gl/` uses. */

export const REVISION: string
export const SRGBColorSpace: string
export const NoColorSpace: string
export const NoToneMapping: number
export const LinearMipmapLinearFilter: number
export const RepeatWrapping: number
export const DoubleSide: number
export const FrontSide: number
export const BackSide: number
export const VSMShadowMap: number
export const GLSL3: string

export class Vector2 {
  constructor(x?: number, y?: number)
  x: number
  y: number
  set(x: number, y: number): this
}

export class Vector3 {
  constructor(x?: number, y?: number, z?: number)
  x: number
  y: number
  z: number
  set(x: number, y: number, z: number): this
  applyMatrix4(m: Matrix4): this
  project(camera: Camera): this
}

export class Matrix4 {
  elements: number[]
}

export class Euler {
  x: number
  y: number
  z: number
  order: string
  set(x: number, y: number, z: number, order?: string): this
}

export class Box3 {
  min: Vector3
  max: Vector3
}

export class Object3D {
  position: Vector3
  rotation: Euler
  up: Vector3
  matrixWorld: Matrix4
  children: Object3D[]
  visible: boolean
  castShadow: boolean
  receiveShadow: boolean
  renderOrder: number
  frustumCulled: boolean
  add(...objects: Object3D[]): this
  clear(): this
  lookAt(x: number, y: number, z: number): void
  updateMatrixWorld(force?: boolean): void
}

export class Group extends Object3D {}
export class Scene extends Object3D {}

export class BufferAttribute {
  count: number
  itemSize: number
  array: ArrayLike<number>
  getX(index: number): number
  getY(index: number): number
  getZ(index: number): number
}

export class Float32BufferAttribute extends BufferAttribute {
  constructor(array: ArrayLike<number>, itemSize: number)
}

export class BufferGeometry {
  type: string
  index: BufferAttribute | null
  boundingBox: Box3 | null
  setAttribute(name: string, attribute: BufferAttribute): this
  getAttribute(name: string): BufferAttribute
  setIndex(index: number[]): this
  computeVertexNormals(): void
  computeBoundingBox(): void
  dispose(): void
}

export class BoxGeometry extends BufferGeometry {
  constructor(width?: number, height?: number, depth?: number)
}

export class CylinderGeometry extends BufferGeometry {
  constructor(
    radiusTop?: number,
    radiusBottom?: number,
    height?: number,
    radialSegments?: number,
    heightSegments?: number,
    openEnded?: boolean,
    thetaStart?: number,
    thetaLength?: number,
  )
}

export class PlaneGeometry extends BufferGeometry {
  constructor(
    width?: number,
    height?: number,
    widthSegments?: number,
    heightSegments?: number,
  )
}

export class Texture {
  image: unknown
  colorSpace: string
  anisotropy: number
  generateMipmaps: boolean
  minFilter: number
  wrapS: number
  wrapT: number
  repeat: Vector2
  needsUpdate: boolean
  dispose(): void
}

export class CanvasTexture extends Texture {
  constructor(source: CanvasImageSource | OffscreenCanvas)
}

export class Color {
  getHexString(): string
}

export class Material {
  side: number
  transparent: boolean
  depthTest: boolean
  depthWrite: boolean
  opacity: number
  dispose(): void
}

export interface MeshStandardMaterialParameters {
  color?: string | number
  map?: Texture | null
  roughness?: number
  side?: number
  bumpMap?: Texture
  bumpScale?: number
  polygonOffset?: boolean
  polygonOffsetFactor?: number
  polygonOffsetUnits?: number
}

export class MeshStandardMaterial extends Material {
  constructor(parameters?: MeshStandardMaterialParameters)
  color: Color
  map: Texture | null
  bumpMap: Texture | null
  roughness: number
  polygonOffset: boolean
}

export class MeshBasicMaterial extends Material {
  constructor(parameters?: {
    map?: Texture
    transparent?: boolean
    depthWrite?: boolean
  })
  map: Texture | null
}

export class ShadowMaterial extends Material {
  constructor(parameters?: { opacity?: number })
}

export interface IUniform<T> {
  value: T
}

export class ShaderMaterial<
  U extends Record<string, IUniform<unknown>> = Record<
    string,
    IUniform<unknown>
  >,
> extends Material {
  constructor(parameters: {
    glslVersion?: string
    vertexShader: string
    fragmentShader: string
    uniforms: U
    side?: number
    transparent?: boolean
    depthTest?: boolean
    depthWrite?: boolean
  })
  uniforms: U
  vertexShader: string
  fragmentShader: string
}

export class Mesh<
  G extends BufferGeometry = BufferGeometry,
  M extends Material | Material[] = Material | Material[],
> extends Object3D {
  constructor(geometry: G, material: M)
  geometry: G
  material: M
}

export class Camera extends Object3D {
  projectionMatrix: Matrix4
}

export class OrthographicCamera extends Camera {
  left: number
  right: number
  top: number
  bottom: number
  near: number
  far: number
}

export class PerspectiveCamera extends Camera {
  constructor(fov?: number, aspect?: number, near?: number, far?: number)
  fov: number
  aspect: number
  near: number
  far: number
  view: {
    fullWidth: number
    fullHeight: number
    offsetX: number
    offsetY: number
    width: number
    height: number
  } | null
  setViewOffset(
    fullWidth: number,
    fullHeight: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void
  updateProjectionMatrix(): void
}

export class Light extends Object3D {
  intensity: number
}

export class HemisphereLight extends Light {
  constructor(skyColor?: number, groundColor?: number, intensity?: number)
}

export class DirectionalLightShadow {
  mapSize: Vector2
  radius: number
  blurSamples: number
  bias: number
  camera: OrthographicCamera
}

export class DirectionalLight extends Light {
  constructor(color?: number, intensity?: number)
  shadow: DirectionalLightShadow
}

export class WebGLRenderer {
  constructor(parameters?: {
    antialias?: boolean
    alpha?: boolean
    powerPreference?: string
    preserveDrawingBuffer?: boolean
  })
  domElement: HTMLCanvasElement
  getContext(): WebGL2RenderingContext
  compileAsync(scene: Object3D, camera: Camera): Promise<Object3D>
  outputColorSpace: string
  toneMapping: number
  shadowMap: { enabled: boolean; type: number }
  capabilities: { getMaxAnisotropy(): number }
  setPixelRatio(ratio: number): void
  setClearColor(color: number, alpha: number): void
  setSize(width: number, height: number, updateStyle?: boolean): void
  setViewport(x: number, y: number, width: number, height: number): void
  setScissor(x: number, y: number, width: number, height: number): void
  setScissorTest(enabled: boolean): void
  clear(): void
  render(scene: Object3D, camera: Camera): void
}
