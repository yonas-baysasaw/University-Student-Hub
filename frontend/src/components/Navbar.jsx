import { useAuth } from '../contexts/AuthContext';

function Navbar() {
  const { user } = useAuth();
  const photoUrl =
    user?.photo ||
    user?.profile?.photos?.[0]?.value ||
    "https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp";

  const displayName = user ? user.displayName ?? user.username ?? "Profile" : "Profile";

  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="flex-1">
        <a className="btn btn-ghost text-xl">University Student Hub</a>
      </div>
      <div className="flex gap-2 items-center">
        <input type="text" placeholder="Search" className="input input-bordered w-24 md:w-auto" />
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
            <div className="w-10 h-10 rounded-full overflow-hidden">
              <img alt={`${displayName} avatar`} src={photoUrl} />
            </div>
          </div>
          <ul
            tabIndex="-1"
            className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow"
          >
            <li>
              <a className="justify-between">
                {displayName}
                <span className="badge">New</span>
              </a>
            </li>
            <li>
              <a>Settings</a>
            </li>
            <li>
              
              <a href="/api/logout">Logout</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
