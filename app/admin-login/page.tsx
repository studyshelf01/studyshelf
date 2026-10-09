"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError || !authData.user) {
        console.error("LOGIN ERROR:", authError);
        setMessage("Login failed. Please check your email and password.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, status, is_owner")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        console.error("PROFILE LOOKUP ERROR:", profileError);

        await supabase.auth.signOut();
        setMessage("Your account profile could not be verified. Please contact the owner.");
        return;
      }

      if (profile.status !== "active") {
        await supabase.auth.signOut();
        setMessage("Your account is not active. Please contact the owner.");
        return;
      }

      if (profile.role !== "admin") {
        await supabase.auth.signOut();
        setMessage("This login is for administrators only. Please use the student login.");
        return;
      }

      if (profile.is_owner === true) {
        router.replace("/owner");
      } else {
        router.replace("/admin");
      }
    } catch (error) {
      console.error("UNEXPECTED LOGIN ERROR:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl bg-white p-8 shadow-sm">
          <a
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to StudyShelf
          </a>

          <div className="mt-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              StudyShelf
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Admin Login
            </h1>

            <p className="mt-2 text-gray-600">
              Sign in to review submitted resources.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
              />
            </div>

            {message && (
              <div
                role="alert"
                className="rounded-lg bg-red-50 p-4 text-sm text-red-700"
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}