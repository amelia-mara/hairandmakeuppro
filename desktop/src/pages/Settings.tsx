export default function Settings() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Application preferences and configuration
        </p>
      </div>

      <div className="bg-[#1a1a1a] border border-neutral-800 rounded-xl p-6 max-w-2xl">
        <h3 className="text-white font-medium mb-4">About</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-400">Application</span>
            <span className="text-white">Prep Happy Desktop</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Version</span>
            <span className="text-white">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Platform</span>
            <span className="text-white">Web (React)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
