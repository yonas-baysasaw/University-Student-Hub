
import { FaGoogle } from "react-icons/fa";
import { useState } from "react";

const Signup = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !email || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, email, password })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Unable to create account.");
      }

      setSuccess("Account created. Please sign in.");
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      setError(error?.message || "Something went wrong, try again.");
    }
  };

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
          <p className="text-sm text-gray-500">Sign up to get started</p>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {(error || success) && (
            <div
              className={`text-sm px-3 py-2 rounded ${
                error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {error || success}
            </div>
          )}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3d5661] focus:border-transparent"
          />
          {/* password */}
          <div className="relative">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3d5661] focus:border-transparent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-gray-700">
              👁
            </span>
          </div>

             {/* Confirm password */}
          <div className="relative">
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3d5661] focus:border-transparent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-gray-700">
              👁
            </span>
          </div>
          {/* E-mail */}
           <input
            type="text"
            placeholder="E-mail address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3d5661] focus:border-transparent"
          />

          {/* Fixed Button */}
          <button type="submit" className="w-full h-11 mt-2 bg-[#3d5661] text-xl hover:bg-[#324952] transition-colors text-white   flex items-center justify-center">
            Sign Up
          </button>
        </form>

        {/* Links */}
        <div className="flex justify-between text-sm text-gray-500 mt-4">
          <span>Have an account?</span>
          <a
            href="/login"
            className="cursor-pointer hover:text-gray-700 hover:underline"
          >
            Sign in
          </a>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400">or you can sign in with</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Social Buttons */}
        <div className="flex justify-center gap-4">
          <a href="/api/auth/google" className="w-12 h-12 flex items-center justify-center border border-gray-300 rounded-full hover:bg-gray-100 transition" >
            <FaGoogle className="text-gray-600 text-lg" />
          </a>
        
        </div>
      </div>
    </div>
  );
};

export default Signup;
