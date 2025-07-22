import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import AlertMessage from './AlertMessage';
import LoadingSpinner from './LoadingSpinner';
import { KnotType, KnotData } from '../interfaces';

const appId = "tagknot-app";

// Funzione per ridimensionare e convertire un'immagine in Base64 (copiata da EditSpotModal)
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

interface EditKnotModalProps {
  knot: KnotType;
  onClose: () => void;
  onSaveSuccess: () => void;
}

const EditKnotModal: React.FC<EditKnotModalProps> = ({ knot, onClose, onSaveSuccess }) => {
  const authContext = useAuth();
  const userId = authContext?.userId;
  const userProfile = authContext?.userProfile;

  const [editTag, setEditTag] = useState(knot.tag || '');
  const [editDescription, setEditDescription] = useState(knot.description || '');
  const [editCoverImageFile, setEditCoverImageFile] = useState<File | null>(null);
  const [editCoverImageUrl, setEditCoverImageUrl] = useState(knot.coverImage || '');
  const [editCoverImageLink, setEditCoverImageLink] = useState(knot.coverImage || '');
  const [editStartDate, setEditStartDate] = useState(knot.startDate || '');
  const [editEndDate, setEditEndDate] = useState(knot.endDate || '');
  const [editLocationSearch, setEditLocationSearch] = useState(knot.locationName || '');
  const [editLocationName, setEditLocationName] = useState(knot.locationName || '');
  const [editLocationCoords, setEditLocationCoords] = useState<{ lat: number; lng: number } | null>(knot.locationCoords || null);
  const [editStatus, setEditStatus] = useState<'public' | 'private' | 'internal'>(knot.status);
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
      if (editLocationSearch.length > 2 && (!editLocationName || editLocationSearch !== editLocationName)) {
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
  }, [editLocationSearch, editLocationName]);

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
    if (!knot || !userId || !userProfile) {
      setEditMessage('Errore: Dati utente o knot non disponibili.');
      setEditMessageType('error');
      return;
    }

    if (!editTag.trim()) {
      setEditMessage('Il Tag (Titolo Knot) è obbligatorio.');
      setEditMessageType('error');
      return;
    }
    if (!editStartDate || !editEndDate) {
      setEditMessage('Per favore, compila tutti i campi obbligatori (Data Inizio, Data Fine).');
      setEditMessageType('error');
      return;
    }
    if (new Date(editStartDate) > new Date(editEndDate)) {
      setEditMessage('La Data di Inizio del Knot non può essere successiva alla Data di Fine.');
      setEditMessageType('error');
      return;
    }
    if (editLocationSearch && (!editLocationName || !editLocationCoords)) {
      setEditMessage('Per favore, seleziona una posizione valida dai suggerimenti o lascia il campo Ricerca Posizione vuoto.');
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
      const updatedKnotData: Partial<KnotData> = {
        tag: editTag,
        description: editDescription,
        coverImage: finalCoverImageUrl,
        startDate: editStartDate,
        endDate: editEndDate,
        locationName: editLocationName || undefined,
        locationCoords: editLocationCoords || undefined,
        status: editStatus,
      };

      const privateKnotRef = doc(db, `artifacts/${appId}/users/${userId}/knots`, knot.id);
      const publicKnotRef = doc(db, `artifacts/${appId}/public/data/knots`, knot.id);

      const batch = writeBatch(db);
      batch.update(privateKnotRef, updatedKnotData);

      // Gestisci la visibilità pubblica
      if (editStatus === 'public') {
        // Se il knot diventa pubblico o rimane pubblico, aggiorna/crea la versione pubblica
        batch.set(publicKnotRef, { ...knot, ...updatedKnotData, createdAt: knot.createdAt }, { merge: true });
      } else { // editStatus is 'private' or 'internal'
        // Se il knot era pubblico e ora non lo è più, elimina la versione pubblica
        if (knot.status === 'public') {
          batch.delete(publicKnotRef);
        }
        // Se era già privato/interno, non fare nulla sulla versione pubblica
      }

      await batch.commit();

      setEditMessage('Knot aggiornato con successo!');
      setEditMessageType('success');
      onSaveSuccess();
    } catch (error) {
      console.error("Error saving knot edits:", error);
      setEditMessage('Errore durante il salvataggio delle modifiche al Knot: ' + (error as Error).message);
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
            <h3 className="text-3xl font-bold text-gray-800 mb-3">Modifica Knot</h3>
            <AlertMessage message={editMessage} type={editMessageType} />

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editTag"> Tag (Titolo Knot) </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editStartDate"> Data Inizio </label>
                <input
                  type="date"
                  id="editStartDate"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editEndDate"> Data Fine </label>
                <input
                  type="date"
                  id="editEndDate"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editLocationSearch"> Ricerca Posizione (Opzionale) </label>
              <input
                type="text"
                id="editLocationSearch"
                value={editLocationSearch}
                onChange={(e) => {
                  setEditLocationSearch(e.target.value);
                  if (e.target.value !== editLocationName) {
                    setEditLocationName('');
                    setEditLocationCoords(null);
                  }
                  setSelectedLocationIndex(-1);
                }}
                onKeyDown={handleKeyDownOnLocationSearch}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                placeholder="Cerca città, indirizzo..."
              />
              {
                loadingLocationSuggestions && (
                  <div className="flex items-center justify-center mt-2 text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-500 mr-2"> </div>
                    Caricamento suggerimenti...
                  </div>
                )
              }
              {locationSuggestions.length > 0 && !(editLocationSearch === editLocationName && editLocationCoords) && (
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
              )}
              {
                editLocationName && (
                  <p className="text-sm text-gray-600 mt-2"> Posizione selezionata: <span className="font-semibold"> {editLocationName} </span></p>
                )
              }
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="editStatus"> Stato del Knot </label>
              <select
                id="editStatus"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as 'public' | 'private' | 'internal')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="public">Pubblico (visibile a tutti)</option>
                <option value="private">Privato (visibile solo a te)</option>
                <option value="internal">Interno (visibile a gruppi specifici - funzionalità futura)</option>
              </select>
            </div>
          </div>
          <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
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

export default EditKnotModal;
