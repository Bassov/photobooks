import type { ReactElement } from 'react'
import App from '../App'
import { SpecimenPage } from './SpecimenPage'
import { isSpecimenQuery } from './specimenQuery'

/** Choose the React root for the Vite entry (specimen vs product). */
export function createRootTree(search: string): ReactElement {
  if (isSpecimenQuery(search)) {
    return <SpecimenPage />
  }
  return <App />
}
