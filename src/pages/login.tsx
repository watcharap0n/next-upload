import { useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context";
import Image from "next/image";
import { API_BASE_CLIENT } from "@/utils/api-config";

const API_BASE = API_BASE_CLIENT;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);

    try {
      const body = new URLSearchParams();
      body.append("grant_type", "password");
      body.append("username", username);
      body.append("password", password);
      if (clientId) body.append("client_id", clientId);
      if (clientSecret) body.append("client_secret", clientSecret);

      const res = await fetch(`${API_BASE}/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Login failed: ${res.status}`);
      }

      const tokens = await res.json();
      if (!tokens?.access_token) {
        throw new Error("No access_token returned from auth server");
      }

      login(username, tokens.access_token);
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/80 p-6 rounded shadow">
        <div className="flex items-center gap-3 mb-4">
          <Image src="/next.svg" alt="logo" width={90} height={20} />
          <h1 className="text-lg font-semibold">Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-sm">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="p-2 border rounded" />

          <label className="text-sm">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="p-2 border rounded" />

          <label className="text-sm">Client ID (optional)</label>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} className="p-2 border rounded" />

          <label className="text-sm">Client secret (optional)</label>
          <input value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="p-2 border rounded" />

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">{loading ? 'Signing in...' : 'Sign in'}</button>
            <button type="button" onClick={() => { setUsername('guest'); setPassword(''); login('guest'); router.push('/'); }} className="px-4 py-2 bg-gray-200 rounded">Continue as guest</button>
          </div>

          <p className="mt-3 text-sm text-gray-600">This will POST form-encoded credentials to {API_BASE}/auth/token. Use client_id/client_secret if required by your backend.</p>
        </form>
      </div>
    </div>
  );
}

