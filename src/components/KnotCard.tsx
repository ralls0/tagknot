import React from 'react';
import { KnotType } from '../interfaces';
import UserAvatar from './UserAvatar';

interface KnotCardProps {
  knot: KnotType;
  // Aggiungi qui altre props se necessarie per interazioni (es. onShowKnotDetail, onEditKnot, onDeleteKnot)
}

const KnotCard: React.FC<KnotCardProps> = ({ knot }) => {
  const defaultCoverImage = knot.locationName ?
    `https://placehold.co/600x400/E0E0E0/888?text=${encodeURIComponent(knot.locationName.split(',')[0])}` :
    'https://placehold.co/600x400/E0E0E0/888?text=Nessuna+Immagine';

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col transition-transform duration-200 ease-in-out hover:scale-[1.01] hover:shadow-xl relative">
      {knot.coverImage ? (
        <img
          src={knot.coverImage}
          alt={knot.tag}
          className="w-full h-48 object-cover"
          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultCoverImage; }}
        />
      ) : (
        <img
          src={defaultCoverImage}
          alt={knot.tag}
          className="w-full h-48 object-cover"
        />
      )}

      <div className="p-4">
        <h3 className="text-xl font-bold text-gray-800 mb-2 truncate">#{knot.tag} </h3>
        {knot.description && <p className="text-gray-700 text-sm mb-3 truncate"> {knot.description} </p>}
        <div className="text-gray-600 text-xs space-y-1">
          <p className="flex items-center">
            <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Dal {new Date(knot.startDate).toLocaleDateString('it-IT')} al {new Date(knot.endDate).toLocaleDateString('it-IT')}
          </p>
          {knot.locationName && (
            <p className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span className="truncate">{knot.locationName}</span>
            </p>
          )}
          <p className="flex items-center">
            <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Stato: {knot.status === 'public' ? 'Pubblico' : knot.status === 'private' ? 'Privato' : 'Interno'}
          </p>
          <p className="flex items-center">
            <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
            Spot inclusi: {knot.spotIds.length}
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserAvatar
            imageUrl={knot.creatorProfileImage}
            username={knot.creatorUsername}
            size="sm"
          />
          <span className="text-sm font-semibold text-gray-800"> {knot.creatorUsername} </span>
        </div>
        {/* Qui potresti aggiungere pulsanti di azione specifici per i Knot, come "Modifica Knot" o "Elimina Knot" */}
      </div>
    </div>
  );
};

export default KnotCard;
