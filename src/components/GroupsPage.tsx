import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import GroupCard from './GroupCard'; // Importa il nuovo GroupCard
import { GroupType, GroupsPageProps, GroupData } from '../interfaces'; // Importa GroupData

const appId = "tagknot-app";

const GroupsPage: React.FC<GroupsPageProps> = ({ onShowCreateGroup, onShowGroupDetail }) => {
  const { userId, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      if (isMounted) {
        setLoadingGroups(false);
        setMessage('Devi essere loggato per vedere i gruppi.');
        setMessageType('error');
      }
      return;
    }

    // Query per i gruppi pubblici a cui l'utente è membro
    const q = query(
      collection(db, `artifacts/${appId}/public/data/groups`),
      orderBy('createdAt', 'desc') // Ordina per data di creazione
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isMounted) {
        const fetchedGroups: GroupType[] = [];
        snapshot.forEach(doc => {
          // Correzione qui: cast doc.data() a GroupData (che non include 'id')
          const groupData = doc.data() as GroupData;
          // Filtra i gruppi di cui l'utente è membro lato client (le regole di sicurezza gestiscono l'accesso)
          if (groupData.members.includes(userId)) {
            fetchedGroups.push({ id: doc.id, ...groupData }); // Combina l'id del documento con i dati
          }
        });
        setGroups(fetchedGroups);
        setLoadingGroups(false);
      }
    }, (error) => {
      if (isMounted) {
        console.error("Error fetching groups:", error);
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
    <div className="pt-20 pb-16 md:pt-24 md:pb-8 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">I Miei Gruppi</h1>

        {message && <AlertMessage message={message} type={messageType} />}

        <div className="flex justify-center mb-8">
          <button
            onClick={onShowCreateGroup}
            className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-lg flex items-center space-x-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            <span>Crea Nuovo Gruppo</span>
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="text-center text-gray-600 text-lg">Non sei ancora membro di alcun gruppo. Creane uno o fatti invitare!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                onShowGroupDetail={onShowGroupDetail} // Passa la prop
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupsPage;
