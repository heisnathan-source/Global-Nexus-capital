"use client";

import Link from "next/link";
import {
  Suspense,
  useEffect,
  useState,
} from "react";
import {
  useSearchParams,
  useRouter,
} from "next/navigation";

function RegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const referralFromUrl =
    searchParams.get("ref") || "";

  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    confirmPassword: "",
    referralCode: referralFromUrl,
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (referralFromUrl) {
      setForm((current) => ({
        ...current,
        referralCode: referralFromUrl,
      }));
    }
  }, [referralFromUrl]);

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function register(e) {
    e.preventDefault();

    setError("");

    if (!form.name.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    if (!form.password) {
      setError("Password is required.");
      return;
    }

    if (
      form.password !==
      form.confirmPassword
    ) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (!form.referralCode.trim()) {
      setError("Referral code is required.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        "/api/auth/register",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            name: form.name,
            phone: form.phone,
            password: form.password,
            confirmPassword:
              form.confirmPassword,
            referralCode:
              form.referralCode,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create account."
        );
      }

      /*
       * The API has already created the
       * session cookie, so send the user
       * directly to the Global Nexus Capital homepage.
       */
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err.message ||
          "Unable to create account."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">

        <img
          src="/cmc-login-logo.jpeg"
          alt="Global Nexus Capital"
          className="cmc-auth-logo"
        />

        <div className="auth-heading">

          <div className="eyebrow">
            Global Nexus Capital
          </div>

          <h1>
            Create your account
          </h1>

          <p className="muted">
            Register your Global Nexus Capital account using
            your phone number.
          </p>

        </div>

        <form
          className="auth-form"
          onSubmit={register}
        >

          <label>
            Full name

            <input
              required
              autoComplete="name"
              placeholder="Government/registered name"
              value={form.name}
              onChange={(e) =>
                update(
                  "name",
                  e.target.value
                )
              }
            />

          </label>

          <label>
            Phone number

            <input
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. 024 123 4567"
              value={form.phone}
              onChange={(e) =>
                update(
                  "phone",
                  e.target.value
                )
              }
            />

          </label>

          <label>
            Password

            <div className="password-input-wrap">

              <input
                required
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                placeholder="Create a password"
                value={form.password}
                onChange={(e) =>
                  update(
                    "password",
                    e.target.value
                  )
                }
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                title={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword
                  ? "🙈"
                  : "👁️"}
              </button>

            </div>

          </label>

          <label>
            Confirm password

            <div className="password-input-wrap">

              <input
                required
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={
                  form.confirmPassword
                }
                onChange={(e) =>
                  update(
                    "confirmPassword",
                    e.target.value
                  )
                }
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword(
                    (current) =>
                      !current
                  )
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
                title={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showConfirmPassword
                  ? "🙈"
                  : "👁️"}
              </button>

            </div>

          </label>

          <label>
            Referral code

            <input
              required
              autoComplete="off"
              placeholder="Enter your referral code"
              value={
                form.referralCode
              }
              onChange={(e) =>
                update(
                  "referralCode",
                  e.target.value.toUpperCase()
                )
              }
            />

          </label>

          <p className="muted">
            A valid referral code is required
            to create a Global Nexus Capital account.
          </p>

          {error && (
            <p className="auth-error">
              {error}
            </p>
          )}

          <button
            className="auth-primary"
            type="submit"
            disabled={busy}
          >
            {busy
              ? "Creating account…"
              : "Create Account"}
          </button>

        </form>

        <p className="auth-security-note">
          Funds Password is created later in
          Account Security. It is not collected
          during registration.
        </p>

        <Link
          href="/login"
          className="text-link"
        >
          Already have an account? Sign in
        </Link>

      </section>
    </main>
  );
}

export default function Register() {
  return (
    <Suspense
      fallback={<div>Loading...</div>}
    >
      <RegisterForm />
    </Suspense>
  );
}
