import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function LeadsV1Redirect() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Automatic redirect to Lead V2
    navigate(createPageUrl('LeadsV2'), { replace: true });
  }, [navigate]);
  
  return (
    <div className="p-6 text-center">
      <p className="text-slate-600">Redirecting to Leads...</p>
    </div>
  );
}