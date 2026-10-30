import React, { useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { CheckCircle2, LogOut, MailCheck, ShieldCheck, UserCheck } from 'lucide-react';
import {
  UserPrivateContactDoc,
  UserProfileDoc,
  auth,
  ensureUserProfileDocument,
  getUserPrivateContact,
  googleProvider,
  saveUserPrivateContact,
  updateUserAccountTier,
} from '../lib/firebase';
import { BLUEPRINT_CONSTRAINTS, sanitizeText } from '../data/catalog';

interface AuthViewsProps {
  user: User | null;
  initialMode?: 'signin' | 'signup';
  onAuthSuccess?: () => void;
}

export function AuthViews({ user, initialMode = 'signin', onAuthSuccess }: AuthViewsProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountTier, setAccountTier] = useState<'residential' | 'commercial'>('residential');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [consoleProviderHint, setConsoleProviderHint] = useState(false);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);

  // Authenticated profile state
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [contact, setContact] = useState<UserPrivateContactDoc | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    let cancelled = false;
    async function hydrateUser() {
      if (!user || !user.emailVerified) {
        setProfile(null);
        setContact(null);
        return;
      }
      try {
        const prof = await ensureUserProfileDocument(user);
        const priv = await getUserPrivateContact(user.uid);
        if (!cancelled) {
          setProfile(prof);
          if (prof?.accountTier) setAccountTier(prof.accountTier);
          setContact(priv);
          if (priv) {
            setPhoneInput(priv.phone);
            setAddressInput(priv.shippingAddress);
            setCityInput(priv.city);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    void hydrateUser();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleGoogleAuth = async () => {
    setBusy(true);
    setErrorMsg(null);
    setConsoleProviderHint(false);
    setInfoBanner(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureUserProfileDocument(cred.user, cred.user.displayName || undefined, accountTier);
      onAuthSuccess?.();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Google sign-in window was closed before completing authentication.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in with Google.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setConsoleProviderHint(false);
    setInfoBanner(null);

    const trimmedEmail = sanitizeText(email, BLUEPRINT_CONSTRAINTS.EMAIL_MAX);
    if (!trimmedEmail.includes('@') || trimmedEmail.length < 5) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      if (sanitizeText(fullName, BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX).length < 2) {
        setErrorMsg('Please enter your full name (at least 2 characters).');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const cleanName = sanitizeText(fullName, BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX);
        await updateProfile(cred.user, { displayName: cleanName });
        await sendEmailVerification(cred.user);
        setInfoBanner(
          'Account created! A verification link has been sent to your email. Verify your email to unlock Firestore order & telemetry storage, or sign in directly with Google.'
        );
      } else {
        const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        if (cred.user.emailVerified) {
          await ensureUserProfileDocument(cred.user);
          onAuthSuccess?.();
        } else {
          setInfoBanner('Signed in. Please verify your email address to store orders in Firestore.');
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setConsoleProviderHint(true);
        setErrorMsg(
          'Email/Password sign-in is not yet enabled on this Firebase project. Use Google Sign-In above immediately, or follow the 3-step console guide below to enable Email/Password.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErrorMsg('Incorrect email or password. Please check your credentials or create an account.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg('An account already exists with this email. Switch to Sign In.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDeliveryProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified) return;
    setErrorMsg(null);
    setInfoBanner(null);

    if (phoneInput.trim().length < 5 || addressInput.trim().length < 3 || cityInput.trim().length < 2) {
      setErrorMsg('Please complete phone number, street address, and city.');
      return;
    }

    setSavingContact(true);
    try {
      await ensureUserProfileDocument(user, profile?.displayName, accountTier);
      await updateUserAccountTier(
        user.uid,
        profile?.displayName || user.displayName || 'Ebygam Customer',
        accountTier
      );
      await saveUserPrivateContact(user.uid, {
        email: user.email || 'customer@ebygamsolar.com',
        phone: phoneInput,
        shippingAddress: addressInput,
        city: cityInput,
      });
      const updated = await getUserPrivateContact(user.uid);
      setContact(updated);
      setInfoBanner('Account tier and encrypted delivery profile saved to Firestore.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update delivery profile.');
    } finally {
      setSavingContact(false);
    }
  };

  if (user) {
    return (
      <section className="max-w-[960px] mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Customer Account · {user.emailVerified ? 'Verified Identity' : 'Pending Email Verification'}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              {profile?.displayName || user.displayName || user.email || 'Ebygam Solar Member'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {!user.emailVerified && (
          <div className="mt-6 p-5 rounded-xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <MailCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Verify your email address</h2>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Zero-trust database rules require a verified email before saving orders or delivery PII. Click the link sent to your inbox, then refresh below.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await sendEmailVerification(user);
                  setInfoBanner('Verification email re-sent.');
                }}
                className="px-3 py-2 text-xs font-medium text-sky-700 bg-white border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors whitespace-nowrap cursor-pointer"
              >
                Resend Link
              </button>
              <button
                type="button"
                onClick={async () => {
                  await reload(user);
                  if (auth.currentUser?.emailVerified) {
                    await ensureUserProfileDocument(auth.currentUser);
                    setInfoBanner('Email verified! Your account now has full database access.');
                  } else {
                    setErrorMsg('Email is not marked verified yet. Please check your inbox.');
                  }
                }}
                className="px-3 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Refresh Status
              </button>
            </div>
          </div>
        )}

        {infoBanner && (
          <div className="mt-6 p-4 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
            <span>{infoBanner}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSaveDeliveryProfile} className="mt-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Solar Installation & Delivery Profile</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Stored in split-collection isolated path <span className="font-mono">/users/&#123;uid&#125;/private/contact</span>
              </p>
            </div>
            {contact && (
              <span className="text-xs font-medium text-sky-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Saved in Firestore
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Installation Classification
            </label>
            <div className="inline-flex p-1 bg-slate-100 rounded-lg">
              {(['residential', 'commercial'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setAccountTier(tier)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                    accountTier === tier
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tier} Solar
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="acc-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Delivery Phone Number
              </label>
              <input
                id="acc-phone"
                type="tel"
                maxLength={BLUEPRINT_CONSTRAINTS.PHONE_MAX}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+234 803 000 0000"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
              />
            </div>
            <div>
              <label htmlFor="acc-city" className="block text-xs font-semibold text-slate-700 mb-1.5">
                City / Region
              </label>
              <input
                id="acc-city"
                type="text"
                maxLength={BLUEPRINT_CONSTRAINTS.CITY_MAX}
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Lagos, Victoria Island"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="acc-address" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Street Delivery Address
            </label>
            <input
              id="acc-address"
              type="text"
              maxLength={BLUEPRINT_CONSTRAINTS.ADDRESS_MAX}
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="Plot 14 Admiralty Road"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingContact || !user.emailVerified}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {savingContact ? 'Saving Profile...' : 'Save Delivery Details'}
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="max-w-[1080px] mx-auto px-4 sm:px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Architectural Context Column */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-sky-700">Ebygam Solar Customer Portal</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 leading-tight [text-wrap:balance]">
              Manage your clean energy hardware & live telemetry
            </h1>
            <p className="text-sm text-slate-600 mt-4 leading-relaxed">
              Create an Ebygam Solar account or sign in to purchase N-Type solar panels, LiFePO4 batteries, hybrid inverters, rolling solar generators, and DC rechargeable fans with verified payment protection.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 space-y-4 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <UserCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>Instant verified orders and saved shipping profiles isolated per account owner.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>Persist custom 500W–650W panel, 5–15kWh battery, and 1.2–5kW hybrid inverter dashboard presets.</span>
            </div>
          </div>
        </div>

        {/* Right Sign In / Create Account Card */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="inline-flex p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                }}
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
            <span className="text-xs text-slate-500">Tier 2 Secured Auth</span>
          </div>

          {/* Primary Google Sign-In Button */}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleGoogleAuth()}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#0284C7"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#0369A1"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#475569"
                d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
              />
              <path
                fill="#0F172A"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            <span>{mode === 'signup' ? 'Sign up with Google (Instant Verified)' : 'Sign in with Google'}</span>
          </button>

          <div className="relative my-6 flex items-center">
            <div className="grow border-t border-slate-200" />
            <span className="px-3 text-xs text-slate-400">or continue with email</span>
            <div className="grow border-t border-slate-200" />
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
              {errorMsg}
            </div>
          )}

          {consoleProviderHint && (
            <div className="mb-5 p-4 rounded-lg bg-sky-50 border border-sky-200 text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-slate-900">How to enable Email/Password in Firebase Console:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open Firebase Console for project <span className="font-mono">coastal-ruler-5nj8s</span>.</li>
                <li>Navigate to <span className="font-medium">Build &rarr; Authentication &rarr; Sign-in method</span>.</li>
                <li>Click <span className="font-medium">Add new provider &rarr; Email/Password</span>, toggle Enable, and click Save.</li>
              </ol>
            </div>
          )}

          {infoBanner && (
            <div className="mb-5 p-3.5 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900 leading-relaxed">
              {infoBanner}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="auth-fullname" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    maxLength={BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Chinedu Okafor"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Account Type
                  </span>
                  <div className="inline-flex p-1 bg-slate-100 rounded-lg">
                    {(['residential', 'commercial'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAccountTier(t)}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                          accountTier === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                maxLength={BLUEPRINT_CONSTRAINTS.EMAIL_MAX}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
              />
            </div>

            <div className={mode === 'signup' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
              <div>
                <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-confirm" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    id="auth-confirm"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {busy
                ? 'Authenticating...'
                : mode === 'signup'
                ? 'Create Ebygam Solar Account'
                : 'Sign In to Ebygam Solar'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
