import React from 'react';

const ConfirmationModal = ({ message, onConfirm, onCancel, show }: { message: string; onConfirm: () => void; onCancel: () => void; show: boolean }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <p className="text-lg font-semibold text-gray-800 mb-6"> {message} </p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-lg"
          >
            Conferma
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-lg"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
