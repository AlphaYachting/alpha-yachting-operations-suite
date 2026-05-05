import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  Download,
  Copy,
  RefreshCw,
  Filter,
  Table2,
  Layers,
  AlertCircle,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import * as XLSX from 'xlsx';

const ACTIVE_JOB_STATUSES = ['New', 'Quoted', 'Approved', 'Scheduled', 'In Progress', 'Waiting for Parts', 'On Hold'];
const ACTIVE_WO_STATUSES = ['Draft', 'Scheduled', 'Dispatched', 'In Transit', 'In Progress', 'Paused', 'Waiting for Parts', 'Waiting for Approval', 'Ready to Invoice'];

const TODAY = format(new Date(), 'yyyy-MM-dd');
const THIRTY_DAYS_AGO = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

export default function OperationsResetExport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'boats'

  // Raw data
  const [jobs, setJobs] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [locations, setLocations] = useState([]);
  const [offers, setOffers] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);

  // Filters
  const [filterActiveOnly, setFilterActiveOnly] = useState(true);
  const [filterIncludeRecentCompleted, setFilterIncludeRecentCompleted] = useState(true);
  const [filterCustomerId, setFilterCustomerId] = useState('all');
  const [filterBoatId, setFilterBoatId] = useState('all');
  const [filterTechnicianId, setFilterTechnicianId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLocationId, setFilterLocationId] = useState('all');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [
        jobsData, woData, tasksData, customersData, boatsData,
        techData, locationsData, offersData, timeData,
      ] = await Promise.all([
        base44.entities.Job.list('-updated_date', 2000),
        base44.entities.WorkOrder.list('-updated_date', 2000),
        base44.entities.Task.list('-updated_date', 5000),
        base44.entities.Customer.list('-created_date', 1000),
        base44.entities.Boat.list('-created_date', 1000),
        base44.entities.Technician.list(),
        base44.entities.Location.list(),
        base44.entities.Offer.list('-updated_date', 1000),
        base44.entities.TimeEntry.list('-created_date', 5000),
      ]);
      setJobs(jobsData);
      setWorkOrders(woData);
      setTasks(tasksData);
      setCustomers(customersData);
      setBoats(boatsData);
      setTechnicians(techData);
      setLocations(locationsData);
      setOffers(offersData);
      setTimeEntries(timeData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Lookup maps
  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c])), [customers]);
  const boatMap = useMemo(() => Object.fromEntries(boats.map(b => [b.id, b])), [boats]);
  const techMap = useMemo(() => Object.fromEntries(technicians.map(t => [t.id, t])), [technicians]);
  const locationMap = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations]);
  const woMap = useMemo(() => Object.fromEntries(workOrders.map(wo => [wo.id, wo])), [workOrders]);
  const jobMap = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);

  // Offer lookup by job_id
  const offerByJobId = useMemo(() => {
    const map = {};
    offers.forEach(o => { if (o.job_id && !map[o.job_id]) map[o.job_id] = o; });
    return map;
  }, [offers]);

  // Time logged per WO
  const loggedMinsByWoId = useMemo(() => {
    const map = {};
    timeEntries.forEach(te => {
      if (te.work_order_id) map[te.work_order_id] = (map[te.work_order_id] || 0) + (te.duration_minutes || 0);
    });
    return map;
  }, [timeEntries]);

  const getTechName = (id) => {
    if (!id) return '';
    const t = techMap[id];
    return t ? `${t.first_name || ''} ${t.last_name || ''}`.trim() : id;
  };

  const getCustomerName = (customer) => {
    if (!customer) return '';
    return customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || '';
  };

  const getLocationName = (id) => locationMap[id]?.name || '';

  // ─── Filtered Jobs ────────────────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (filterActiveOnly && !ACTIVE_JOB_STATUSES.includes(job.status)) {
        if (!filterIncludeRecentCompleted) return false;
        // Include recently completed
        const updatedAt = job.updated_date || job.completion_date || '';
        if (updatedAt < THIRTY_DAYS_AGO) return false;
      }
      if (filterCustomerId !== 'all' && job.customer_id !== filterCustomerId) return false;
      if (filterBoatId !== 'all' && job.boat_id !== filterBoatId) return false;
      if (filterLocationId !== 'all' && job.location_id !== filterLocationId) return false;
      if (filterTechnicianId !== 'all' && job.lead_technician_id !== filterTechnicianId) return false;
      if (filterStatus !== 'all' && job.status !== filterStatus) return false;
      return true;
    });
  }, [jobs, filterActiveOnly, filterIncludeRecentCompleted, filterCustomerId, filterBoatId, filterLocationId, filterTechnicianId, filterStatus]);

  const filteredJobIds = useMemo(() => new Set(filteredJobs.map(j => j.id)), [filteredJobs]);

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => filteredJobIds.has(wo.job_id));
  }, [workOrders, filteredJobIds]);

  const filteredWoIds = useMemo(() => new Set(filteredWorkOrders.map(wo => wo.id)), [filteredWorkOrders]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => filteredWoIds.has(t.work_order_id));
  }, [tasks, filteredWoIds]);

  // ─── Task-level rows ──────────────────────────────────────────────────────
  const taskRows = useMemo(() => {
    const exportDate = format(new Date(), 'dd.MM.yyyy HH:mm');
    return filteredTasks.map(task => {
      const wo = woMap[task.work_order_id] || {};
      const job = jobMap[wo.job_id] || {};
      const customer = customerMap[job.customer_id] || {};
      const boat = boatMap[job.boat_id] || {};
      const location = locationMap[job.location_id || boat.current_location_id] || {};
      const offer = offerByJobId[job.id] || {};
      const loggedMins = loggedMinsByWoId[wo.id] || 0;
      const assignedTech = getTechName(task.assigned_user_id || wo.lead_technician_id);
      const techList = (wo.assigned_technicians || []).map(id => getTechName(id)).filter(Boolean).join(', ');

      return {
        'Export Date': exportDate,
        'Customer Name': getCustomerName(customer),
        'Boat / Vessel': boat.vessel_name || '',
        'Boat Type': [boat.vessel_type, boat.manufacturer, boat.model, boat.year].filter(Boolean).join(' '),
        'Project / Job Name': job.title || '',
        'Job Number': job.job_number || '',
        'WorkOrder Name': wo.title || '',
        'WorkOrder Number': wo.work_order_number || '',
        'WorkOrder Type': wo.workorder_type || '',
        'WorkOrder Status': wo.status || '',
        'Task Title': task.title || '',
        'Task Description / Notes': [task.description, task.notes].filter(Boolean).join(' | '),
        'Task Status': task.status || '',
        'Issue / Blocker': task.issue_notes || '',
        'Assigned Person': assignedTech || techList,
        'All Assigned Technicians': techList,
        'Priority': job.priority || '',
        'Customer Requested Date': job.requested_date || '',
        'Scheduled Start Date': wo.scheduled_date || '',
        'Scheduled End Date': wo.scheduled_end_date || '',
        'Location / Marina': location.name || '',
        'Linked Offer Number': offer.offer_number || '',
        'Est. Hours (Task)': task.estimated_minutes ? (task.estimated_minutes / 60).toFixed(2) : '',
        'Actual Minutes (Task)': task.actual_minutes || '',
        'Logged Hours (WO)': loggedMins ? (loggedMins / 60).toFixed(2) : '',
        'Est. Hours (Job)': job.estimated_hours || '',
        'Parts Required': job.requires_parts ? 'Yes' : '',
        'Parts Ordered': job.parts_ordered ? 'Yes' : '',
        'Parts ETA': job.parts_eta || '',
        'Job Status': job.status || '',
        'Last Updated': task.updated_date ? format(new Date(task.updated_date), 'dd.MM.yyyy') : '',
        'Internal Notes (Job)': job.internal_notes || '',
        'Internal Notes (WO)': wo.internal_notes || '',
        'WorkOrder Summary': wo.work_summary || '',
        'Task Completed By': task.completed_by ? getTechName(task.completed_by) : '',
        'Task Completed At': task.completed_at ? format(new Date(task.completed_at), 'dd.MM.yyyy') : '',
      };
    });
  }, [filteredTasks, woMap, jobMap, customerMap, boatMap, locationMap, offerByJobId, loggedMinsByWoId]);

  // ─── Boat-level summary rows ──────────────────────────────────────────────
  const boatSummaryRows = useMemo(() => {
    const exportDate = format(new Date(), 'dd.MM.yyyy HH:mm');
    // Group by boat + job combination
    const groupMap = {};
    filteredJobs.forEach(job => {
      const key = `${job.boat_id || 'noboat'}__${job.id}`;
      if (!groupMap[key]) {
        groupMap[key] = { job, tasks: [], wos: [] };
      }
    });
    filteredWorkOrders.forEach(wo => {
      const job = jobMap[wo.job_id];
      if (!job) return;
      const key = `${job.boat_id || 'noboat'}__${job.id}`;
      if (groupMap[key]) groupMap[key].wos.push(wo);
    });
    filteredTasks.forEach(task => {
      const wo = woMap[task.work_order_id];
      if (!wo) return;
      const job = jobMap[wo.job_id];
      if (!job) return;
      const key = `${job.boat_id || 'noboat'}__${job.id}`;
      if (groupMap[key]) groupMap[key].tasks.push(task);
    });

    return Object.values(groupMap).map(({ job, tasks: jTasks, wos }) => {
      const customer = customerMap[job.customer_id] || {};
      const boat = boatMap[job.boat_id] || {};
      const location = locationMap[job.location_id || boat.current_location_id] || {};

      const openTasks = jTasks.filter(t => t.status === 'Not Started').length;
      const inProgressTasks = jTasks.filter(t => t.status === 'In Progress').length;
      const completedTasks = jTasks.filter(t => t.status === 'Completed').length;
      const blockedTasks = jTasks.filter(t => ['Not Possible', 'Needs Approval'].includes(t.status)).length;

      const dueDates = [job.requested_date, ...wos.map(w => w.scheduled_date)].filter(Boolean).sort();
      const endDates = [...wos.map(w => w.scheduled_end_date)].filter(Boolean).sort();

      const woStatuses = [...new Set(wos.map(w => w.status).filter(Boolean))].join(', ');
      const leadTech = getTechName(job.lead_technician_id);
      const allTechs = [...new Set(wos.flatMap(w => w.assigned_technicians || []))].map(getTechName).filter(Boolean);

      // Open task titles as summary
      const openSummary = jTasks
        .filter(t => !['Completed', 'Skipped'].includes(t.status))
        .slice(0, 5)
        .map(t => t.title)
        .join(' | ');

      return {
        'Export Date': exportDate,
        'Customer Name': getCustomerName(customer),
        'Boat / Vessel': boat.vessel_name || '',
        'Boat Type / Model': [boat.vessel_type, boat.manufacturer, boat.model, boat.year].filter(Boolean).join(' '),
        'Location / Marina': location.name || '',
        'Project / Job Name': job.title || '',
        'Job Number': job.job_number || '',
        'Job Status': job.status || '',
        'Priority': job.priority || '',
        'Open Tasks': openTasks,
        'In Progress Tasks': inProgressTasks,
        'Completed Tasks': completedTasks,
        'Blocked / Problem Tasks': blockedTasks,
        'Total Tasks': jTasks.length,
        'Lead Technician': leadTech,
        'All Technicians': allTechs.join(', '),
        'Earliest Due Date': dueDates[0] || '',
        'Latest Due Date': endDates[endDates.length - 1] || '',
        'WO Statuses': woStatuses,
        'Number of Work Orders': wos.length,
        'Open Work Summary (first 5 tasks)': openSummary,
        'Parts Required': job.requires_parts ? 'Yes' : '',
        'Parts ETA': job.parts_eta || '',
        'Last Updated': job.updated_date ? format(new Date(job.updated_date), 'dd.MM.yyyy') : '',
        'Internal Notes': job.internal_notes || '',
      };
    });
  }, [filteredJobs, filteredWorkOrders, filteredTasks, customerMap, boatMap, locationMap, jobMap, woMap]);

  // ─── Export functions ─────────────────────────────────────────────────────
  const toCSV = (rows) => {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.map(escape).join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  };

  const downloadCSV = (rows, filename) => {
    const csv = toCSV(rows);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadXLSX = (taskRowsData, boatRowsData) => {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(taskRowsData);
    const ws2 = XLSX.utils.json_to_sheet(boatRowsData);
    XLSX.utils.book_append_sheet(wb, ws1, 'TaskDetail');
    XLSX.utils.book_append_sheet(wb, ws2, 'BoatLevelSummary');
    XLSX.writeFile(wb, `OperationsExport_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const copyJSON = (rows) => {
    navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
  };

  // ─── Preview table ────────────────────────────────────────────────────────
  const previewRows = activeTab === 'tasks' ? taskRows : boatSummaryRows;
  const previewHeaders = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

  const allJobStatuses = useMemo(() => [...new Set(jobs.map(j => j.status).filter(Boolean))].sort(), [jobs]);

  // Admin guard — after all hooks
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield className="h-12 w-12 text-slate-400" />
        <h2 className="text-xl font-semibold text-slate-700">Admin Access Only</h2>
        <p className="text-slate-500">This page is restricted to administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Operations Reset Export</h1>
            <Badge className="bg-red-100 text-red-700 border border-red-200">Read-Only</Badge>
          </div>
          <p className="text-slate-500 text-sm">
            Export current operational data for manual review. No data is modified.
            <span className="ml-2 text-xs text-slate-400">
              {filteredJobs.length} projects · {filteredWorkOrders.length} WOs · {filteredTasks.length} tasks
            </span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Active Only */}
            <label className="flex items-center gap-2 cursor-pointer col-span-1">
              <input
                type="checkbox"
                checked={filterActiveOnly}
                onChange={e => setFilterActiveOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700">Active Only</span>
            </label>

            {/* Include recent completed */}
            <label className="flex items-center gap-2 cursor-pointer col-span-1">
              <input
                type="checkbox"
                checked={filterIncludeRecentCompleted}
                onChange={e => setFilterIncludeRecentCompleted(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700">+30d Completed</span>
            </label>

            {/* Customer */}
            <Select value={filterCustomerId} onValueChange={setFilterCustomerId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{getCustomerName(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Boat */}
            <Select value={filterBoatId} onValueChange={setFilterBoatId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Boats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Boats</SelectItem>
                {boats.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.vessel_name || b.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Technician */}
            <Select value={filterTechnicianId} onValueChange={setFilterTechnicianId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Technicians" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technicians</SelectItem>
                {technicians.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {allJobStatuses.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location */}
            <Select value={filterLocationId} onValueChange={setFilterLocationId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Export Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'tasks' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Table2 className="h-4 w-4" />
            Task Detail ({taskRows.length})
          </button>
          <button
            onClick={() => setActiveTab('boats')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'boats' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="h-4 w-4" />
            Boat Summary ({boatSummaryRows.length})
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCSV(
              activeTab === 'tasks' ? taskRows : boatSummaryRows,
              `${activeTab === 'tasks' ? 'TaskDetail' : 'BoatSummary'}_${format(new Date(), 'yyyyMMdd')}.csv`
            )}
            disabled={previewRows.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadXLSX(taskRows, boatSummaryRows)}
            disabled={taskRows.length === 0 && boatSummaryRows.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export XLSX (beide Tabs)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyJSON(previewRows)}
            disabled={previewRows.length === 0}
          >
            <Copy className="h-4 w-4 mr-1.5" />
            Copy JSON
          </Button>
        </div>
      </div>

      {/* Readonly notice */}
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        Read-only export — no data is modified, created or deleted by this page.
      </div>

      {/* Preview Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-700">
            Preview — {activeTab === 'tasks' ? 'Task Detail' : 'Boat Level Summary'} ({previewRows.length} rows)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : previewRows.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400 gap-2">
              <AlertCircle className="h-8 w-8" />
              <p>No records match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr>
                    {previewHeaders.map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 200).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {previewHeaders.map(h => (
                        <td key={h} className="px-3 py-1.5 border-b border-slate-100 text-slate-700 whitespace-nowrap max-w-[200px] truncate" title={String(row[h] ?? '')}>
                          {String(row[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > 200 && (
                <div className="px-4 py-2 bg-amber-50 text-amber-700 text-xs border-t border-amber-200">
                  Preview limited to 200 rows. Export buttons include all {previewRows.length} rows.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}