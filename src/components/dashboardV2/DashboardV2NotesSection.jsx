/**
 * DASHBOARD V2 — NOTES & REMINDERS SECTION (isolated)
 */
import React from 'react';
import { StickyNote, Calendar, CheckCircle2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';

export default function DashboardV2NotesSection({ notes, getReferenceName, getAge, onToggleComplete, onDelete }) {
  const activeNotes = notes.filter(n => !n.completed);

  if (activeNotes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-yellow-600" />
          Notes & Reminders ({activeNotes.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {activeNotes.slice(0, 5).map(note => (
            <div key={note.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-slate-900">{note.text}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {getReferenceName(note) && (
                      <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-xs">
                        {note.reference_type}: {getReferenceName(note)}
                      </Badge>
                    )}
                    {note.due_date && (
                      <Badge variant="outline" className="bg-white text-slate-700 border-slate-300 text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(parseISO(note.due_date), 'MMM d')}
                      </Badge>
                    )}
                    <span className="text-xs text-slate-500">{getAge(note.created_date)} ago</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onToggleComplete(note)}
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onDelete(note.id)}
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}