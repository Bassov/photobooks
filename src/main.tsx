import '../styles/app.css'
import { configureProjectSession } from './editor/projectSession'
import { createBrowserProjectSessionDeps } from './editor/session/browserProjectSessionPlatform'
import { mountPhotobooks } from './ui/mountPhotobooks'

mountPhotobooks({
  configureSession: configureProjectSession,
  createSessionDeps: createBrowserProjectSessionDeps,
})
