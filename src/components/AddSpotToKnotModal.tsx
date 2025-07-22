import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import { EventType, KnotType } from '../interfaces';

const appId = "tagknot-app";

interface AddSpotToKnotModalProps {
  spot: EventType;
  onClose: () => void;
  onAddSuccess: () => void;
}

const AddSpotToKnotModal: React.FC<AddSpotToKnotModalProps> = ({ spot, onClose, onAddSuccess }) => {
  const { userId } = useAuth();
  const [userKnots, setUserKnots] = useState<KnotType[]>([]);
  const [loadingKnots, setLoadingKnots] = useState(true);
  const [selectedKnotId, setSelectedKnotId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoadingKnots(false);
      setMessage('Utente non autenticato. Impossibile caricare i Knot.');
      setMessageType('error');
      return;
    }

    const q = query(
      collection(db, `artifacts/${appId}/users/${userId}/knots`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const knots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KnotType));
      setUserKnots(knots);
      setLoadingKnots(false);
    }, (error) => {
      console.error("Error fetching user knots:", error);
      setMessage('Errore nel caricamento dei tuoi Knot.');
      setMessageType('error');
      setLoadingKnots(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleAddToKnot = async () => {
    if (!selectedKnotId) {
      setMessage('Seleziona un Knot a cui aggiungere lo Spot.');
      setMessageType('error');
      return;
    }
    if (!userId) {
      setMessage('Utente non autenticato.');
      setMessageType('error');
      return;
    }

    setIsAdding(true);
    setMessage('');
    setMessageType('');

    try {
      const knotRef = doc(db, `artifacts/${appId}/users/${userId}/knots`, selectedKnotId);
      const publicKnotRef = doc(db, `artifacts/${appId}/public/data/knots`, selectedKnotId);

      // Aggiungi l'ID dello spot all'array spotIds del Knot
      await updateDoc(knotRef, {
        spotIds: arrayUnion(spot.id)
      });

      // Se il knot è pubblico, aggiorna anche la versione pubblica
      const selectedKnot = userKnots.find(k => k.id === selectedKnotId);
      if (selectedKnot && selectedKnot.status === 'public') {
        await updateDoc(publicKnotRef, {
          spotIds: arrayUnion(spot.id)
        });
      }

      setMessage('Spot aggiunto al Knot con successo!');
      setMessageType('success');
      onAddSuccess(); // Chiudi il modale e notifica il successo
    } catch (error) {
      console.error("Error adding spot to knot:", error);
      setMessage('Errore durante l\'aggiunta dello Spot al Knot: ' + (error as Error).message);
      setMessageType('error');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative flex flex-col">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 z-10 p-2 rounded-full bg-white bg-opacity-75">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"> </path></svg>
        </button>

        <div className="p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Aggiungi Spot a Knot</h3>
          <AlertMessage message={message} type={messageType} />

          <p className="text-gray-700 mb-4">Aggiungi lo spot "<span className="font-semibold">#{spot.tag}</span>" a uno dei tuoi Knot:</p>

          {loadingKnots ? (
            <LoadingSpinner message="Caricamento Knot..." />
          ) : userKnots.length === 0 ? (
            <p className="text-gray-600">Non hai ancora creato nessun Knot. Crea prima un Knot per aggiungere Spot.</p>
          ) : (
            <div className="mb-4">
              <label htmlFor="selectKnot" className="block text-sm font-medium text-gray-700 mb-2">Seleziona un Knot:</label>
              <select
                id="selectKnot"
                value={selectedKnotId || ''}
                onChange={(e) => setSelectedKnotId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="">Seleziona un Knot</option>
                {userKnots.map(knot => (
                  <option key={knot.id} value={knot.id}>
                    #{knot.tag} ({knot.spotIds.length} spot)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              disabled={isAdding}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleAddToKnot}
              className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              disabled={isAdding || !selectedKnotId}
            >
              {isAdding ? 'Aggiunta...' : 'Aggiungi a Knot'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSpotToKnotModal;
