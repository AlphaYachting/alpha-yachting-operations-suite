import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  ArrowLeft,
  Eye,
  Clock,
  User,
  ClipboardList
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccessLogs() {
  const [searchParams] = useSearchParams();
  const workOrderId = searchParams.get('workOrderId');
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEmail, setFilterEmail] = useState('');
  const [workOrder, setWorkOrder] = useState(null);

  useEffect(() => {
    loadLogs();
  }, [workOrderId]);

  const loadLogs = async () => {
    try {
      const logsData = await base44.entities.WorkOrderAccessLog.filter(
        { work_order_id: workOrderId },
        '-accessed_at'
      );
      setLogs(logsData);

      // Load work order info
      if (workOrderId) {
        const woData = await base44.entities.WorkOrder.filter({ id: workOrderId });
        if (woData.length > 0) {
          setWorkOrder(woData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading access logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log =>
    log.technician_email.toLowerCase().includes(filterEmail.toLowerCase())
  );

  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to={createPageUrl('WorkOrders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Access Logs</h1>
          {workOrder && (
            <p className="text-slate-500 mt-1">
              WO #{workOrder.work_order_number || workOrder.id.slice(-6)} - {workOrder.title}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Views</p>
                <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <User className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Unique Technicians</p>
                <p className="text-2xl font-bold text-slate-900">
                  {new Set(logs.map(l => l.technician_id)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <Clock className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Avg Duration</p>
                <p className="text-2xl font-bold text-slate-900">
                  {logs.length > 0
                    ? formatDuration(
                        Math.round(
                          logs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0) /
                            logs.length
                        )
                      )
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="max-w-md">
        <Input
          placeholder="Filter by technician email..."
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          className="text-sm"
        />
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Access History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Eye className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p>No access logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Technician</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Accessed At</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Closed At</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Duration</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{log.technician_email}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {format(parseISO(log.accessed_at), 'MMM d, yyyy HH:mm:ss')}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {log.closed_at
                          ? format(parseISO(log.closed_at), 'MMM d, yyyy HH:mm:ss')
                          : '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {formatDuration(log.duration_seconds)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                        {log.ip_address || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}