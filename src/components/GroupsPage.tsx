import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import { GroupType, GroupsPageProps, GroupData } from '../interfaces'; // Importa GroupData
import UserAvatar from './UserAvatar'; // Per visualizzare l'immagine del gruppo

const appId = "tagknot-app";

const GroupsPage: React.FC<GroupsPageProps> = ({ onShowGroupDetail, onShowCreateGroup }) => {
  const { userId, loading: authLoading } = useAuth();
  const [userGroups, setUserGroups] = useState<GroupType[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      if (isMounted) {
        setLoadingGroups(false);
        setMessage('Devi essere loggato per vedere i tuoi gruppi.');
        setMessageType('error');
      }
      return;
    }

    // Query per recuperare i gruppi di cui l'utente è membro
    const q = query(
      collection(db, `artifacts/${appId}/public/data/groups`),
      where('members', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isMounted) {
        const groups: GroupType[] = [];
        snapshot.forEach(doc => {
          // Correzione qui: cast a GroupData e poi aggiungi l'id
          groups.push({ id: doc.id, ...(doc.data() as GroupData) });
        });
        setUserGroups(groups);
        setLoadingGroups(false);
      }
    }, (error) => {
      if (isMounted) {
        console.error("Error fetching user groups:", error);
        setMessage('Errore durante il caricamento dei gruppi.');
        setMessageType('error');
        setLoadingGroups(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId]);

  if (authLoading || loadingGroups) {
    return <LoadingSpinner message="Caricamento gruppi..." />;
  }

  return (
    <div className="pt-20 pb-16 md:pt-24 md:pb-8 bg-gray-100 min-h-screen"> {/* Aggiunto pt-20 per Navbar */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 mt-8">
        <h2 className="text-3xl font-extrabold text-gray-800 text-center mb-6">I Miei Gruppi</h2>
        <AlertMessage message={message} type={messageType} />

        <div className="flex justify-center mb-6">
          <button
            onClick={onShowCreateGroup}
            className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Crea Nuovo Gruppo
          </button>
        </div>

        {userGroups.length === 0 ? (
          <p className="text-center text-gray-600">Non fai parte di nessun gruppo. Crea il tuo primo gruppo!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userGroups.map(group => (
              <div
                key={group.id}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col transition-transform duration-200 ease-in-out hover:scale-[1.01] hover:shadow-xl cursor-pointer"
                onClick={() => onShowGroupDetail(group)}
              >
                <div className="relative h-40 w-full">
                  {group.profileImage ? (
                    <img src={group.profileImage} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 text-xl font-bold">
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex items-center space-x-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                    <span>{group.members.length} membri</span>
                  </div>
                </div>
                <div className="p-4 flex-grow">
                  <h3 className="text-xl font-bold text-gray-800 mb-2 truncate">{group.name}</h3>
                  {group.description && <p className="text-gray-700 text-sm truncate">{group.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupsPage;
