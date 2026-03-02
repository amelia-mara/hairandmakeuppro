import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gold">Prep Happy</h1>
          <p className="text-neutral-500 text-sm mt-1">Pre-Production Suite</p>
        </div>

        {/* Auth Form */}
        <Outlet />
      </div>
    </div>
  );
}
