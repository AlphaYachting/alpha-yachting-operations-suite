import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, RotateCcw, Eye } from 'lucide-react';

const SIMULATION_KEY = 'admin_simulate_user_id';

export default function UserSimulator({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [simulatedUserId, setSimulatedUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
    // Load simulation state from localStorage
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
    // Reload page to apply changes
    window.location.reload();
  };

  const handleReset = () => {
    setSimulatedUserId(null);
    localStorage.removeItem(SIMULATION_KEY);
    window.location.reload();
  };

  const simulatedUser = users.find(u => u.id === simulatedUserId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Simulate User (View-As)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {simulatedUserId && simulatedUser ? (
          <div className="space-y-3">
            <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
              <Eye className="h-3 w-3 mr-1" />
              Viewing as: {simulatedUser.full_name || simulatedUser.email}
            </Badge>
            <div className="text-xs text-slate-600 space-y-1">
              <div>Real User: {currentUser?.full_name} ({currentUser?.id})</div>
              <div>Effective User: {simulatedUser.full_name} ({simulatedUser.id})</div>
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
          </div>
        ) : (
          <div className="space-y-3">
            <Select onValueChange={handleEnableSimulation}>
              <SelectTrigger>
                <SelectValue placeholder="Select user to simulate..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Select a user to view My Tasks from their perspective
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}