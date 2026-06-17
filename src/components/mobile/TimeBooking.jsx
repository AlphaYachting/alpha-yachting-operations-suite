import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';
import { t } from '@/lib/mobileTranslations';

export default function TimeBooking({ taskId }) {
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [user, setUser] = useState(null);
  const [taskData, setTaskData] = useState(null);
  const lang = user?.preferred_language || 'de';

  useEffect(() => {
    loadData();
  }, [taskId]);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setSessionSeconds(s => s + 1);
        setTotalSeconds(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const tasksData = await base44.entities.Task.list();
      const task = tasksData.find(t => t.id === taskId);
      setTaskData(task);
      
      if (task) {
        const timeEntries = await base44.entities.TimeEntry.filter({
          task_id: taskId,
          technician_id: currentUser.id
        });
        const existingMinutes = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
        setTotalSeconds(existingMinutes * 60);
      }
    } catch (error) {
      console.error('Error loading time booking data:', error);
    }
  };

  const handleStart = () => {
    setSessionSeconds(0);
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = async () => {
    setIsRunning(false);
    if (sessionSeconds > 0 && user && taskData) {
      try {
        await base44.entities.TimeEntry.create({
          work_order_id: taskData.work_order_id,
          task_id: taskId,
          technician_id: user.id,
          entry_date: new Date().toISOString().split('T')[0],
          duration_minutes: Math.round(sessionSeconds / 60),
          is_billable: true
        });
        setSessionSeconds(0);
      } catch (error) {
        console.error('Error saving time entry:', error);
      }
    }
  };

  const handleReset = () => {
    setSessionSeconds(0);
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-medium text-slate-900">{t('timeTracking', lang)}</p>
        </div>

        <div className="bg-slate-100 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-2">{t('currentSession', lang)}</p>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {formatTime(sessionSeconds)}
          </p>
        </div>

        <div className="flex gap-2">
          {!isRunning ? (
            <Button
              onClick={handleStart}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Start
            </Button>
          ) : (
            <Button
              onClick={handlePause}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
              size="sm"
            >
              <Pause className="h-3.5 w-3.5 mr-1" />
              Pause
            </Button>
          )}
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            className="px-3"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {sessionSeconds > 0 && (
          <Button
            onClick={handleStop}
            className="w-full bg-green-600 hover:bg-green-700"
            size="sm"
          >
            {t('saveTime', lang)} ({formatTime(sessionSeconds)})
          </Button>
        )}

        <div className="pt-2 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-2">{t('totalLoggedToday', lang)}</p>
          <Badge variant="outline" className="text-sm">
            {formatTime(totalSeconds)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}