"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (res.ok) {
        router.push("/app/session");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid passcode");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">Poker Coach OS</h1>
        <p className="text-gray-400 text-center mb-8 text-sm">Table Sim</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="passcode" className="block text-sm font-medium text-gray-300 mb-1">
              Passcode
            </label>
            <input
              id="passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !passcode}
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 font-semibold text-lg transition-colors"
          >
            {loading ? "..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
