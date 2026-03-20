function Nav(){
  return (
    <div className="navbar bg-base-100 shadow-sm">
        <div className="flex-1">
            <a className="btn btn-ghost text-xl">University Student Hub</a>
        </div>
        <div className="flex-none">
            <ul className="menu menu-horizontal px-1">
            <li><a href="/login">Sign in</a></li>
            
            </ul>
        </div>
    </div>
  )

}
export default Nav