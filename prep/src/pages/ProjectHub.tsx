interface ProjectHubProps {
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
}

export function ProjectHub({ onCreateProject, onSelectProject: _onSelectProject }: ProjectHubProps) {


  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <div className="hub-hero">
        {/* Rainbow swirl decoration */}
        <div className="hub-hero-rainbow">
          <div className="rainbow-ring rainbow-ring--1" />
          <div className="rainbow-ring rainbow-ring--2" />
          <div className="rainbow-ring rainbow-ring--3" />
        </div>

        <div className="hub-hero-content">
          <span className="hub-hero-badge">FOR FILM AND TV DEPARTMENTS</span>
          <h2 className="hub-hero-heading">
            Manage the Magic<br />
            <em>Behind the Camera.</em>
          </h2>
          <p className="hub-hero-subtitle">
            Continuity tracking, script breakdowns, budgets, and timesheets.
            Everything your department needs, beautifully organised.
          </p>
          <button className="hub-hero-cta" onClick={onCreateProject}>
            Get Started
          </button>
        </div>
      </div>

    </div>
  );
}
