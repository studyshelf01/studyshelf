"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function StudentLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");
    setIsLoggingIn(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Student login error:", error);
      setMessage("Login failed. Please check your email and password.");
      setIsLoggingIn(false);
      return;
    }

    router.push("/");
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8">
          <a
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to StudyShelf
          </a>

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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500"
            />
          </div>

          {message && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isLoggingIn ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </main>
  );
}