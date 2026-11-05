import { encodePreset } from '../encode'
import { LAB_CANDIDATES } from './candidates'
import { fixturePixels, LAB_SOURCE, type LabFixture } from './fixtures'
import {
  labTransferList,
  runLab,
  type LabRequest,
  type LabResponse,
  type LabSurface,
} from './runLab'

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<LabRequest>) => void) | null
  postMessage: (
    message: LabResponse,
    options?: { transfer?: Transferable[] },
  ) => void
}

/** Worker canvas surface: the product encoder, sRGB readback. */
const surface: LabSurface<ImageBitmap> = {
  source(fixture: LabFixture) {
    const { width, height } = LAB_SOURCE
    const pixels = fixturePixels(fixture, width, height)
    return createImageBitmap(new ImageData(pixels, width, height))
  },
  encode: encodePreset,
  async pixels(image, width, height) {
    const bitmap =
      image instanceof Blob
        ? await createImageBitmap(image)
        : await createImageBitmap(image, {
            resizeWidth: width,
            resizeHeight: height,
            resizeQuality: 'high',
          })
    try {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d', { colorSpace: 'srgb' })
      if (!ctx) {
        throw new Error('OffscreenCanvas 2d context unavailable')
      }
      ctx.drawImage(bitmap, 0, 0)
      return ctx.getImageData(0, 0, width, height).data
    } finally {
      bitmap.close()
    }
  },
}

workerScope.onmessage = (event: MessageEvent<LabRequest>) => {
  void runLab(event.data, LAB_CANDIDATES, surface).then((response) => {
    workerScope.postMessage(response, {
      transfer: labTransferList(response),
    })
  })
}
