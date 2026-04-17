import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

export default function BriefingPreview({ briefDocument }) {
  if (!briefDocument) {
    return (
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle className="text-base">Worker Briefing Preview</CardTitle>
          <CardDescription>Click "Generate Briefing" to preview content</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { projectIdentification, assignedPartner, projectDescription, taskList, locationAccess, documentationNotice, safetyNotes, budget } = briefDocument;

  return (
    <Card className="border-teal-200 bg-teal-50/30">
      <CardHeader>
        <CardTitle className="text-base">Worker Briefing Preview</CardTitle>
        <CardDescription>This content will appear in the PDF export</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* PROJECT IDENTIFICATION */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-3 text-sm">PROJECT IDENTIFICATION</h4>
          <div className="grid grid-cols-2 gap-3 text-sm bg-white p-3 rounded-lg border border-slate-200">
            <div>
              <p className="text-xs text-slate-500 font-semibold">Work Order #</p>
              <p className="text-slate-900">{projectIdentification.workOrderNumber}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Status</p>
              <Badge variant="outline" className="text-xs">{projectIdentification.workOrderStatus}</Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Date</p>
              <p className="text-slate-900">{projectIdentification.scheduledDate}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Customer</p>
              <p className="text-slate-900">{projectIdentification.customerName}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500 font-semibold">Title</p>
              <p className="text-slate-900">{projectIdentification.workOrderTitle}</p>
            </div>
          </div>
        </div>

        {/* ASSIGNED PARTNER */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-3 text-sm">ASSIGNED EXTERNAL WORKER</h4>
          <div className="grid grid-cols-2 gap-3 text-sm bg-white p-3 rounded-lg border border-slate-200">
            <div>
              <p className="text-xs text-slate-500 font-semibold">Name</p>
              <p className="text-slate-900">{assignedPartner.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Role</p>
              <p className="text-slate-900">{assignedPartner.role}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Contact</p>
              <p className="text-slate-900 text-xs">{assignedPartner.contact}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Email</p>
              <p className="text-slate-900 text-xs">{assignedPartner.email}</p>
            </div>
          </div>
        </div>

        {/* PROJECT DESCRIPTION - ENGLISH */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-2 text-sm">PROJECT DESCRIPTION / SCOPE OF WORK</h4>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <p className="text-xs text-teal-600 font-semibold mb-2">English:</p>
            <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{projectDescription.en}</p>
          </div>
        </div>

        {/* PROJECT DESCRIPTION - GERMAN */}
        <div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <p className="text-xs text-teal-600 font-semibold mb-2">Deutsch:</p>
            <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{projectDescription.de}</p>
          </div>
        </div>

        {/* TASKS */}
        {taskList.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">TASKS & CHECKLIST</h4>
            <div className="space-y-2">
              {taskList.map(task => (
                <div key={task.number} className="bg-white p-3 rounded-lg border border-slate-200 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="font-semibold text-teal-600 min-w-fit">{task.number}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{task.title}</p>
                      {task.description && (
                        <p className="text-slate-600 text-xs mt-1">{task.description}</p>
                      )}
                      {task.estimatedHours && (
                        <p className="text-slate-500 text-xs mt-2">Est. {task.estimatedHours}h</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOCATION & ACCESS */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-3 text-sm">LOCATION & ACCESS</h4>
          <div className="grid grid-cols-1 gap-3 text-sm bg-white p-3 rounded-lg border border-slate-200">
            <div>
              <p className="text-xs text-slate-500 font-semibold">Location</p>
              <p className="text-slate-900">{locationAccess.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Address</p>
              <p className="text-slate-900">{locationAccess.address}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">City</p>
              <p className="text-slate-900">{locationAccess.city}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Access Notes</p>
              <p className="text-slate-900 whitespace-pre-wrap">{locationAccess.accessNotes}</p>
            </div>
          </div>
        </div>

        {/* DOCUMENTATION NOTICE */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-3 text-sm">DOCUMENTATION & PAYMENT REQUIREMENTS</h4>
          <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded text-sm">
            <p className="text-orange-900 font-semibold mb-2">English:</p>
            <p className="text-orange-800 text-xs mb-4 leading-relaxed">{documentationNotice.en}</p>
            <p className="text-orange-900 font-semibold mb-2">Deutsch:</p>
            <p className="text-orange-800 text-xs leading-relaxed">{documentationNotice.de}</p>
          </div>
        </div>

        {/* SAFETY NOTES */}
        {safetyNotes && (
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">SAFETY NOTES</h4>
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-sm">
              <p className="text-red-900 whitespace-pre-wrap">{safetyNotes}</p>
            </div>
          </div>
        )}

        {/* BUDGET */}
        {budget && (
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">BUDGET & COST COVERAGE</h4>
            <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Approved Budget</span>
                <span className="font-semibold">€{budget.totalApproved.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Labor</span>
                <span>€{budget.labor.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Travel</span>
                <span>€{budget.travel.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Accommodation</span>
                <span>€{budget.accommodation.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Per Diem</span>
                <span>€{budget.perDiem.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}