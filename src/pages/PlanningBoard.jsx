import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { computeVisits, groupVisitsByTimeBucket } from '@/utils/visitPlanner';
import VisitCard from '@/components/planning/VisitCard';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlanningBoard() {
  const queryClient = useQueryClient();
  const [showStartDateModal, setShowStartDateModal] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTechId, setSelectedTechId] = useState('');

  // Fetch data
  const { data: workOrders = [], isLoading: woLoading } = useQuery({
    queryKey: ['workOrders'],
    queryFn: async () => base44.entities.WorkOrder.list('-updated_date', 200),
  });

  const { data: jobs = {} } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const jobList = await base44.entities.Job.list('-updated_date', 100);
      return Object.fromEntries(jobList.map(j => [j.id, j]));
    },
  });

  const { data: locations = {} } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const locList = await base44.entities.Location.list('-updated_date', 50);
      return Object.fromEntries(locList.map(l => [l.id, l]));
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => base44.entities.Technician.list('-updated_date', 50),
  });

  // Compute visits and group by time bucket
  const visits = computeVisits(workOrders, jobs, locations, technicians);
  const buckets = groupVisitsByTimeBucket(visits);

  // Handle start date update
  const handleSetStartDate = async (visit) => {
    setShowStartDateModal(visit);
    setSelectedDate(visit.startDate);
  };

  const saveStartDate = async () => {
    if (!showStartDateModal || !selectedDate) return;

    try {
      // Update all actionable work orders in this visit
      for (const wo of showStartDateModal.actionable) {
        await base44.entities.WorkOrder.update(wo.id, {
          scheduled_date: selectedDate,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setShowStartDateModal(null);
    } catch (error) {
      console.error('Error updating start date:', error);
    }
  };

  // Handle executor assignment
  const handleAssignExecutor = async (visit) => {
    setShowAssignModal(visit);
    setSelectedTechId('');
  };

  const saveExecutor = async () => {
    if (!showAssignModal || !selectedTechId) return;

    try {
      // Assign lead technician to all actionable work orders
      for (const wo of showAssignModal.actionable) {
        await base44.entities.WorkOrder.update(wo.id, {
          lead_technician_id: selectedTechId,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setShowAssignModal(null);
    } catch (error) {
      console.error('Error assigning executor:', error);
    }
  };

  if (woLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading planning board...</p>
        </div>
      </div>
    );
  }

  const totalVisits = visits.length;
  const totalActionable = visits.reduce((sum, v) => sum + v.actionableCount, 0);
  const totalBlocked = visits.reduce((sum, v) => sum + v.blockedCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Planning Board</h1>
        <p className="text-sm text-slate-600 mt-1">Date-first visit planning with boat/project clustering</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-600 font-medium">Total Visits</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{totalVisits}</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <p className="text-xs text-emerald-600 font-medium">Actionable WOs</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{totalActionable}</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-600 font-medium">Blocked/Paused</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{totalBlocked}</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-xs text-slate-600 font-medium">Total Effort</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {visits.reduce((sum, v) => sum + v.effort.max, 0).toFixed(0)}h
          </p>
        </div>
      </div>

      {/* Time buckets */}
      {['This Week', 'Next Week', 'Later'].map(bucketName => {
        const bucketVisits = buckets[bucketName];
        if (!bucketVisits.length) return null;

        return (
          <div key={bucketName}>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">{bucketName}</h2>
            <div className="space-y-3">
              {bucketVisits.map(visit => (
                <VisitCard
                  key={`${visit.boatId}|${visit.jobId}|${visit.locationId}`}
                  visit={visit}
                  onSetStartDate={handleSetStartDate}
                  onAssignExecutor={handleAssignExecutor}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {totalVisits === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">No work orders ready for planning.</p>
        </div>
      )}

      {/* Start Date Modal */}
      {showStartDateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Set Visit Start Date</h3>
            <p className="text-sm text-slate-600 mb-4">
              {showStartDateModal.job?.title} @ {showStartDateModal.location?.name}
            </p>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-blue-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowStartDateModal(null)}
                className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveStartDate}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Executor Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Assign Executor</h3>
            <p className="text-sm text-slate-600 mb-4">
              {showAssignModal.job?.title} @ {showAssignModal.location?.name}
            </p>
            <select
              value={selectedTechId}
              onChange={e => setSelectedTechId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-blue-400"
            >
              <option value="">— Select technician —</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAssignModal(null)}
                className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveExecutor}
                disabled={!selectedTechId}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}