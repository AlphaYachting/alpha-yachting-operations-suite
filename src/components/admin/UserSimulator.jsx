import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Eye, AlertCircle } from 'lucide-react';

const SIMULATION_KEY = 'admin_simulate_user_id';

export default function UserSimulator({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [simulatedUserId, setSimulatedUserId] = useState(null);

  useEffect(() => {
    loadUsers();
    const saved = localStorage.getItem(SIMULATION_KEY);
    if (saved) {
      setSimulatedUserId(saved);
    }
  }, []);

  const loadUsers = async () => {
    try {
      const allUsers = await base44.entities.User.list('-created_date', 200);
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleEnableSimulation = (userId) => {
    setSimulatedUserId(userId);
    localStorage.setItem(SIMULATION_KEY, userId);
    window.location.reload();
  };

  const handleReset = () => {
    setSimulatedUserId(null);
    localStorage.removeItem(SIMULATION_KEY);
    window.location.reload();
  };

  const simulatedUser = users.find(u => u.id === simulatedUserId);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Eye className="h-4 w-4 text-slate-500" />
          Simulate User (View-As)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {simulatedUserId && simulatedUser ? (
          <>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-900">
                    Viewing as: {simulatedUser.full_name || simulatedUser.email}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Real user: {currentUser?.full_name} • UI-only simulation
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <RotateCcw className="h-3 w-3 mr-2" />
              Reset to Me
            </Button>
          </>
        ) : (
          <>
            <Select onValueChange={handleEnableSimulation}>
              <SelectTrigger>
                <SelectValue placeholder="Select user to simulate..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              UI-only simulation • No auth changes
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}