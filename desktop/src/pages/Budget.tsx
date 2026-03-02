import { useParams } from 'react-router-dom';

export default function Budget() {
  const { id } = useParams();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Budget</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Track department budget and expenses
        </p>
      </div>

      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-neutral-600 text-5xl mb-4">💰</div>
          <h3 className="text-neutral-300 text-lg font-medium mb-2">
            Budget Planning
          </h3>
          <p className="text-neutral-500 text-sm max-w-md">
            Plan and track your department budget.
            This feature will be connected to the budget system in the next phase.
          </p>
          <p className="text-neutral-600 text-xs mt-4">Project: {id}</p>
        </div>
      </div>
    </div>
  );
}
