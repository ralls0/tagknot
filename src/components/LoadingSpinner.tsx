import React from 'react';

const LoadingSpinner = ({ message = 'Caricamento...' }: { message?: string }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-800">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-500"></div>
    <p className="ml-4 text-xl mt-4">{message}</p>
  </div>
);

export default LoadingSpinner;
