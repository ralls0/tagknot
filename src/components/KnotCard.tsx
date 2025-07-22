import React, { useState } from 'react';
import { KnotType } from '../interfaces';
import UserAvatar from './UserAvatar';

interface KnotCardProps {
  knot: KnotType;
  onEditKnot: (knot: KnotType) => void;
  onDeleteKnot: (knotId: string) => Promise<void>;
  onShowKnotDetail: (knot: KnotType) => void; // Nuova prop
}

const KnotCard: React.FC<KnotCardProps> = ({ knot, onEditKnot, onDeleteKnot, onShowKnotDetail }) => {
  const [showMenu, setShowMenu] = useState(false);

  const defaultCoverImage = knot.locationName ?
    `https://placehold.co/600x400/E0E0E0/888?text=${encodeURIComponent(knot.locationName.split(',')[0])}` :
    'https://placehold.co/600x400/E0E0E0/888?text=Nessuna+Immagine';

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(prev => !prev);
  };

  const handleCardClick = () => {
    onShowKnotDetail(knot); // Chiama la funzione per mostrare il dettaglio del knot
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col transition-transform duration-200 ease-in-out hover:scale-[1.01] hover:shadow-xl relative">
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={toggleMenu}
          className="p-2 rounded-full bg-white bg-opacity-75 hover:bg-opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
          aria-label="Opzioni knot"
        >
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"></path>
          </svg>
        </button>
        {showMenu && (
          <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg py-1 z-20">
            <button
              onClick={(e) => { e.stopPropagation(); onEditKnot(knot); setShowMenu(false); }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Modifica
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteKnot(knot.id); setShowMenu(false); }}
              className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-100"
            >
              Elimina
            </button>
          </div>
        )}
      </div>

      <div onClick={handleCardClick} className="cursor-pointer"> {/* Aggiunto onClick per aprire il modale di dettaglio */}
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
          <h3 className="text-xl font-bold text-gray-800 mb-2 truncate">{knot.tag} </h3>
          {knot.description && <p className="text-gray-700 text-sm mb-3 truncate"> {knot.description} </p>}
          <div className="text-gray-600 text-xs space-y-1">
            <p className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"> </path></svg>
              Dal {new Date(knot.startDate).toLocaleDateString('it-IT')} al {new Date(knot.endDate).toLocaleDateString('it-IT')}
            </p>
            {knot.locationName && (
              <p className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"> </path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path> </svg>
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
      </div>
    </div>
  );
};

export default KnotCard;
