import React, { useState, useEffect } from 'react';
import { EventType, SpotCalendarProps } from '../interfaces';

const SpotCalendar: React.FC<SpotCalendarProps> = ({ spots, onShowSpotDetail }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [upcomingSpots, setUpcomingSpots] = useState<EventType[]>([]);

  useEffect(() => {
    // Filtra e ordina gli spot futuri
    const now = new Date();
    const filtered = spots
      .filter(spot => {
        const spotDateTime = new Date(`${spot.date}T${spot.time}`);
        return spotDateTime >= now;
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`).getTime();
        const dateB = new Date(`${b.date}T${b.time}`).getTime();
        return dateA - dateB;
      });
    setUpcomingSpots(filtered);
  }, [spots]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    // getDay() returns 0 for Sunday, 1 for Monday, etc.
    // We want Monday to be the first day (index 0)
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday (0) to 6 (end of week), others -1
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
  };

  const prevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOffset = getFirstDayOfMonth(currentDate); // Offset for the first day of the month (0 = Monday)

  const calendarDays: (number | null)[] = Array(firstDayOffset).fill(null);
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const getSpotsForDay = (day: number | null) => {
    if (day === null) return [];
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-indexed

    return spots.filter(spot => {
      const spotDate = new Date(spot.date);
      return (
        spotDate.getFullYear() === currentYear &&
        spotDate.getMonth() === currentMonth &&
        spotDate.getDate() === day
      );
    });
  };

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentDate.getFullYear() && today.getMonth() === currentDate.getMonth();

  return (
    <div className="w-full max-w-2xl mx-auto p-4 bg-white rounded-2xl shadow-xl border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Calendario Spot</h2>

      {/* Navigazione Mese */}
      <div className="flex justify-between items-center mb-4">
        <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <span className="text-xl font-semibold text-gray-800 capitalize"> {getMonthName(currentDate)} </span>
        <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>

      {/* Nomi dei giorni della settimana */}
      <div className="grid grid-cols-7 text-center text-sm font-medium text-gray-600 mb-2">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
          <div key={day} className="py-2">{day}</div>
        ))}
      </div>

      {/* Griglia del calendario */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarDays.map((day, index) => {
          const daySpots = getSpotsForDay(day);
          const isToday = isCurrentMonth && day === today.getDate();
          const hasSpots = daySpots.length > 0;

          return (
            <div
              key={index}
              className={`relative h-16 flex flex-col items-center justify-center rounded-lg
                ${day === null ? 'bg-gray-50 text-gray-400' : 'bg-gray-100 text-gray-800'}
                ${isToday ? 'border-2 border-blue-500 bg-blue-50 font-bold' : ''}
                ${hasSpots ? 'bg-green-100 border border-green-300 cursor-pointer hover:bg-green-200' : ''}
              `}
              onClick={() => hasSpots && onShowSpotDetail(daySpots[0], daySpots, 'calendar')} // Mostra il primo spot del giorno
            >
              {day}
              {hasSpots && (
                <span className="absolute bottom-1 right-1 text-xs font-bold text-green-800 bg-green-300 rounded-full px-1">
                  {daySpots.length}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Prossimi Spot */}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Prossimi Spot</h3>
        {upcomingSpots.length === 0 ? (
          <p className="text-gray-600 text-center">Nessuno Spot in programma per il futuro.</p>
        ) : (
          <div className="space-y-3">
            {upcomingSpots.slice(0, 5).map(spot => ( // Mostra i prossimi 5 spot
              <div
                key={spot.id}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex items-center space-x-4 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => onShowSpotDetail(spot, upcomingSpots, 'calendar')}
              >
                {spot.coverImage ? (
                  <img src={spot.coverImage} alt={spot.tag} className="w-16 h-16 object-cover rounded-md" />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center text-gray-500 text-xs">No Img</div>
                )}
                <div>
                  <h4 className="font-semibold text-gray-800">#{spot.tag}</h4>
                  <p className="text-sm text-gray-600">{new Date(`${spot.date}T${spot.time}`).toLocaleString('it-IT')}</p>
                  <p className="text-xs text-gray-500">{spot.locationName}</p>
                </div>
              </div>
            ))}
            {upcomingSpots.length > 5 && (
              <p className="text-center text-gray-600 text-sm mt-2">...e altri {upcomingSpots.length - 5} Spot.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotCalendar;
