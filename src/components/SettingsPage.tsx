import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import AlertMessage from './AlertMessage';
import LoadingSpinner from './LoadingSpinner';
import UserAvatar from './UserAvatar';
import { UserProfileData } from '../interfaces';

const appId = "tagknot-app"; // Assicurati che sia lo stesso usato in AppWrapper.tsx

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

const SettingsPage = ({ onNavigate }: { onNavigate: (page: string, id?: string | null) => void }) => {
  const authContext = useAuth();
  const userId = authContext?.userId;
  const userProfile = authContext?.userProfile;

  const [username, setUsername] = useState('');
  const [profileTag, setProfileTag] = useState('');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setUsername(userProfile.username || '');
      setProfileTag(userProfile.profileTag || '');
      setProfileImageUrl(userProfile.profileImage || '');
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setMessage('Devi essere loggato per modificare le impostazioni.');
      setMessageType('error');
      return;
    }

    if (!username.trim() || !profileTag.trim()) {
      setMessage('Username e Tag Profilo sono obbligatori.');
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setMessageType('');

    let finalProfileImageUrl = profileImageUrl;
    if (profileImageFile) {
      setIsUploadingImage(true);
      try {
        finalProfileImageUrl = await resizeAndConvertToBase64(profileImageFile, 200, 200);
      } catch (uploadError) {
        console.error("Error uploading profile image:", uploadError);
        setMessage('Errore nel caricamento dell\'immagine del profilo. Riprova.');
        setMessageType('error');
        setIsSubmitting(false);
        setIsUploadingImage(false);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    try {
      const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/data`);

      await updateDoc(userDocRef, {
        username: username,
        profileTag: profileTag,
        profileImage: finalProfileImageUrl,
      });
      setMessage('Impostazioni aggiornate con successo!');
      setMessageType('success');

    } catch (error) {
      console.error("Error updating settings:", error);
      setMessage('Errore nell\'aggiornamento delle impostazioni: ' + (error as Error).message);
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        onNavigate('myProfile');
      }, 1500);
    }
  };

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800"> Impostazioni Profilo </h1>
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-200 space-y-6">
        <AlertMessage message={message} type={messageType} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="username"> Nome Utente </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profileTag"> Tag Profilo Unico (es. @tuo_tag) </label>
          <input
            type="text"
            id="profileTag"
            value={profileTag}
            onChange={(e) => setProfileTag(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Il tuo ID utente univoco di Firebase (`userId`) non può essere modificato. Questo "Tag Profilo" è un nome visualizzato che puoi impostare.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profileImageFile"> Immagine del Profilo </label>
          <input
            type="file"
            id="profileImageFile"
            accept="image/*"
            onChange={(e) => setProfileImageFile(e.target.files ? e.target.files[0] : null)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          {isUploadingImage && (
            <div className="flex items-center justify-center mt-4 text-gray-600">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mr-3"> </div>
              Caricamento immagine...
            </div>
          )}
          {
            (profileImageUrl || profileImageFile) && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 mb-2"> Anteprima Immagine Profilo (circolare): </p>
                <UserAvatar
                  imageUrl={profileImageFile ? URL.createObjectURL(profileImageFile) : profileImageUrl}
                  username={username}
                  size="xl"
                  className="mx-auto border-4 border-gray-300 shadow-md"
                />
                <p className="text-xs text-gray-500 mt-2"> L'immagine verrà ritagliata per adattarsi al cerchio.</p>
              </div>
            )}
        </div>
        <button
          type="submit"
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg"
          disabled={isSubmitting || isUploadingImage}
        >
          {isSubmitting || isUploadingImage ? 'Salvataggio...' : 'Salva Impostazioni'}
        </button>
      </form>
    </div>
  );
};

export default SettingsPage;
