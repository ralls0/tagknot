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
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          reject(new Error("Impossibile ottenere il contesto del canvas."));
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
  const authContext = useAuth();
  const userId = authContext?.userId;
  const userProfile = authContext?.userProfile;

  const [editTag, setEditTag] = useState(event.tag.startsWith('#') ? event.tag.substring(1) : event.tag || '');
  const [editDescription, setEditDescription] = useState(event.description || '');
  const [editCoverImageFile, setEditCoverImageFile] = useState<File | null>(null);
  const [editCoverImageUrl, setEditCoverImageUrl] = useState(event.coverImage || ''); // URL corrente o Base64
  const [editCoverImageLink, setEditCoverImageLink] = useState(event.coverImage || ''); // Per input URL
  const [editDate, setEditDate] = useState(event.date || '');
  const [editTime, setEditTime] = useState(event.time || '');
  const [editLocationSearch, setEditLocationSearch] = useState(event.locationName || '');
  const [editLocationName, setEditLocationName] = useState(event.locationName || '');
  const [editLocationCoords, setEditLocationCoords] = useState<{ lat: number; lng: number } | null>(event.locationCoords || null);
  const [editTaggedUsers, setEditTaggedUsers] = useState(event.taggedUsers ? event.taggedUsers.join(', ') : '');
  const [editIsPublic, setEditIsPublic] = useState(event.isPublic);
  const [editMessage, setEditMessage] = useState('');
  const [editMessageType, setEditMessageType] = useState<'success' | 'error' | ''>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(-1);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);

  // Logica per i suggerimenti di posizione
  useEffect(() => {
    let isMounted = true;
    const delayDebounceFn = setTimeout(async () => {
      if (editLocationSearch.length > 2) {
        setLoadingLocationSuggestions(true);
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(editLocationSearch)}&addressdetails=1`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          if (isMounted) {
            if (data && data.length > 0) {
              setLocationSuggestions(data.map((p: any) => ({
                display_name: p.display_name,
                lat: p.lat,
                lon: p.lon
              })));
            } else {
              setLocationSuggestions([]);
            }
          }
        } catch (error) {
          if (isMounted) {
            console.error("Error fetching place suggestions from Nominatim:", error);
            setEditMessage('Errore nel recupero dei suggerimenti di posizione.');
            setEditMessageType('error');
            setLocationSuggestions([]);
          }
        } finally {
          if (isMounted) {
            setLoadingLocationSuggestions(false);
          }
        }
      } else {
        if (isMounted) {
          setLocationSuggestions([]);
        }
      }
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [editLocationSearch]);

  const handleSelectLocation = (suggestion: { display_name: string; lat: string; lon: string }) => {
    setEditLocationSearch(suggestion.display_name);
    setEditLocationName(suggestion.display_name);
    setEditLocationCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    setLocationSuggestions([]);
    setSelectedLocationIndex(-1);
    setEditMessage('');
    setEditMessageType('');
  };

  const handleKeyDownOnLocationSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedLocationIndex((prev: number) => Math.min(prev + 1, locationSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedLocationIndex((prev: number) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedLocationIndex !== -1) {
      e.preventDefault();
      handleSelectLocation(locationSuggestions[selectedLocationIndex]);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !userId || !userProfile) {
      setEditMessage('Errore: Dati utente o evento non disponibili.');
      setEditMessageType('error');
      return;
    }

    if (!editTag.trim()) {
      setEditMessage('Il Tag (Titolo Spot) è obbligatorio.');
      setEditMessageType('error');
      return;
    }
    if (!editDate || !editTime) {
      setEditMessage('Per favore, compila tutti i campi obbligatori (Data, Ora).');
      setEditMessageType('error');
      return;
    }
    if (!editLocationName || !editLocationCoords) {
      setEditMessage('Per favore, seleziona una posizione valida dai suggerimenti.');
      setEditMessageType('error');
      return;
    }

    setIsSaving(true);
    setEditMessage('');
    setEditMessageType('');

    let finalCoverImageUrl = editCoverImageUrl;

    if (editCoverImageLink) {
      finalCoverImageUrl = editCoverImageLink;
    } else if (editCoverImageFile) {
      setIsUploadingImage(true);
      try {
        finalCoverImageUrl = await resizeAndConvertToBase64(editCoverImageFile, 800, 600);
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        setEditMessage('Errore nel caricamento dell\'immagine. Riprova.');
        setEditMessageType('error');
        setIsSaving(false);
        setIsUploadingImage(false);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    try {
      const updatedEventData: Partial<EventData> = {
        tag: editTag.startsWith('#') ? editTag : `#${editTag}`,
        description: editDescription,
        coverImage: finalCoverImageUrl,
        date: editDate,
        time: editTime,
        locationName: editLocationName,
        locationCoords: editLocationCoords,
        taggedUsers: editTaggedUsers.split(',').map(u => u.trim()).filter(u => u),
        isPublic: editIsPublic,
        // Questi campi non dovrebbero essere modificati tramite questo form
        // creatorId, creatorUsername, creatorProfileImage, likes, commentCount, createdAt
      };

      const publicEventRef = doc(db, `artifacts/${appId}/public/data/events`, event.id);
      const privateEventRef = doc(db, `artifacts/${appId}/users/${userId}/events`, event.id);

      const batch = writeBatch(db);
      batch.update(publicEventRef, updatedEventData);
      // Aggiorna il documento privato solo se l'utente corrente è il creatore
      if (event.creatorId === userId) {
        batch.update(privateEventRef, updatedEventData);
      }
      await batch.commit();

      setEditMessage('Spot aggiornato con successo!');
      setEditMessageType('success');
      onSaveSuccess(); // Notifica il componente padre del successo
    } catch (error) {
      console.error("Error saving event edits:", error);
      setEditMessage('Errore durante il salvataggio delle modifiche: ' + (error as Error).message);
      setEditMessageType('error');
    } finally {
      setIsSaving(false);
    }
  };

  const defaultCoverImage = editLocationName ?
    `https://placehold.co/600x400/E0E0E0/888?text=${encodeURIComponent(editLocationName.split(',')[0])}` :
    'https://placehold.co/600x400/E0E0E0/888?text=Nessuna+Immagine';

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative flex flex-col h-full md:h-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 z-10 p-2 rounded-full bg-white bg-opacity-75">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"> </path></svg>
        </button>

        <form onSubmit={handleSaveEdit} className="flex flex-col h-full">
          <div className="p-6 flex-grow overflow-y-auto">
            <h3 className="text-3xl font-bold text-gray-800 mb-3">Modifica Spot</h3>
            <AlertMessage message={editMessage} type={editMessageType} />

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editTag"> Tag (Titolo Spot) </label>
              <input
                type="text"
                id="editTag"
                value={editTag}
                onChange={(e) => setEditTag(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editDescription"> Descrizione </label>
              <textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              > </textarea>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editCoverImageLink"> URL Immagine di Copertina (Opzionale) </label>
              <input
                type="text"
                id="editCoverImageLink"
                value={editCoverImageLink}
                onChange={(e) => { setEditCoverImageLink(e.target.value); setEditCoverImageFile(null); }}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
                placeholder="Incolla l'URL di un'immagine"
              />
              <p className="text-center text-gray-500 my-2"> --OPPURE --</p>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editCoverImageFile"> Carica Immagine di Copertina (Opzionale) </label>
              <input
                type="file"
                id="editCoverImageFile"
                accept="image/*"
                onChange={(e) => { setEditCoverImageFile(e.target.files ? e.target.files[0] : null); setEditCoverImageLink(''); }}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              {isUploadingImage && (
                <div className="flex items-center justify-center mt-4 text-gray-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"> </div>
                  Caricamento immagine...
                </div>
              )}
              {
                (editCoverImageUrl && !editCoverImageFile && !editCoverImageLink) || (editCoverImageLink && !editCoverImageFile) ? (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2"> Immagine attuale: </p>
                    <img src={editCoverImageLink || editCoverImageUrl} alt="Anteprima copertina" className="w-32 h-32 object-cover rounded-lg border border-gray-300" />
                  </div>
                ) : editCoverImageFile && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2"> Anteprima file selezionato: </p>
                    <img src={URL.createObjectURL(editCoverImageFile)} alt="Anteprima copertina" className="w-32 h-32 object-cover rounded-lg border border-gray-300" />
                  </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editDate"> Data </label>
                <input
                  type="date"
                  id="editDate"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editTime"> Ora </label>
                <input
                  type="time"
                  id="editTime"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editLocationSearch"> Ricerca Posizione </label>
              <input
                type="text"
                id="editLocationSearch"
                value={editLocationSearch}
                onChange={(e) => { setEditLocationSearch(e.target.value); setSelectedLocationIndex(-1); }}
                onKeyDown={handleKeyDownOnLocationSearch}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="Cerca città, indirizzo..."
                required
              />
              {
                loadingLocationSuggestions && (
                  <div className="flex items-center justify-center mt-2 text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-500 mr-2"> </div>
                    Caricamento suggerimenti...
                  </div>
                )
              }
              {
                locationSuggestions.length > 0 && (
                  <ul className="bg-white border border-gray-300 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {
                      locationSuggestions.map((suggestion, index) => (
                        <li
                          key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${index === selectedLocationIndex ? 'bg-gray-100' : ''}`}
                          onClick={() => handleSelectLocation(suggestion)}
                        >
                          {suggestion.display_name}
                        </li>
                      ))}
                  </ul>
                )
              }
              {
                editLocationName && (
                  <p className="text-sm text-gray-600 mt-2"> Posizione selezionata: <span className="font-semibold"> {editLocationName} </span></p>
                )
              }
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editTaggedUsers"> Tagga Utenti (separati da virgola) </label>
              <input
                type="text"
                id="editTaggedUsers"
                value={editTaggedUsers}
                onChange={(e) => setEditTaggedUsers(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
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
          </div>
          <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
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
