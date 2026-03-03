import { NavLink, useParams } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuthStore';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-2 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-gold/10 text-gold'
      : 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200'
  }`;

export default function Sidebar() {
  const { id } = useParams();
  const { user, signOut } = useAuthStore();

  return (
    <aside className="w-64 bg-[#0a0a0a] border-r border-neutral-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-neutral-800">
        <h1 className="text-gold font-semibold text-lg">Prep Happy</h1>
        <p className="text-neutral-500 text-sm">Pre-Production Suite</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavLink
          to="/"
          end
          className={navLinkClass}
        >
          Projects
        </NavLink>

        <NavLink to="/breakdown" className={navLinkClass}>
          Script Breakdown
        </NavLink>

        {id && (
          <>
            <div className="pt-4 pb-2 px-4 text-xs text-neutral-600 uppercase tracking-wider">
              Project
            </div>
            <NavLink to={`/project/${id}`} end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to={`/project/${id}/breakdown`} className={navLinkClass}>
              Script Breakdown
            </NavLink>
            <NavLink to={`/project/${id}/characters`} className={navLinkClass}>
              Characters
            </NavLink>
            <NavLink to={`/project/${id}/budget`} className={navLinkClass}>
              Budget
            </NavLink>
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-neutral-800">
        <div className="text-neutral-500 text-xs mb-1">Logged in as</div>
        <div className="text-white text-sm truncate mb-3">
          {user?.email || 'Unknown'}
        </div>
        <button
          onClick={() => signOut()}
          className="w-full text-left text-neutral-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-neutral-800 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
