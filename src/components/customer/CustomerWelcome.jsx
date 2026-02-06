import React from 'react';

export default function CustomerWelcome({ customerName, boatName }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">
        Welcome to the Alpha Yachting App, {customerName}
      </h1>
      {boatName && (
        <p className="text-slate-600 text-lg">
          Viewing projects for {boatName}
        </p>
      )}
      <p className="text-slate-600 text-lg mt-1">
        Here you can view the status of work on your vessels
      </p>
    </div>
  );
}