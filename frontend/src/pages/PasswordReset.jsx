
import { FaGoogle} from "react-icons/fa";
import { useState } from "react";

const PasswordReset =() => {
    const [email, setEmail] = useState("")
    

    const handleSubmit = async(e)=>{
      e.preventDefault()
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers:{
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email})
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
            placeholder="email or Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3d5661] focus:border-transparent"
          />

          <button type="submit" className="w-full h-11 mt-2 bg-[#3d5661] text-xl hover:bg-[#324952] transition-colors text-white   flex items-center justify-center">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordReset;
