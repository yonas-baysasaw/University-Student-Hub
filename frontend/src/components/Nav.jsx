import { Link } from 'react-router-dom';

function Nav() {
  return (
  
    <div className="max-w-5xl mx-auto navbar bg-base-100 shadow-sm px-6 ">
      <div className="flex-1">
        <Link to="/" className="btn btn-ghost text-xl">
          University Student Hub
        </Link>
      </div>
      <div className="flex-none">
        <ul className="menu menu-horizontal px-1 gap-3">
          <li>
            <Link to="/" className="text-sm font-medium">
              About
            </Link>
          </li>
          <li>
            <Link to="/login" className="text-sm font-medium">
              Sign in
            </Link>
          </li>
          <li>
            <Link to="/signup" className="text-sm font-medium">
              Sign up
            </Link>
          </li>
        </ul>
      </div>
    </div>
    
    
  );
}

export default Nav;
