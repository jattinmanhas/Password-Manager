import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError, enableTOTP, login, logout, registerUser, setupTOTP, verifyTOTP } from "./api/client";
import { guessDeviceName } from "./device";

type View = "login" | "register";
type MFAMethod = "totp" | "recovery";

interface SessionState {
  token: string;
  expiresAt: string;
}

interface TOTPSetupState {
  secret: string;
  otpAuthURL: string;
}

const SESSION_STORAGE_KEY = "pmv2.session";

function readStoredSession(): SessionState | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed.token || !parsed.expiresAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(session: SessionState | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export default function App() {
  const [view, setView] = useState<View>("login");
  const [session, setSession] = useState<SessionState | null>(() => readStoredSession());

  const [notice, setNotice] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    name: "",
    masterPasswordHint: "",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    deviceName: "",
  });

  const [mfaStep, setMFAStep] = useState(false);
  const [mfaMethod, setMFAMethod] = useState<MFAMethod>("totp");
  const [totpCode, setTOTPCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");

  const [totpSetupState, setTOTPSetupState] = useState<TOTPSetupState | null>(null);
  const [totpActionCode, setTOTPActionCode] = useState("");
  const [freshRecoveryCodes, setFreshRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    setLoginForm((current) => {
      if (current.deviceName) return current;
      return { ...current, deviceName: guessDeviceName() };
    });
  }, []);

  const expiresAtLabel = useMemo(() => {
    if (!session) return "";
    const date = new Date(session.expiresAt);
    if (Number.isNaN(date.getTime())) return session.expiresAt;
    return date.toLocaleString();
  }, [session]);

  function clearFeedback(): void {
    setError("");
    setNotice("");
  }

  function completeLogin(nextSession: SessionState): void {
    setSession(nextSession);
    saveSession(nextSession);
    setMFAStep(false);
    setTOTPCode("");
    setRecoveryCode("");
    clearFeedback();
    setNotice("Logged in successfully.");
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    clearFeedback();

    try {
      await registerUser({
        email: registerForm.email,
        password: registerForm.password,
        name: registerForm.name || undefined,
        master_password_hint: registerForm.masterPasswordHint || undefined,
      });
      setNotice("Registration successful. Continue with login.");
      setView("login");
      setLoginForm((current) => ({ ...current, email: registerForm.email }));
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function handleLoginCredentials(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    clearFeedback();

    try {
      const output = await login({
        email: loginForm.email,
        password: loginForm.password,
        device_name: loginForm.deviceName || undefined,
      });
      completeLogin({ token: output.session_token, expiresAt: output.expires_at });
    } catch (err) {
      if (err instanceof ApiError && err.code === "mfa_required") {
        setMFAStep(true);
        setNotice("Password verified. Enter TOTP or a recovery code.");
        return;
      }
      setError(errorText(err));
    }
  }

  async function handleMFALogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    clearFeedback();

    const mfaInput = mfaMethod === "totp" ? totpCode.trim() : recoveryCode.trim();
    if (!mfaInput) {
      setError(mfaMethod === "totp" ? "Enter TOTP code." : "Enter recovery code.");
      return;
    }

    try {
      const output = await login({
        email: loginForm.email,
        password: loginForm.password,
        device_name: loginForm.deviceName || undefined,
        totp_code: mfaMethod === "totp" ? mfaInput : undefined,
        recovery_code: mfaMethod === "recovery" ? mfaInput : undefined,
      });
      completeLogin({ token: output.session_token, expiresAt: output.expires_at });
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function handleLogout(): Promise<void> {
    if (!session) return;
    clearFeedback();
    try {
      await logout(session.token);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSession(null);
      saveSession(null);
      setTOTPSetupState(null);
      setFreshRecoveryCodes([]);
      setNotice("Logged out.");
    }
  }

  async function handleTOTPSetup(): Promise<void> {
    if (!session) return;
    clearFeedback();
    try {
      const output = await setupTOTP(session.token);
      setTOTPSetupState({ secret: output.secret, otpAuthURL: output.otpauth_url });
      setNotice("TOTP secret created. Add this to your authenticator app, then enable.");
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function handleTOTPEnable(): Promise<void> {
    if (!session) return;
    clearFeedback();
    if (!totpActionCode.trim()) {
      setError("Enter TOTP code first.");
      return;
    }
    try {
      const output = await enableTOTP(session.token, totpActionCode.trim());
      setFreshRecoveryCodes(output.recovery_codes);
      setNotice("TOTP enabled. Save these recovery codes securely.");
      setTOTPActionCode("");
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function handleTOTPVerify(): Promise<void> {
    if (!session) return;
    clearFeedback();
    if (!totpActionCode.trim()) {
      setError("Enter TOTP code first.");
      return;
    }
    try {
      await verifyTOTP(session.token, totpActionCode.trim());
      setNotice("TOTP code verified.");
      setTOTPActionCode("");
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="badge">PMV2 Web Starter</p>
        <h1>Self-Hosted Auth Console</h1>
        <p className="lead">Credentials first, then MFA. Built for the current backend routes.</p>
      </section>

      {notice && <p className="message notice">{notice}</p>}
      {error && <p className="message error">{error}</p>}

      {!session ? (
        <section className="card">
          <div className="tabs">
            <button className={view === "login" ? "tab active" : "tab"} type="button" onClick={() => setView("login")}>
              Login
            </button>
            <button className={view === "register" ? "tab active" : "tab"} type="button" onClick={() => setView("register")}>
              Register
            </button>
          </div>

          {view === "register" ? (
            <form className="stack" onSubmit={handleRegister}>
              <label>
                Email
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                  required
                />
              </label>
              <label>
                Name (optional)
                <input
                  type="text"
                  value={registerForm.name}
                  onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
                />
              </label>
              <label>
                Master Password Hint (optional)
                <input
                  type="text"
                  value={registerForm.masterPasswordHint}
                  onChange={(event) => setRegisterForm({ ...registerForm, masterPasswordHint: event.target.value })}
                />
              </label>
              <button type="submit">Create Account</button>
            </form>
          ) : !mfaStep ? (
            <form className="stack" onSubmit={handleLoginCredentials}>
              <label>
                Email
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                  required
                />
              </label>
              <label>
                Device Name
                <input
                  type="text"
                  value={loginForm.deviceName}
                  onChange={(event) => setLoginForm({ ...loginForm, deviceName: event.target.value })}
                />
              </label>
              <button type="submit">Continue</button>
            </form>
          ) : (
            <form className="stack" onSubmit={handleMFALogin}>
              <p className="subtle">Second factor required for <strong>{loginForm.email}</strong>.</p>
              <div className="switch-row">
                <button
                  className={mfaMethod === "totp" ? "chip active" : "chip"}
                  type="button"
                  onClick={() => setMFAMethod("totp")}
                >
                  TOTP
                </button>
                <button
                  className={mfaMethod === "recovery" ? "chip active" : "chip"}
                  type="button"
                  onClick={() => setMFAMethod("recovery")}
                >
                  Recovery Code
                </button>
              </div>
              {mfaMethod === "totp" ? (
                <label>
                  TOTP Code
                  <input type="text" value={totpCode} onChange={(event) => setTOTPCode(event.target.value)} required />
                </label>
              ) : (
                <label>
                  Recovery Code
                  <input type="text" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} required />
                </label>
              )}
              <div className="actions">
                <button type="submit">Sign In</button>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => {
                    setMFAStep(false);
                    setTOTPCode("");
                    setRecoveryCode("");
                    clearFeedback();
                  }}
                >
                  Back
                </button>
              </div>
            </form>
          )}
        </section>
      ) : (
        <section className="card stack">
          <h2>Authenticated Session</h2>
          <p className="subtle">Expires: {expiresAtLabel}</p>
          <label>
            Session Token
            <textarea readOnly value={session.token} rows={3} />
          </label>

          <div className="actions">
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>

          <hr />

          <h3>TOTP Setup + Verification</h3>
          <div className="actions">
            <button type="button" onClick={handleTOTPSetup}>
              Create / Reset TOTP Secret
            </button>
          </div>

          {totpSetupState && (
            <div className="panel">
              <p className="subtle">Secret: {totpSetupState.secret}</p>
              <a href={totpSetupState.otpAuthURL} target="_blank" rel="noreferrer">
                Open OTPAuth URL
              </a>
            </div>
          )}

          <label>
            TOTP Code
            <input type="text" value={totpActionCode} onChange={(event) => setTOTPActionCode(event.target.value)} />
          </label>
          <div className="actions">
            <button type="button" onClick={handleTOTPEnable}>
              Enable TOTP
            </button>
            <button className="ghost" type="button" onClick={handleTOTPVerify}>
              Verify TOTP
            </button>
          </div>

          {freshRecoveryCodes.length > 0 && (
            <div className="panel">
              <h4>Recovery Codes (Show Once)</h4>
              <ul>
                {freshRecoveryCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    return `${err.code}: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unexpected error";
}
