import React from 'react';
import { format, parseISO } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, User } from 'lucide-react';

const statusColors = {
  Draft: 'bg-slate-700 border-slate-600',
  Scheduled: 'bg-blue-900 border-blue-700',
  Dispatched: 'bg-indigo-900 border-indigo-700',
  'In Transit': 'bg-cyan-900 border-cyan-700',
  'In Progress': 'bg-amber-900 border-amber-700',
  'Paused': 'bg-orange-900 border-orange-700',
  'Waiting for Parts': 'bg-purple-900 border-purple-700',
  'Waiting for Approval': 'bg-pink-900 border-pink-700',
  Completed: 'bg-emerald-900 border-emerald-700',
  Cancelled: 'bg-slate-700 border-slate-600'
};

const statusTextColors = {
  Draft: 'text-slate-300',
  Scheduled: 'text-blue-300',
  Dispatched: 'text-indigo-300',
  'In Transit': 'text-cyan-300',
  'In Progress': 'text-amber-300',
  'Paused': 'text-orange-300',
  'Waiting for Parts': 'text-purple-300',
  'Waiting for Approval': 'text-pink-300',
  Completed: 'text-emerald-300',
  Cancelled: 'text-slate-300'
};

export default function WorkshopDisplayCard({
  workOrder,
  job,
  boatName,
  technicianNames,
  isOverdue
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-6 transition-all ${
        isOverdue
          ? 'bg-red-950 border-red-600 shadow-lg shadow-red-600/30'
          : `${statusColors[workOrder.status] || 'bg-slate-700 border-slate-600'} shadow-lg`
      }`}
    >
      {/* Overdue Badge */}
      {isOverdue && (
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-red-600">
          <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
          <span className="text-lg font-bold text-red-400">OVERDUE</span>
        </div>
      )}

      {/* Work Order Title */}
      <h3 className="text-3xl font-bold text-white mb-4 leading-tight">
        {workOrder.title}
      </h3>

      {/* Boat Name - Large and Prominent */}
      <div className="mb-6 pb-6 border-b border-slate-600/50">
        <p className="text-2xl font-semibold text-blue-300">{boatName}</p>
      </div>

      {/* Status and Time */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-xs text-slate-400 uppercase mb-2">Status</p>
          <div
            className={`px-4 py-2 rounded-lg font-bold text-lg ${
              statusTextColors[workOrder.status] || 'text-slate-300'
            }`}
          >
            {workOrder.status}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase mb-2">Scheduled</p>
          <div className="flex items-center gap-2 text-slate-200 text-lg font-semibold">
            <Clock className="h-5 w-5 flex-shrink-0" />
            {workOrder.scheduled_start_time || 'TBD'}
          </div>
        </div>
      </div>

      {/* Assigned Technician */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <p className="text-xs text-slate-400 uppercase mb-2">Assigned To</p>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <p className="text-xl font-bold text-white">{technicianNames}</p>
        </div>
      </div>

      {/* Additional Info */}
      {workOrder.description && (
        <div className="mt-6 pt-6 border-t border-slate-600/50">
          <p className="text-sm text-slate-300 line-clamp-2">
            {workOrder.description}
          </p>
        </div>
      )}
    </div>
  );
}