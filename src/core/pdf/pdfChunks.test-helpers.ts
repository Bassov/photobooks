/** Collects a streamed PDF: `onChunk` for the writer, `bytes()` joins the file. */
export function pdfChunks() {
  const chunks: Uint8Array[] = []
  return {
    chunks,
    onChunk: (chunk: Uint8Array) => {
      chunks.push(chunk)
    },
    bytes: (): Uint8Array => {
      const file = new Uint8Array(
        chunks.reduce((size, chunk) => size + chunk.length, 0),
      )
      let at = 0
      for (const chunk of chunks) {
        file.set(chunk, at)
        at += chunk.length
      }
      return file
    },
  }
}
