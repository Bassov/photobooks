/* #/demo welcome stage: the welcome screen and its library-folder picker. Picking a folder opens the library (session). */
import * as React from "react"
import { WelcomeScreen } from "@/features/library"
import { FolderPicker } from "@/features/screens"
import { useSession } from "./session"

export function DemoWelcome({ initialPicking = false }: { initialPicking?: boolean } = {}) {
  const { set } = useSession()
  const [picking, setPicking] = React.useState(initialPicking)
  return <>
    <WelcomeScreen onCreate={() => setPicking(true)} />
    <FolderPicker isOpen={picking} title="Choose where your library lives" onCancel={() => setPicking(false)} onPick={(p) => { setPicking(false); set({ stage: "library", path: p }) /* v0.8.1 (P1-4): FolderPicker already returns ~/Pictures/<folder> */ }} />
  </>
}
