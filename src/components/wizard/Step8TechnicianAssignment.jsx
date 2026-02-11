import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useWizard } from './WizardContext';
import { base44 } from '@/api/base44Client';
import { Users } from 'lucide-react';

export function Step8TechnicianAssignment() {
  const { wizardData, updateWizardData, setStep } = useWizard();
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Technician.list('-created_date', 100);
      setTechnicians(data.filter(t => t.status === 'Active'));
    } catch (error) {
      console.error('Error loading technicians:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTechnician = (techId) => {
    const updated = wizardData.technicians.includes(techId)
      ? wizardData.technicians.filter(id => id !== techId)
      : [...wizardData.technicians, techId];
    updateWizardData('technicians', updated);
  };

  const handleNext = () => {
    setStep(9);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Technicians
          </CardTitle>
          <p className="text-sm text-slate-500 mt-2">Select one or more technicians for this work</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading technicians...</div>
          ) : technicians.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No active technicians available</div>
          ) : (
            <div className="space-y-3">
              {technicians.map((tech) => (
                <div key={tech.id} className="flex items-start gap-3 p-3 border rounded hover:bg-slate-50 cursor-pointer">
                  <Checkbox
                    checked={wizardData.technicians.includes(tech.id)}
                    onCheckedChange={() => toggleTechnician(tech.id)}
                    id={`tech-${tech.id}`}
                    className="mt-1"
                  />
                  <Label htmlFor={`tech-${tech.id}`} className="flex-1 cursor-pointer">
                    <p className="font-medium">{tech.first_name} {tech.last_name}</p>
                    <p className="text-sm text-slate-600">{tech.role}</p>
                    {tech.skills?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {tech.skills.slice(0, 3).map(skill => (
                          <span key={skill} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                            {skill}
                          </span>
                        ))}
                        {tech.skills.length > 3 && (
                          <span className="text-xs text-slate-500 px-2 py-1">+{tech.skills.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          )}

          {wizardData.technicians.length > 0 && (
            <div className="mt-6 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Selected: {wizardData.technicians.length}</strong> technician{wizardData.technicians.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setStep(6)}>
          ← Back
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
          Next →
        </Button>
      </div>
    </div>
  );
}