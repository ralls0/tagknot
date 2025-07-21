import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { UserProfile, UserProfileData, AuthContextType } from '../interfaces';

const appId = "tagknot-app"; // Assicurati che sia lo stesso usato in AppWrapper.tsx

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;

      if (user) {
        setCurrentUser(user);
        setUserId(user.uid);

        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/data`);

        const unsubscribeProfile = onSnapshot(userDocRef, async (docSnap) => {
          if (!isMounted) return;

          if (!docSnap.exists()) {
            const baseUsername = user.email ? user.email.split('@')[0] : `user_${user.uid.substring(0, 8)}`;
            const baseProfileTag = `tag_${user.uid.substring(0, 8)}`;

            const newProfileData: UserProfileData = {
              type: 'user',
              email: user.email,
              username: baseUsername,
              profileTag: baseProfileTag,
              profileImage: '',
              followers: [],
              following: [],
              createdAt: serverTimestamp() as Timestamp,
            };
            try {
              await setDoc(userDocRef, newProfileData);
              setUserProfile({ id: user.uid, ...newProfileData });
            } catch (error) {
              console.error("Error creating new user profile:", error);
            }
          } else {
            setUserProfile({ id: user.uid, ...(docSnap.data() as UserProfileData) });
          }
          setLoading(false);
        }, (error) => {
          if (isMounted) {
            console.error("Error fetching user profile with onSnapshot:", error);
            setLoading(false);
          }
        });

        return unsubscribeProfile;
      } else {
        setCurrentUser(null);
        setUserId(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userId, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    console.error("useAuth must be used within an AuthProvider");
    return { currentUser: null, userId: null, userProfile: null, loading: false };
  }
  return context;
};
