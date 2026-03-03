import { useNavigate } from 'react-router-dom';
import {
  Film,
  Users,
  Palette,
  CheckCircle,
  ArrowRight,
  UserPlus,
  Download,
  Clock,
} from 'lucide-react';
import { Button, Card, Progress } from '@/components/ui';
import { useProjectStore, useBreakdownStore, useUIStore } from '@/stores';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentProject, scenes, characters } = useProjectStore();
  const { sceneBreakdowns, looks } = useBreakdownStore();
  const { openModal } = useUIStore();

  const sceneCount = scenes.length;
  const characterCount = characters.length;
  const lookCount = looks.length;

  const completedScenes = scenes.filter(
    (s) => sceneBreakdowns[s.id]?.isComplete
  ).length;
  const progressPercent =
    sceneCount > 0 ? Math.round((completedScenes / sceneCount) * 100) : 0;

  const stats = [
    {
      label: 'Scenes',
      value: sceneCount,
      icon: <Film className="w-5 h-5 text-gold" />,
      color: 'bg-gold/10',
    },
    {
      label: 'Characters',
      value: characterCount,
      icon: <Users className="w-5 h-5 text-blue-400" />,
      color: 'bg-blue-400/10',
    },
    {
      label: 'Looks',
      value: lookCount,
      icon: <Palette className="w-5 h-5 text-purple-400" />,
      color: 'bg-purple-400/10',
    },
    {
      label: 'Progress',
      value: `${progressPercent}%`,
      icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
      color: 'bg-emerald-400/10',
      progress: progressPercent,
    },
  ];

  const activityItems = [
    {
      time: '2 min ago',
      text: 'Scene 14 breakdown marked as complete',
    },
    {
      time: '15 min ago',
      text: 'New look "Evening Gala" added for SARAH',
    },
    {
      time: '1 hr ago',
      text: 'Script imported: The_Deadline_v3.pdf',
    },
    {
      time: '3 hrs ago',
      text: 'Character JAMES updated with actor details',
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {currentProject?.name || 'Untitled Project'}
        </h1>
        <p className="text-sm text-text-muted mt-1">Project Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} padding="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-text-primary mt-1">
                  {stat.value}
                </p>
              </div>
              <div
                className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}
              >
                {stat.icon}
              </div>
            </div>
            {stat.progress !== undefined && (
              <Progress value={stat.progress} size="md" className="mt-3" />
            )}
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Quick Actions
        </h2>
        <div className="flex gap-3">
          <Button
            variant="primary"
            icon={<ArrowRight className="w-4 h-4" />}
            onClick={() => navigate('../breakdown')}
          >
            Continue Breakdown
          </Button>
          <Button
            variant="secondary"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => navigate('../characters')}
          >
            Add Character
          </Button>
          <Button
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
            onClick={() => openModal('export')}
          >
            Export Breakdown
          </Button>
        </div>
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Recent Activity
        </h2>
        <Card padding="sm">
          <div className="divide-y divide-border-subtle">
            {activityItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-2">
                <Clock className="w-4 h-4 text-text-muted shrink-0" />
                <span className="text-sm text-text-primary flex-1">
                  {item.text}
                </span>
                <span className="text-xs text-text-muted shrink-0">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
