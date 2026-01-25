import type { ProjectStats } from '@/types';
import { formatStorageSize } from '@/types';

interface ProjectStatsCardProps {
  stats: ProjectStats;
}

export function ProjectStatsCard({ stats }: ProjectStatsCardProps) {
  // Format relative time for last activity
  const formatLastActivity = (date: Date | null): string => {
    if (!date) return 'No activity';

    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      {/* Script Section */}
      <section>
        <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
          SCRIPT
        </h3>
        <div className="card space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Scenes</span>
            <span className="text-sm font-semibold text-text-primary">{stats.sceneCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Story Days</span>
            <span className="text-sm font-semibold text-text-primary">{stats.storyDays}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Characters</span>
            <span className="text-sm font-semibold text-text-primary">{stats.characterCount}</span>
          </div>
        </div>
      </section>

      {/* Continuity Section */}
      <section>
        <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
          CONTINUITY
        </h3>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-muted">Progress</span>
            <span className="text-sm font-semibold text-text-primary">
              {stats.completionPercentage}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full gold-gradient rounded-full transition-all duration-500"
              style={{ width: `${stats.completionPercentage}%` }}
            />
          </div>
          <p className="text-xs text-text-muted mt-2">
            {stats.completedScenes} of {stats.sceneCount} scenes checked
          </p>
        </div>
      </section>

      {/* Photos Section */}
      <section>
        <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
          PHOTOS
        </h3>
        <div className="card space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Photos Uploaded</span>
            <span className="text-sm font-semibold text-text-primary">
              {stats.photoCount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Storage Used</span>
            <span className="text-sm font-semibold text-text-primary">
              {formatStorageSize(stats.storageUsed)}
            </span>
          </div>
        </div>
      </section>

      {/* Team Activity Section */}
      <section>
        <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
          TEAM ACTIVITY
        </h3>
        <div className="card space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Team Members</span>
            <span className="text-sm font-semibold text-text-primary">{stats.teamMemberCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Last Activity</span>
            <span className="text-sm font-semibold text-text-primary">
              {formatLastActivity(stats.lastActivity)}
            </span>
          </div>
          {stats.mostActiveUser && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-muted">Most Active</span>
              <span className="text-sm font-semibold text-text-primary">
                {stats.mostActiveUser.name} ({stats.mostActiveUser.editCount.toLocaleString()} edits)
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
