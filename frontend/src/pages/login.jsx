
import { FaGoogle} from "react-icons/fa";
import { useState } from "react";

const SignIn =() => {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    const handleSubmit = async(e)=>{
      e.preventDefault()
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers:{
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ username, password })
        })
      } catch (error) {
        console.error(error)
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
            type="text"
            placeholder="Username or Email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3d5661] focus:border-transparent"
          />

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

          {/* Fixed Button */}
          <button type="submit" className="w-full h-11 mt-2 bg-[#3d5661] text-xl hover:bg-[#324952] transition-colors text-white   flex items-center justify-center">
            Sign In
          </button>
        </form>

        {/* Links */}
        <div className="flex justify-between text-sm text-gray-500 mt-4">
          <a href="/password/reset" className="cursor-pointer hover:text-gray-700 hover:underline">
            Forgot Password?
          </a>
          <span className="cursor-pointer hover:text-gray-700 hover:underline">
            <a href="/signup">Sign Up</a>
          </span>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400">or</span>
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

export default SignIn;
