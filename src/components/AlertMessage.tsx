import React from 'react';

const AlertMessage = ({ message, type }: AlertMessageProps) => {
  if (!message) return null;
  const bgColor = type === 'success' ? 'bg-green-100' : 'bg-red-100';
  const textColor = type === 'success' ? 'text-green-800' : 'text-red-800';

  return (
    <div className={`p-3 rounded-lg text-center ${bgColor} ${textColor} mb-4`}>
      {message}
    </div>
  );
};

export default AlertMessage;
