import {
  attachOpfsTestLibrary,
  startSessionEditor,
  tryRestore,
} from '../editor/projectSession'
import { loadPainterFixture } from './loadPainterFixture'

/** `?fixture=painter`: open the editor on the painter fixture book. */
export function enterPainterFixture(): void {
  startSessionEditor()
  loadPainterFixture()
}

/** `?testLibrary`: restore the session library or attach an OPFS test one. */
export async function enterTestLibrary(): Promise<void> {
  const restored = await tryRestore()
  if (restored.ok && restored.value !== null) {
    return
  }
  await attachOpfsTestLibrary()
}
