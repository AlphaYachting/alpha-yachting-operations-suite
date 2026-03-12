import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, RefreshCw, TrendingUp, Filter } from 'lucide-react';
import { STAGES } from '@/components/salesPipeline/stageConfig';
import OpportunityCard from '@/components/salesPipeline/OpportunityCard';
import OpportunityForm from '@/components/salesPipeline/OpportunityForm';
import OpportunityDetailModal from '@/components/salesPipeline/OpportunityDetailModal';

export default function SalesPipeline() {
  const [opportunities, setOpportunities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [boats, setBoats] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOpp, setEditingOpp] = useState(null);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setIsLoading(true);
    const [opps, custs, bts, usrs] = await Promise.all([
      base44.entities.Opportunity.list('-created_date', 300),
      base44.entities.Customer.list('last_name', 300),
      base44.entities.Boat.list('vessel_name', 300),
      base44.entities.User.list(),
    ]);
    setOpportunities(opps);
    setCustomers(custs);
    setBoats(bts);
    setUsers(usrs);
    setIsLoading(false);
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStage = destination.droppableId;
    // Optimistic update
    setOpportunities(prev => prev.map(o => o.id === draggableId ? { ...o, stage: newStage } : o));
    await base44.entities.Opportunity.update(draggableId, { stage: newStage });
  };

  const visibleStages = showArchived ? STAGES : STAGES.filter(s => s.id !== 'Archived');

  const grouped = {};
  visibleStages.forEach(s => { grouped[s.id] = []; });
  opportunities.forEach(o => { if (grouped[o.stage] !== undefined) grouped[o.stage].push(o); });

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
  const boatMap = Object.fromEntries(boats.map(b => [b.id, b]));

  const activeOpps = opportunities.filter(o => !['Won', 'Lost', 'Archived'].includes(o.stage));
  const totalValue = activeOpps.reduce((s, o) => s + (o.expected_value || 0), 0);
  const followUpCount = opportunities.filter(o => o.follow_up_required).length;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
    </div>
  );

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-blue-600" /> Sales Pipeline
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeOpps.length} active deals ·{' '}
            <span className="font-medium text-slate-700">€{totalValue.toLocaleString()}</span> pipeline value
            {followUpCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">· ⚠ {followUpCount} follow-up{followUpCount > 1 ? 's' : ''} needed</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowArchived(v => !v)}>
            <Filter className="h-4 w-4 mr-1" /> {showArchived ? 'Hide Archived' : 'Show Archived'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadAll}><RefreshCw className="h-4 w-4" /></Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditingOpp(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Opportunity
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-6" style={{ minHeight: 560 }}>
          {visibleStages.map(stage => {
            const cards = grouped[stage.id] || [];
            const stageValue = cards.reduce((s, o) => s + (o.expected_value || 0), 0);
            return (
              <div key={stage.id} className="flex-shrink-0 w-60">
                {/* Column Header */}
                <div
                  className="rounded-t-lg px-3 py-2 mb-1"
                  style={{ background: stage.color + '18', borderBottom: `2px solid ${stage.color}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]" title={stage.id}>{stage.id}</span>
                      {cards.length > 0 && (
                        <span className="text-xs text-slate-400">({cards.length})</span>
                      )}
                    </div>
                    {stageValue > 0 && (
                      <span className="text-xs font-semibold text-slate-500">€{stageValue.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* Droppable Column */}
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`rounded-b-lg p-2 min-h-32 transition-colors ${
                        snapshot.isDraggingOver
                          ? 'bg-blue-50 border-2 border-dashed border-blue-300'
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      {cards.map((opp, index) => (
                        <Draggable key={opp.id} draggableId={opp.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              style={{ ...prov.draggableProps.style, opacity: snap.isDragging ? 0.85 : 1 }}
                            >
                              <OpportunityCard
                                opportunity={opp}
                                customer={customerMap[opp.customer_id]}
                                boat={boatMap[opp.boat_id]}
                                onClick={() => setSelectedOpp(opp)}
                                dragHandleProps={prov.dragHandleProps}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOpp ? 'Edit Opportunity' : 'New Opportunity'}</DialogTitle>
          </DialogHeader>
          <OpportunityForm
            opportunity={editingOpp}
            customers={customers}
            boats={boats}
            users={users}
            onSave={() => { setShowForm(false); loadAll(); }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <OpportunityDetailModal
        opportunity={selectedOpp}
        customer={selectedOpp ? customerMap[selectedOpp.customer_id] : null}
        boat={selectedOpp ? boatMap[selectedOpp.boat_id] : null}
        onClose={() => setSelectedOpp(null)}
        onEdit={() => {
          setEditingOpp(selectedOpp);
          setSelectedOpp(null);
          setShowForm(true);
        }}
      />
    </div>
  );
}