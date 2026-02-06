import React from 'react';

export default function CustomerWelcome({ customerName, boatCount }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Welcome, {customerName}
      </h1>
      <p className="text-slate-600">
        View the status of work on your {boatCount} {boatCount === 1 ? 'vessel' : 'vessels'}
      </p>
    </div>
  );
}