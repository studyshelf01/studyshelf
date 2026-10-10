"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function StudentLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "info">("error");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setMessageType("error");
    setIsLoggingIn(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        setMessage(
          error?.message.toLowerCase().includes("email not confirmed")
            ? "Please confirm your email using the link we sent before logging in."
            : "Login failed. Please check your email and password."
        );
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(
          "role, status, application_rejection_reason"
        )
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setMessage(
          "We couldn't verify your student profile. Please contact an administrator."
        );
        return;
      }

      if (profile.role !== "student") {
        await supabase.auth.signOut();
        setMessage("This login is for student accounts only.");
        return;
      }

      if (
        profile.status === "pending" ||
        profile.status === "rejected"
      ) {
        router.push("/application-status");
        router.refresh();
        return;
      }

      if (profile.status !== "active") {
        await supabase.auth.signOut();
        setMessage(
          "Your account is not active. Please contact an administrator."
        );
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to StudyShelf
          </Link>

          <h1 className="mt-6 text-4xl font-bold text-gray-900">
            Student Login
          </h1>

          <p className="mt-2 text-gray-600">
            Log in to access your StudyShelf account.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-6 rounded-2xl bg-white p-8 shadow-sm"
        >
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
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

          {message && (
            <div
              role="alert"
              className={`rounded-lg p-4 text-sm ${
                messageType === "info"
                  ? "bg-blue-50 text-blue-800"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isLoggingIn ? "Checking account..." : "Log In"}
          </button>

          <div className="border-t border-gray-100 pt-5 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?
            </p>

            <Link
              href="/student-signup"
              className="mt-2 inline-block font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Sign up for StudyShelf →
            </Link>
          </div>
        </form>

        <div className="mt-6 border-t border-gray-200 pt-5 text-center">
          <p className="text-sm text-gray-600">
            Are you an administrator?
          </p>

          <Link
            href="/admin-login"
            className="mt-2 inline-block font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            Admin Login →
          </Link>
        </div>
      </div>
    </main>
  );
}
