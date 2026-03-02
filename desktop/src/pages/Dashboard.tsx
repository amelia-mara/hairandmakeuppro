import { useParams, Link } from 'react-router-dom';

export default function Dashboard() {
  const { id } = useParams();

  const sections = [
    {
      title: 'Script Breakdown',
      description: 'Break down your script into scenes with character assignments',
      path: `/project/${id}/breakdown`,
      icon: '📝',
    },
    {
      title: 'Characters',
      description: 'Manage character profiles, looks, and continuity',
      path: `/project/${id}/characters`,
      icon: '👤',
    },
    {
      title: 'Budget',
      description: 'Track department budget and expenses',
      path: `/project/${id}/budget`,
      icon: '💰',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Project Dashboard</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Overview and quick access to all project tools
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1a1a1a] border border-neutral-800 rounded-xl p-5">
          <p className="text-neutral-500 text-sm">Scenes</p>
          <p className="text-2xl font-semibold text-white mt-1">0</p>
        </div>
        <div className="bg-[#1a1a1a] border border-neutral-800 rounded-xl p-5">
          <p className="text-neutral-500 text-sm">Characters</p>
          <p className="text-2xl font-semibold text-white mt-1">0</p>
        </div>
        <div className="bg-[#1a1a1a] border border-neutral-800 rounded-xl p-5">
          <p className="text-neutral-500 text-sm">Looks</p>
          <p className="text-2xl font-semibold text-white mt-1">0</p>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <Link
            key={section.title}
            to={section.path}
            className="bg-[#1a1a1a] border border-neutral-800 rounded-xl p-6 hover:border-gold/30 hover:bg-[#1e1e1e] transition-all group"
          >
            <div className="text-3xl mb-3">{section.icon}</div>
            <h3 className="text-white font-medium text-lg group-hover:text-gold transition-colors">
              {section.title}
            </h3>
            <p className="text-neutral-500 text-sm mt-1">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
