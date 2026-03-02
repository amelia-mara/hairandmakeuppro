import { useNavigate } from 'react-router-dom';

// Placeholder data - will be connected to shared store
const mockProjects = [
  { id: '1', name: 'Sample Project', status: 'prep', scenes: 0, characters: 0 },
];

export default function Projects() {
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Projects</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Your pre-production projects
          </p>
        </div>
      </div>

      {mockProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-neutral-600 text-6xl mb-4">🎬</div>
          <h3 className="text-neutral-300 text-lg font-medium mb-2">
            No projects yet
          </h3>
          <p className="text-neutral-500 text-sm">
            Create a project on your mobile app to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/project/${project.id}`)}
              className="bg-[#1a1a1a] border border-neutral-800 rounded-xl p-6 text-left hover:border-gold/30 hover:bg-[#1e1e1e] transition-all group"
            >
              <h3 className="text-white font-medium text-lg group-hover:text-gold transition-colors">
                {project.name}
              </h3>
              <p className="text-neutral-500 text-sm mt-1 capitalize">
                {project.status}
              </p>
              <div className="flex gap-4 mt-4 text-neutral-400 text-sm">
                <span>{project.scenes} scenes</span>
                <span>{project.characters} characters</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
