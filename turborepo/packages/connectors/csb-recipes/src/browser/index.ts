import type { SandboxClient } from "@codesandbox/sdk/browser";
import {
  connectToSandbox as sdkConnectToSandbox,
  createPreview as sdkCreatePreview,
} from "@codesandbox/sdk/browser";

export type ConnectToSandboxOptions = Omit<
  Parameters<typeof sdkConnectToSandbox>[0],
  "getSession"
> & {
  getSession?: Parameters<typeof sdkConnectToSandbox>[0]["getSession"];
};
export type BrowserSandboxClient = SandboxClient;
export type BrowserPreview = ReturnType<typeof sdkCreatePreview>;
type SandboxSession = NonNullable<ConnectToSandboxOptions["session"]>;

export async function connectToSandbox(
  options: ConnectToSandboxOptions
): Promise<BrowserSandboxClient> {
  const getSession =
    options.getSession ??
    (options.session ? createStaticSessionGetter(options.session) : undefined);
  if (!getSession) {
    throw new Error(
      "connectToSandbox requires either `session` or `getSession`."
    );
  }
  return sdkConnectToSandbox({
    ...options,
    getSession,
  });
}

export function createPreview(src: string): BrowserPreview {
  return sdkCreatePreview(src);
}

export * from "@codesandbox/sdk/browser";

export function createStaticSessionGetter(session: SandboxSession) {
  return async () => session;
}

export function createVisibilityFocusHandler(): NonNullable<
  ConnectToSandboxOptions["onFocusChange"]
> {
  return (notify) => {
    const onVisibilityChange = () => {
      notify(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  };
}
