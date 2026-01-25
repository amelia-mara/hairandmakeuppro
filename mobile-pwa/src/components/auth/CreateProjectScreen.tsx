import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { Button, Input } from '@/components/ui';
import type { ProductionType, Project } from '@/types';
import { PRODUCTION_TYPES } from '@/types';

export function CreateProjectScreen() {
  const { goBack, createProject, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [productionType, setProductionType] = useState<ProductionType>('film');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!name.trim()) return;

    const result = await createProject(name.trim(), productionType);

    if (result.success && result.code) {
      // Go directly to the upload files flow instead of showing success screen
      const { projectMemberships } = useAuthStore.getState();
      const membership = projectMemberships.find(p => p.projectCode === result.code);
      if (membership) {
        const project: Project = {
          id: membership.projectId,
          name: membership.projectName,
          createdAt: membership.joinedAt,
          updatedAt: membership.lastAccessedAt,
          scenes: [],
          characters: [],
          looks: [],
        };
        useProjectStore.getState().setProjectNeedsSetup(project);
      }
    }
  };

  const isValid = name.trim();

  // Create form
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with back button */}
      <header className="flex items-center px-4 py-3 safe-top">
        <button
          onClick={goBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-2"
          aria-label="Go back"
        >
          <svg
            className="w-6 h-6 text-text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 px-6 pt-4">
        {/* Title */}
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Create Project
        </h1>
        <p className="text-text-secondary mb-8">
          Set up a new production for your team
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="text"
            label="Production Name"
            placeholder="e.g., The Crown S6"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
          />

          {/* Production type select */}
          <div>
            <label className="field-label block mb-2">Production Type</label>
            <div className="grid grid-cols-2 gap-2">
              {PRODUCTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setProductionType(type.value)}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    productionType === type.value
                      ? 'border-gold bg-gold-50 text-gold'
                      : 'border-border bg-card text-text-secondary hover:border-gold-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            fullWidth
            size="lg"
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </span>
            ) : (
              'Create Project'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
