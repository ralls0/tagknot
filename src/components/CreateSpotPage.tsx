import React, { useState, useEffect } from 'react';
import { addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import AlertMessage from './AlertMessage';
import LoadingSpinner from './LoadingSpinner';
import { EventType, EventData } from '../interfaces';

const appId = "tagknot-app"; // Assicurati che sia lo stesso usato in AppWrapper.tsx
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY"; // Placeholder

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
          ctx.drawImage(img, 0, 0, width, height); // Draw image to canvas
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

const CreateSpotPage = ({ onEventCreated, eventToEdit, onCancelEdit }: { onEventCreated: () => void; eventToEdit: EventType | null; onCancelEdit: () => void; }) => {
  const authContext = useAuth();
  const currentUser = authContext?.currentUser;
  const userId = authContext?.userId;
  const userProfile = authContext?.userProfile;

  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageLink, setCoverImageLink] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [taggedUsers, setTaggedUsers] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ description: string; place_id: string }>>([]);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(-1);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (eventToEdit) {
      setTag(eventToEdit.tag.startsWith('#') ? eventToEdit.tag.substring(1) : eventToEdit.tag || '');
      setDescription(eventToEdit.description || '');
      setCoverImageUrl(eventToEdit.coverImage || '');
      setCoverImageLink(eventToEdit.coverImage || '');
      setDate(eventToEdit.date || '');
      setTime(eventToEdit.time || '');
      setLocationName(eventToEdit.locationName || '');
      setLocationCoords(eventToEdit.locationCoords || null);
      setTaggedUsers(eventToEdit.taggedUsers ? eventToEdit.taggedUsers.join(', ') : '');
      setIsPublic(eventToEdit.isPublic);
    } else {
      setTag('');
      setDescription('');
      setCoverImageFile(null);
      setCoverImageUrl('');
      setCoverImageLink('');
      setDate('');
      setTime('');
      setLocationSearch('');
      setLocationName('');
      setLocationCoords(null);
      setTaggedUsers('');
      setIsPublic(true);
    }
  }, [eventToEdit]);

  useEffect(() => {
    let isMounted = true;
    const delayDebounceFn = setTimeout(async () => {
      if (locationSearch.length > 2) {
        setLoadingLocationSuggestions(true);
        try {
          const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(locationSearch)}&key=${GOOGLE_MAPS_API_KEY}&components=country:it&region=it`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          if (isMounted) {
            if (data.predictions) {
              setLocationSuggestions(data.predictions.map((p: any) => ({
                description: p.description,
                place_id: p.place_id
              })));
            } else {
              setLocationSuggestions([]);
            }
          }
        } catch (error) {
          if (isMounted) {
            console.error("Error fetching place suggestions:", error);
            setMessage('Errore nel recupero dei suggerimenti di posizione.');
            setMessageType('error');
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
  }, [locationSearch]);

  const handleSelectLocation = async (suggestion: { description: string; place_id: string }) => {
    setLocationSearch(suggestion.description);
    setLocationName(suggestion.description);
    setLocationSuggestions([]);
    setSelectedLocationIndex(-1);
    setMessage('');
    setMessageType('');

    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?place_id=${suggestion.place_id}&key=${GOOGLE_MAPS_API_KEY}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        setLocationCoords(data.results[0].geometry.location);
      } else {
        setMessage('Impossibile ottenere le coordinate per la posizione selezionata.');
        setMessageType('error');
        setLocationCoords(null);
      }
    } catch (error) {
      console.error("Error fetching geocode for place_id:", error);
      setMessage('Errore nel recupero delle coordinate di posizione.');
      setMessageType('error');
      setLocationCoords(null);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userId) {
      setMessage('Devi essere loggato per creare/modificare uno Spot.');
      setMessageType('error');
      return;
    }

    if (!tag.trim()) {
      setMessage('Il Tag (Titolo Spot) è obbligatorio.');
      setMessageType('error');
      return;
    }
    if (!date || !time) {
      setMessage('Per favore, compila tutti i campi obbligatori (Data, Ora).');
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setMessageType('');

    let finalCoverImageUrl = '';

    if (coverImageLink) {
      finalCoverImageUrl = coverImageLink;
    } else if (coverImageFile) {
      setIsUploadingImage(true);
      try {
        finalCoverImageUrl = await resizeAndConvertToBase64(coverImageFile, 800, 600);
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        setMessage('Errore nel caricamento dell\'immagine. Riprova.');
        setMessageType('error');
        setIsSubmitting(false);
        setIsUploadingImage(false);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    } else if (eventToEdit && eventToEdit.coverImage) {
      finalCoverImageUrl = eventToEdit.coverImage;
    }

    try {
      const eventData: EventData = {
        type: 'event',
        tag: tag.startsWith('#') ? tag : `#${tag}`,
        description,
        coverImage: finalCoverImageUrl,
        date,
        time,
        locationName,
        locationCoords,
        taggedUsers: taggedUsers.split(',').map(u => u.trim()).filter(u => u),
        isPublic,
        creatorId: userId,
        likes: eventToEdit ? eventToEdit.likes : [],
        commentCount: eventToEdit ? eventToEdit.commentCount : 0,
        createdAt: eventToEdit ? eventToEdit.createdAt : serverTimestamp() as Timestamp
      };

      if (eventToEdit) {
        const publicEventRef = doc(db, `artifacts/${appId}/public/data/events`, eventToEdit.id);
        const privateEventRef = doc(db, `artifacts/${appId}/users/${userId}/events`, eventToEdit.id);

        await updateDoc(publicEventRef, { ...eventData });
        await updateDoc(privateEventRef, { ...eventData });

        setMessage('Spot modificato con successo!');
      } else {
        if (isPublic) {
          await addDoc(collection(db, `artifacts/${appId}/public/data/events`), eventData);
        }
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/events`), eventData);
        setMessage('Spot creato con successo!');
      }
      setMessageType('success');
      onEventCreated();
    } catch (error) {
      console.error("Error creating/editing event:", error);
      setMessage('Errore nella creazione/modifica dello Spot: ' + (error as Error).message);
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-8 pb-8 sm:pt-12 sm:pb-12 bg-gray-100 min-h-screen text-gray-800 p-4 font-inter">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-center mb-6 sm:mb-8 text-gray-900"> {eventToEdit ? 'Modifica Spot' : 'Crea Nuovo Spot'} </h1>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-lg border border-gray-100 space-y-5 sm:space-y-6">
        <AlertMessage message={message} type={messageType} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tag"> Tag (Titolo Spot) <span className="text-red-500">* </span></label>
          <input
            type="text"
            id="tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-800 placeholder-gray-400"
            placeholder="Es. Concerto Rock, Cena tra amici"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description"> Descrizione (Opzionale) </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-800 placeholder-gray-400"
            placeholder="Dettagli aggiuntivi sullo Spot..."
          > </textarea>
        </div>
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-2"> Immagine di Copertina (Opzionale) </label>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-4">
            {(coverImageUrl || coverImageLink) && !coverImageFile && (
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-600 mb-2"> Attuale: </p>
                <img src={coverImageLink || coverImageUrl} alt="Anteprima copertina" className="w-24 h-24 object-cover rounded-lg shadow-sm border border-gray-300" />
              </div>
            )}
            {coverImageFile && (
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-600 mb-2"> Selezionata: </p>
                <img src={URL.createObjectURL(coverImageFile)} alt="Anteprima file" className="w-24 h-24 object-cover rounded-lg shadow-sm border border-gray-300" />
              </div>
            )}
          </div>
          <input
            type="text"
            id="coverImageLink"
            value={coverImageLink}
            onChange={(e) => { setCoverImageLink(e.target.value); setCoverImageFile(null); }}
            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-800 placeholder-gray-400 mb-2"
            placeholder="Incolla l'URL di un'immagine"
          />
          <p className="text-center text-gray-500 my-2 text-sm"> -- oppure -- </p>
          <input
            type="file"
            id="coverImageFile"
            accept="image/*"
            onChange={(e) => { setCoverImageFile(e.target.files ? e.target.files[0] : null); setCoverImageLink(''); }}
            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
          />
          {isUploadingImage && (
            <div className="flex items-center justify-center mt-4 text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500 mr-3"> </div>
              Caricamento immagine...
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="date"> Data <span className="text-red-500">* </span></label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-800"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="time"> Ora <span className="text-red-500">* </span></label>
            <input
              type="time"
              id="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-800"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="locationSearch"> Posizione (Opzionale) </label>
          {/* Added relative positioning to this div to contain absolute positioned suggestions */}
          <div className="relative">
            <input
              type="text"
              id="locationSearch"
              value={locationSearch}
              onChange={(e) => { setLocationSearch(e.target.value); setSelectedLocationIndex(-1); }}
              onKeyDown={handleKeyDownOnLocationSearch}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-800 placeholder-gray-400"
              placeholder="Cerca un luogo o inseriscilo manualmente"
            />
            {
              loadingLocationSuggestions && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500"> </div>
                </div>
              )
            }
            {
              locationSuggestions.length > 0 && (
                <ul className="bg-white border border-gray-200 rounded-md mt-1 max-h-48 overflow-y-auto shadow-md absolute z-10 w-full">
                  {
                    locationSuggestions.map((suggestion, index) => (
                      <li
                        key={suggestion.place_id}
                        className={`px-4 py-2 cursor-pointer text-gray-800 hover:bg-gray-100 ${index === selectedLocationIndex ? 'bg-gray-100 font-semibold' : ''}`}
                        onClick={() => handleSelectLocation(suggestion)}
                      >
                        {suggestion.description}
                      </li>
                    ))}
                </ul>
              )
            }
          </div>
          {
            locationName && (
              <p className="text-sm text-gray-600 mt-2"> Posizione selezionata: <span className="font-semibold text-indigo-700"> {locationName} </span></p>
            )
          }
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="taggedUsers"> Tagga Utenti (separati da virgola) </label>
          <input
            type="text"
            id="taggedUsers"
            value={taggedUsers}
            onChange={(e) => setTaggedUsers(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-800 placeholder-gray-400"
            placeholder="username1, username2 (usa il tag profilo)"
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 bg-gray-50"
          />
          <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
            Rendi lo Spot pubblico (visibile nel feed degli utenti che ti seguono)
          </label>
        </div>
        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-md"
          disabled={isSubmitting || isUploadingImage}
        >
          {isSubmitting || isUploadingImage ? (eventToEdit ? 'Salvataggio...' : 'Creazione in corso...') : (eventToEdit ? 'Salva Modifiche' : 'Crea Spot')}
        </button>
        {
          eventToEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-md mt-4"
            >
              Annulla
            </button>
          )
        }
      </form>
    </div>
  );
};

export default CreateSpotPage;
