/** Lab run for one fixture: encode each candidate, decode it back, score it. */
import type { DerivativePreset } from '../plan'
import type { LabResult } from './candidates'
import type { LabFixture } from './fixtures'
import { lumaPlane, maxBandStep, meanSsim } from './metrics'

/** Browser surface (worker canvas + encoder); doubles in unit tests. */
export interface LabSurface<B extends { close(): void }> {
  /** Fixture raster at the lab source size. */
  source(fixture: LabFixture): Promise<B>
  /** Same resize + encode as the product derivative worker. */
  encode(
    source: B,
    preset: DerivativePreset,
  ): Promise<{
    bytes: ArrayBuffer
    mimeType: string
    width: number
    height: number
  }>
  /** RGBA of `image` drawn at `width`×`height` with a high-quality resize. */
  pixels(
    image: B | Blob,
    width: number,
    height: number,
  ): Promise<Uint8ClampedArray>
}

export interface LabVariant extends LabResult {
  bytes: ArrayBuffer
  mimeType: string
}

export interface LabRequest {
  fixture: LabFixture
}

export type LabResponse =
  | { fixture: LabFixture; ok: true; variants: LabVariant[] }
  | { fixture: LabFixture; ok: false; error: string }

/**
 * Scores every candidate against the unencoded resize of the fixture at the
 * same size (one reference per output size), in candidate order.
 */
export async function runLab<B extends { close(): void }>(
  request: LabRequest,
  candidates: readonly DerivativePreset[],
  surface: LabSurface<B>,
): Promise<LabResponse> {
  const { fixture } = request
  let source: B | undefined
  try {
    source = await surface.source(fixture)
    const references = new Map<string, Float32Array>()
    const variants: LabVariant[] = []
    for (const preset of candidates) {
      const encoded = await surface.encode(source, preset)
      const { width, height } = encoded
      const sizeKey = `${String(width)}x${String(height)}`
      let reference = references.get(sizeKey)
      if (!reference) {
        reference = lumaPlane(await surface.pixels(source, width, height))
        references.set(sizeKey, reference)
      }
      const blob = new Blob([encoded.bytes], { type: encoded.mimeType })
      const decoded = lumaPlane(await surface.pixels(blob, width, height))
      variants.push({
        fixture,
        preset,
        width,
        height,
        byteLength: encoded.bytes.byteLength,
        ssim: meanSsim(reference, decoded, width, height),
        bandStep: maxBandStep(reference, decoded, width, height),
        bytes: encoded.bytes,
        mimeType: encoded.mimeType,
      })
    }
    return { fixture, ok: true, variants }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { fixture, ok: false, error: message }
  } finally {
    source?.close()
  }
}

/** Encoded buffers move to the page without a copy. */
export function labTransferList(response: LabResponse): Transferable[] {
  return response.ok ? response.variants.map((variant) => variant.bytes) : []
}
