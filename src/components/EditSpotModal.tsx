import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, Timestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import AlertMessage from './AlertMessage';
import LoadingSpinner from './LoadingSpinner';
import { EventType, EventData } from '../interfaces';

const appId = "tagknot-app";

// Funzione per ridimensionare e convertire un'immagine in Base64
const resizeAndConvertToBase64 = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8)); // Comprimi a JPEG con qualità 0.8
        } else {
          reject(new Error("Could not get 2D context for canvas"));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

interface EditSpotModalProps {
  event: EventType;
  onClose: () => void;
  onSaveSuccess: () => void;
}

const EditSpotModal: React.FC<EditSpotModalProps> = ({ event, onClose, onSaveSuccess }) => {
  const { userId, userProfile } = useAuth();
  const [editTag, setEditTag] = useState(event.tag);
  const [editDescription, setEditDescription] = useState(event.description);
  const [editCoverImageFile, setEditCoverImageFile] = useState<File | null>(null);
  const [editCoverImageUrl, setEditCoverImageUrl] = useState(event.coverImage); // Per mostrare l'immagine esistente
  const [editDate, setEditDate] = useState(event.date);
  const [editTime, setEditTime] = useState(event.time);
  const [editLocationName, setEditLocationName] = useState(event.locationName);
  const [editLocationCoords, setEditLocationCoords] = useState(event.locationCoords);
  const [editTaggedUsersInput, setEditTaggedUsersInput] = useState(event.taggedUsers.join(', '));
  const [editIsPublic, setEditIsPublic] = useState(event.isPublic);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    // Reset message when modal opens or event changes
    setMessage('');
    setMessageType('');
  }, [event]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEditCoverImageFile(e.target.files[0]);
    }
  };

  const handleLocationSearch = async () => {
    if (!editLocationName.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(editLocationName)}&format=json&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        setEditLocationCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        setMessage('Posizione trovata!');
        setMessageType('success');
      } else {
        setEditLocationCoords(null);
        setMessage('Posizione non trovata. Inserisci manualmente o riprova.');
        setMessageType('error');
      }
    } catch (error) {
      console.error("Error fetching location:", error);
      setMessage('Errore durante la ricerca della posizione.');
      setMessageType('error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !userProfile) {
      setMessage('Utente non autenticato. Impossibile salvare le modifiche.');
      setMessageType('error');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setMessageType('');
    let finalCoverImage = editCoverImageUrl; // Inizia con l'immagine esistente

    try {
      if (editCoverImageFile) {
        setIsUploadingImage(true);
        finalCoverImage = await resizeAndConvertToBase64(editCoverImageFile, 800, 600);
        setIsUploadingImage(false);
      }

      const parsedTaggedUsers = editTaggedUsersInput.split(',').map(t => t.trim()).filter(t => t);

      // Crea un oggetto con i campi da aggiornare
      const fieldsToUpdate = {
        tag: editTag,
        description: editDescription,
        coverImage: finalCoverImage,
        date: editDate,
        time: editTime,
        locationName: editLocationName,
        locationCoords: editLocationCoords,
        taggedUsers: parsedTaggedUsers,
        isPublic: editIsPublic,
      };

      const eventRef = doc(db, `artifacts/${appId}/users/${userId}/events`, event.id);
      const publicEventRef = doc(db, `artifacts/${appId}/public/data/events`, event.id);

      const batch = writeBatch(db);

      // Aggiorna sempre il documento privato dell'utente
      batch.update(eventRef, fieldsToUpdate);

      // Gestisci il cambiamento di stato pubblico
      if (editIsPublic && !event.isPublic) { // Lo spot è diventato pubblico
        // Quando si rende pubblico, si usa setDoc con lo stesso ID per creare la copia pubblica
        batch.set(publicEventRef, { ...event, ...fieldsToUpdate }); // Copia nella collezione pubblica, mantenendo l'ID originale
      } else if (!editIsPublic && event.isPublic) { // Lo spot è diventato privato
        batch.delete(publicEventRef); // Rimuovi dalla collezione pubblica
      } else if (editIsPublic && event.isPublic) { // Lo spot era e rimane pubblico, aggiorna la copia pubblica
        batch.update(publicEventRef, fieldsToUpdate);
      }

      await batch.commit();

      setMessage('Spot aggiornato con successo!');
      setMessageType('success');
      onSaveSuccess(); // Notifica il componente padre
    } catch (error) {
      console.error("Error saving event:", error);
      setMessage('Errore durante il salvataggio delle modifiche. Riprova.');
      setMessageType('error');
    } finally {
      setIsSaving(false);
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <form onSubmit={handleSave} className="flex flex-col flex-grow"> {/* Form wraps content and buttons */}
          <div className="p-6 sm:p-8 overflow-y-auto flex-grow"> {/* Scrollable content inside form */}
            <h2 className="text-3xl font-extrabold text-gray-800 text-center mb-6">Modifica Spot</h2>
            <AlertMessage message={message} type={messageType} />

            <div className="space-y-6"> {/* All form fields */}
              <div>
                <label htmlFor="editTag" className="block text-sm font-medium text-gray-700 mb-1">Tag Spot</label>
                <input
                  type="text"
                  id="editTag"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="editDescription" className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <textarea
                  id="editDescription"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                ></textarea>
              </div>
              <div>
                <label htmlFor="editCoverImage" className="block text-sm font-medium text-gray-700 mb-1">Immagine di Copertina</label>
                <input
                  type="file"
                  id="editCoverImage"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                {isUploadingImage && (
                  <div className="flex items-center justify-center mt-2 text-gray-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"></div>
                    Caricamento immagine...
                  </div>
                )}
                {(editCoverImageUrl || editCoverImageFile) && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600 mb-2">Anteprima Immagine:</p>
                    <img
                      src={editCoverImageFile ? URL.createObjectURL(editCoverImageFile) : editCoverImageUrl || ''}
                      alt="Anteprima Copertina"
                      className="max-w-full h-auto rounded-lg shadow-md mx-auto"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="editDate" className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input
                    type="date"
                    id="editDate"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="editTime" className="block text-sm font-medium text-gray-700 mb-1">Ora</label>
                  <input
                    type="time"
                    id="editTime"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="editLocation" className="block text-sm font-medium text-gray-700 mb-1">Posizione</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="editLocation"
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                    value={editLocationName}
                    onChange={(e) => setEditLocationName(e.target.value)}
                    placeholder="Es. Roma, Colosseo"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleLocationSearch}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
                  >
                    Cerca
                  </button>
                </div>
                {editLocationCoords && (
                  <p className="text-sm text-gray-500 mt-1">Coordinate: {editLocationCoords.lat}, {editLocationCoords.lng}</p>
                )}
              </div>
              <div>
                <label htmlFor="editTaggedUsers" className="block text-sm font-medium text-gray-700 mb-1">Tagga Utenti (separati da virgola, usa il tag profilo)</label>
                <input
                  type="text"
                  id="editTaggedUsers"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  value={editTaggedUsersInput}
                  onChange={(e) => setEditTaggedUsersInput(e.target.value)}
                  placeholder="username1, username2 (usa il tag profilo)"
                />
              </div>

              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="editIsPublic"
                  checked={editIsPublic}
                  onChange={(e) => setEditIsPublic(e.target.checked)}
                  className="h-5 w-5 text-gray-700 rounded border-gray-300 focus:ring-gray-500"
                />
                <label htmlFor="editIsPublic" className="ml-2 block text-sm text-gray-700">
                  Rendi lo Spot pubblico
                </label>
              </div>
            </div> {/* End of space-y-6 div (all form fields) */}
          </div> {/* End of p-6 sm:p-8 overflow-y-auto flex-grow div */}

          <div className="p-6 border-t border-gray-200 flex justify-end space-x-4"> {/* Buttons div */}
            <button
              type="button"
              onClick={onClose} // Chiudi il modale senza salvare
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              disabled={isSaving}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md"
              disabled={isSaving || isUploadingImage}
            >
              {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSpotModal;
