import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AlertMessage from './AlertMessage';
import { NotificationType } from '../interfaces';

const appId = "tagknot-app"; // Assicurati che sia lo stesso usato in AppWrapper.tsx

const NotificationsPage = ({ setUnreadNotificationsCount }: { setUnreadNotificationsCount: React.Dispatch<React.SetStateAction<number>> }) => {
  const authContext = useAuth();
  const userId = authContext?.userId;
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      if (isMounted) {
        setLoading(false);
        setMessage('Devi essere loggato per vedere le notifiche.');
        setMessageType('error');
      }
      return;
    }

    const q = query(
      collection(db, `artifacts/${appId}/users/${userId}/notifications`),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isMounted) {
        setUnreadNotificationsCount(snapshot.size);
        const fetchedNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as NotificationType) }));
        setNotifications(fetchedNotifications);
        setLoading(false);
        setMessage('');
        setMessageType('');
      }
    }, (error) => {
      if (isMounted) {
        console.error("Error fetching notifications:", error);
        setMessage('Errore nel caricamento delle notifiche.');
        setMessageType('error');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId, setUnreadNotificationsCount]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/notifications`, notificationId), {
        read: true
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      setMessage('Errore nel contrassegnare la notifica come letta.');
      setMessageType('error');
    }
  };

  const markAllAsRead = async () => {
    if (!userId) {
      setMessage('Utente non autenticato.');
      setMessageType('error');
      return;
    }
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      if (unreadNotifications.length === 0) {
        setMessage('Nessuna nuova notifica da leggere.');
        setMessageType('success');
        return;
      }
      const batch = writeBatch(db);
      unreadNotifications.forEach(n => {
        batch.update(doc(db, `artifacts/${appId}/users/${userId}/notifications`, n.id), { read: true });
      });
      await batch.commit();
      setMessage('Tutte le notifiche sono state contrassegnate come lette.');
      setMessageType('success');
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      setMessage('Errore nel contrassegnare tutte le notifiche come lette.');
      setMessageType('error');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Caricamento notifiche..." />;
  }

  return (
    <div className="pt-20 pb-20 md:pt-24 md:pb-8 bg-gray-100 min-h-screen text-gray-800 p-4">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800"> Notifiche </h1>
      <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-200 space-y-4">
        <AlertMessage message={message} type={messageType} />
        {
          notifications.length > 0 && (
            <div className="text-right">
              <button
                onClick={markAllAsRead}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Segna tutte come lette
              </button>
            </div>
          )
        }
        {
          notifications.length === 0 ? (
            <p className="text-center text-gray-600"> Nessuna notifica.</p>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border border-gray-200 flex items-start space-x-4 ${!notification.read ? 'bg-gray-50 font-semibold' : 'bg-white'}`}
              >
                {
                  notification.imageUrl && (
                    <img src={notification.imageUrl} alt="Event Cover" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                  )}
                <div className="flex-grow">
                  <p className="text-gray-800"> {notification.message} </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {notification.createdAt?.toDate ? new Date(notification.createdAt.toDate()).toLocaleString('it-IT') : 'Data sconosciuta'}
                  </p>
                </div>
                {
                  !notification.read && (
                    <button onClick={() => markAsRead(notification.id)} className="flex-shrink-0 text-gray-500 hover:text-gray-800">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"> </path></svg>
                    </button>
                  )
                }
              </div>
            ))
          )}
      </div>
    </div>
  );
};

export default NotificationsPage;
