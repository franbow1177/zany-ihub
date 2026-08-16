export type ZeroContext = {
  userID: string
  requestID?: string
}

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    context: ZeroContext | undefined
  }
}
