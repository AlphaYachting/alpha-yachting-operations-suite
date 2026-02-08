import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusOptions = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Contacted', label: 'Contacted' },
  { value: 'Converted', label: 'Converted' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Lost', label: 'Lost' },
];

export default function LeadStatusChange({ lead, onStatusChange }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === lead.status) return;
    try {
      setIsLoading(true);
      await onStatusChange(lead.id, newStatus);
    } catch (err) {
      console.error('Error changing status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select value={lead.status} onValueChange={handleStatusChange} disabled={isLoading}>
      <SelectTrigger className="w-28 h-7 text-xs px-2 py-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}