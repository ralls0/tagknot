import React from 'react';
import UserAvatar from './UserAvatar';
import { GroupType, GroupCardProps } from '../interfaces'; // Importa GroupCardProps

const GroupCard: React.FC<GroupCardProps> = ({ group, onShowGroupDetail }) => {
  const defaultGroupImage = group.name ?
    `https://placehold.co/400x400/E0E0E0/888?text=${encodeURIComponent(group.name.charAt(0).toUpperCase())}` :
    'https://placehold.co/400x400/E0E0E0/888?text=Gruppo';

  return (
    <div
      className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col transition-transform duration-200 ease-in-out hover:scale-[1.01] hover:shadow-xl cursor-pointer"
      onClick={() => onShowGroupDetail(group)} // Chiama la funzione onShowGroupDetail al click
    >
      <div className="relative h-48 w-full">
        <img
          src={group.profileImage || defaultGroupImage}
          alt={`Copertina di ${group.name}`}
          className="w-full h-full object-cover"
          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = defaultGroupImage;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div className="absolute bottom-4 left-4 flex items-center space-x-3">
          <UserAvatar imageUrl={group.profileImage || defaultGroupImage} username={group.name} size="lg" className="border-2 border-white" />
          <h3 className="text-white text-xl font-bold drop-shadow-lg">{group.name}</h3>
        </div>
      </div>
      <div className="p-4 flex-grow">
        <p className="text-gray-700 text-sm mb-2 line-clamp-2">{group.description}</p>
        <div className="flex items-center text-gray-600 text-xs">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h-10a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v11a2 2 0 01-2 2zM9 1V5m6-4v4m-3 13V9"></path></svg>
          <span>Membri: {group.members.length}</span>
        </div>
      </div>
    </div>
  );
};

export default GroupCard;
