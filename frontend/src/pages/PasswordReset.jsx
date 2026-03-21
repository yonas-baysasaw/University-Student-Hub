import { useState } from "react";

const PasswordReset = () => {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setStatus("")

    if (!email.trim()) {
      setError("Please enter your email.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: email.trim() })
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.message || "Unable to send reset link.")
      }

      setStatus("Check your inbox for a password reset link.")
    } catch (err) {
      console.error(err)
      setError(err.message || "Unable to send reset email.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-[380px] bg-white p-8 rounded-2xl shadow-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-gray-600">USH</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-800">
            University Student Hub
          </h2>
          <p className="text-sm text-gray-500">Sign in to continue</p>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3d5661] focus:border-transparent"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 bg-[#3d5661] text-xl hover:bg-[#324952] transition-colors text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? "Sending link..." : "Send reset link"}
          </button>

          {(error || status) && (
            <p
              className={`text-center text-sm mt-3 ${
                error ? "text-rose-500" : "text-emerald-500"
              }`}
            >
              {error || status}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default PasswordReset;
