/* The kit has no @types/three: the vendored r170 build is typed loosely, only the names `gl/` uses. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Ctor = new (...args: any[]) => any
export const REVISION: string
export const WebGLRenderer: Ctor
export const Scene: Ctor
export const Group: Ctor
export const Mesh: Ctor
export const BoxGeometry: Ctor
export const CylinderGeometry: Ctor
export const PlaneGeometry: Ctor
export const MeshStandardMaterial: Ctor
export const MeshBasicMaterial: Ctor
export const CanvasTexture: Ctor
export const HemisphereLight: Ctor
export const DirectionalLight: Ctor
export const PerspectiveCamera: Ctor
export const Vector3: Ctor
export const SRGBColorSpace: string
export const NoToneMapping: number
export const LinearMipmapLinearFilter: number
export const DoubleSide: number
