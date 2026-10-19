import React from "react";
import { Text } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../../src/auth/AuthProvider";

jest.mock("../../src/auth/supabase", () => ({ createSupabase: jest.fn(), watchAppState: jest.fn(() => () => {}) }));
jest.mock("../../src/api/client", () => ({ configureApi: jest.fn() }));
import { configureApi } from "../../src/api/client";

const URL_CONFIG = { mode: "supabase" as const, url: "https://x.supabase.co", publishableKey: "sb_publishable_x" };
const session = (email: string) => ({ access_token: "t", user: { id: `id-${email}`, email } });

function fakeClient(initial: ReturnType<typeof session> | null = null) {
  let listener: (event: string, s: unknown) => void = () => {};
  const unsubscribe = jest.fn();
  const auth = {
    getSession: jest.fn(async () => ({ data: { session: initial }, error: null })),
    onAuthStateChange: jest.fn((cb: typeof listener) => { listener = cb; return { data: { subscription: { unsubscribe } } }; }),
    signInWithOtp: jest.fn(async () => ({ data: { user: null, session: null }, error: null as unknown })),
    verifyOtp: jest.fn(async ({ email }: { email: string }) => {
      const s = session(email);
      listener("SIGNED_IN", s);
      return { data: { session: s, user: s.user }, error: null as unknown };
    }),
    signInWithPassword: jest.fn(async ({ email }: { email: string }) => {
      const s = session(email);
      listener("SIGNED_IN", s);
      return { data: { session: s, user: s.user }, error: null as unknown };
    }),
    signOut: jest.fn(async () => { listener("SIGNED_OUT", null); return { error: null as unknown }; }),
  };
  return { auth, unsubscribe, emit: (e: string, s: unknown) => listener(e, s) };
}

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <Text>{`${api.status}|${api.email ?? "-"}|${api.userId ?? "-"}`}</Text>;
}

function renderWith(props: Partial<React.ComponentProps<typeof AuthProvider>>) {
  return render(<AuthProvider {...props}><Probe /></AuthProvider>);
}

test("local mode never touches Supabase", async () => {
  const client = fakeClient();
  renderWith({ config: { mode: "local" }, client: client as never });
  expect(screen.getByText("local|-|-")).toBeTruthy();
  expect(client.auth.getSession).not.toHaveBeenCalled();
});

test("unconfigured builds report it", () => {
  renderWith({ config: { mode: "unconfigured", reason: "missing" } });
  expect(screen.getByText("unconfigured|-|-")).toBeTruthy();
  expect(api.reason).toBe("missing");
});

test("no stored session → signed out", async () => {
  renderWith({ config: URL_CONFIG, client: fakeClient() as never });
  expect(screen.getByText("loading|-|-")).toBeTruthy();
  expect(await screen.findByText("signedOut|-|-")).toBeTruthy();
});

test("a stored session survives a restart → signed in", async () => {
  renderWith({ config: URL_CONFIG, client: fakeClient(session("a@b.com")) as never });
  expect(await screen.findByText("signedIn|a@b.com|id-a@b.com")).toBeTruthy();
});

test("sendCode normalizes the email and asks Supabase for a code", async () => {
  const client = fakeClient();
  renderWith({ config: URL_CONFIG, client: client as never });
  await screen.findByText("signedOut|-|-");
  await act(() => api.sendCode(" A@B.com "));
  expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: "a@b.com" });
});

test("sendCode failures reject with a readable message", async () => {
  const client = fakeClient();
  client.auth.signInWithOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: Object.assign(new Error("x"), { status: 429 }) });
  renderWith({ config: URL_CONFIG, client: client as never });
  await screen.findByText("signedOut|-|-");
  await expect(api.sendCode("a@b.com")).rejects.toThrow("Too many codes requested. Wait a minute and try again.");
});

test("verifyCode signs in", async () => {
  const client = fakeClient();
  renderWith({ config: URL_CONFIG, client: client as never });
  await screen.findByText("signedOut|-|-");
  await act(() => api.verifyCode("A@b.com", "123456"));
  expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: "a@b.com", token: "123456", type: "email" });
  expect(screen.getByText("signedIn|a@b.com|id-a@b.com")).toBeTruthy();
});

test("a wrong code rejects and stays signed out", async () => {
  const client = fakeClient();
  client.auth.verifyOtp.mockResolvedValueOnce({ data: { session: null, user: null } as never, error: Object.assign(new Error("x"), { status: 403, code: "otp_expired" }) });
  renderWith({ config: URL_CONFIG, client: client as never });
  await screen.findByText("signedOut|-|-");
  await expect(api.verifyCode("a@b.com", "000000")).rejects.toThrow("That code is wrong or has expired. Check the email or send a new code.");
  expect(screen.getByText("signedOut|-|-")).toBeTruthy();
});

test("signInWithPassword signs in with the normalized email", async () => {
  const client = fakeClient();
  renderWith({ config: URL_CONFIG, client: client as never });
  await screen.findByText("signedOut|-|-");
  await act(() => api.signInWithPassword(" Review@B.com ", "pw"));
  expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: "review@b.com", password: "pw" });
  expect(screen.getByText("signedIn|review@b.com|id-review@b.com")).toBeTruthy();
});

test("a wrong password rejects and stays signed out", async () => {
  const client = fakeClient();
  client.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null } as never, error: Object.assign(new Error("x"), { status: 400, code: "invalid_credentials" }) });
  renderWith({ config: URL_CONFIG, client: client as never });
  await screen.findByText("signedOut|-|-");
  await expect(api.signInWithPassword("a@b.com", "nope")).rejects.toThrow("That email and password don't match.");
  expect(screen.getByText("signedOut|-|-")).toBeTruthy();
});

test("signOut signs out", async () => {
  const client = fakeClient(session("a@b.com"));
  renderWith({ config: URL_CONFIG, client: client as never });
  await screen.findByText("signedIn|a@b.com|id-a@b.com");
  await act(() => api.signOut());
  expect(screen.getByText("signedOut|-|-")).toBeTruthy();
});

test("signOut while offline still signs out on this device", async () => {
  const client = fakeClient(session("a@b.com"));
  client.auth.signOut
    .mockResolvedValueOnce({ error: Object.assign(new Error("offline"), { name: "AuthRetryableFetchError", status: 0 }) })
    .mockResolvedValueOnce({ error: null });
  renderWith({ config: URL_CONFIG, client: client as never });
  await screen.findByText("signedIn|a@b.com|id-a@b.com");
  await act(() => api.signOut());
  expect(client.auth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
  expect(screen.getByText("signedOut|-|-")).toBeTruthy();
});

test("a session ended elsewhere (refresh failed) signs the app out", async () => {
  const client = fakeClient(session("a@b.com"));
  renderWith({ config: URL_CONFIG, client: client as never });
  await screen.findByText("signedIn|a@b.com|id-a@b.com");
  act(() => client.emit("SIGNED_OUT", null));
  expect(screen.getByText("signedOut|-|-")).toBeTruthy();
});

test("unmounting unsubscribes", async () => {
  const client = fakeClient();
  const view = renderWith({ config: URL_CONFIG, client: client as never });
  await waitFor(() => expect(client.auth.onAuthStateChange).toHaveBeenCalled());
  view.unmount();
  expect(client.unsubscribe).toHaveBeenCalled();
});


describe("account API wiring", () => {
  beforeEach(() => (configureApi as jest.Mock).mockClear());

  test("signed in: the API gets the session's current token", async () => {
    const client = fakeClient(session("a@b.com"));
    renderWith({ config: URL_CONFIG, client: client as never });
    await screen.findByText("signedIn|a@b.com|id-a@b.com");
    const config = (configureApi as jest.Mock).mock.calls.at(-1)[0];
    client.auth.getSession.mockResolvedValueOnce({ data: { session: { ...session("a@b.com"), access_token: "fresh" } }, error: null } as never);
    await expect(config.getToken()).resolves.toBe("fresh");
  });

  test("an expired session reported by the API signs out", async () => {
    const client = fakeClient(session("a@b.com"));
    renderWith({ config: URL_CONFIG, client: client as never });
    await screen.findByText("signedIn|a@b.com|id-a@b.com");
    await act(async () => (configureApi as jest.Mock).mock.calls.at(-1)[0].onUnauthorized());
    expect(screen.getByText("signedOut|-|-")).toBeTruthy();
  });

  test("signing out disconnects the API", async () => {
    const client = fakeClient(session("a@b.com"));
    renderWith({ config: URL_CONFIG, client: client as never });
    await screen.findByText("signedIn|a@b.com|id-a@b.com");
    await act(() => api.signOut());
    expect((configureApi as jest.Mock).mock.calls.at(-1)[0]).toBeNull();
  });

  test("local mode never configures the account API", () => {
    renderWith({ config: { mode: "local" } });
    expect((configureApi as jest.Mock).mock.calls.every(([c]) => c === null)).toBe(true);
  });
});
