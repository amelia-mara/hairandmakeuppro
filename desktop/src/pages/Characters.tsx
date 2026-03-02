import { useParams } from 'react-router-dom';

export default function Characters() {
  const { id } = useParams();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Characters</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Manage character profiles, looks, and continuity
        </p>
      </div>

      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-neutral-600 text-5xl mb-4">👤</div>
          <h3 className="text-neutral-300 text-lg font-medium mb-2">
            Character Management
          </h3>
          <p className="text-neutral-500 text-sm max-w-md">
            Characters from your script breakdown will appear here.
            Create character profiles, assign looks, and track continuity.
          </p>
          <p className="text-neutral-600 text-xs mt-4">Project: {id}</p>
        </div>
      </div>
    </div>
  );
}
