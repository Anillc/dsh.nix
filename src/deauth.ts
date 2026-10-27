import type { Context } from '@deepseek-ai/cordis'

export const name = 'deauth'

export const inject = ['connection']

export function apply(ctx: Context) {
  ctx.effect(() => {
    const connection = (ctx as any).connection
    const auth = connection.browserAuth
    const isAuthenticated = () => true
    const authorizeIndex = () => true
    const rejection = () => undefined

    auth.isAuthenticated = isAuthenticated
    auth.authorizeIndex = authorizeIndex
    connection.requestRejection = rejection

    return () => {
      if (auth.isAuthenticated === isAuthenticated) delete auth.isAuthenticated
      if (auth.authorizeIndex === authorizeIndex) delete auth.authorizeIndex
      if (connection.requestRejection === rejection) delete connection.requestRejection
    }
  })
}
