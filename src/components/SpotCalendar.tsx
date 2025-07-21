import React, { useState, useEffect } from 'react';
import { EventType, SpotCalendarProps } from '../interfaces';

// The SpotCalendar component, enhanced for full responsiveness and Instagram-like style
const SpotCalendar: React.FC<SpotCalendarProps> = ({ spots, onShowSpotDetail }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [upcomingSpots, setUpcomingSpots] = useState<EventType[]>([]);

  useEffect(() => {
    // Filter and sort future spots
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
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 bg-white rounded-3xl shadow-lg border border-gray-50 font-inter">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 text-center mb-6 sm:mb-8 tracking-tight">Calendario Spot</h2>

      {/* Month Navigation */}
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <button
          onClick={prevMonth}
          className="p-2 sm:p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200 ease-in-out active:scale-95"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <span className="text-xl sm:text-2xl font-bold text-gray-900 capitalize"> {getMonthName(currentDate)} </span>
        <button
          onClick={nextMonth}
          className="p-2 sm:p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200 ease-in-out active:scale-95"
          aria-label="Next month"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>

      {/* Weekday Names */}
      <div className="grid grid-cols-7 text-center text-xs sm:text-sm font-semibold text-gray-500 mb-2 sm:mb-4">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
          <div key={day} className="py-2">{day}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
        {calendarDays.map((day, index) => {
          const daySpots = getSpotsForDay(day);
          const isToday = isCurrentMonth && day === today.getDate();
          const hasSpots = daySpots.length > 0;

          return (
            <div
              key={index}
              // Using min-h to allow flexibility, and responsive padding for height
              className={`relative min-h-[4rem] sm:min-h-[5rem] flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl transition-all duration-200 ease-in-out
                ${day === null ? 'bg-gray-50 text-gray-300' : 'bg-gray-100 text-gray-800 cursor-pointer'}
                ${isToday ? 'border-2 border-indigo-500 bg-indigo-50 text-indigo-800 font-extrabold shadow-sm' : ''}
                ${hasSpots ? 'bg-indigo-100 border border-indigo-300 text-indigo-800 font-semibold hover:bg-indigo-200 hover:shadow-md' : ''}
              `}
              onClick={() => hasSpots && onShowSpotDetail(daySpots[0], daySpots, 'calendar')} // Show the first spot of the day
            >
              <span className={`text-base sm:text-lg ${isToday ? 'text-indigo-800' : hasSpots ? 'text-indigo-800' : 'text-gray-800'}`}>
                {day}
              </span>
              {hasSpots && (
                <span className="absolute bottom-1 right-1 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-full px-1.5 py-0.5 shadow-sm">
                  {daySpots.length}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming Spots */}
      <div className="mt-8 sm:mt-10">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-5">Prossimi Spot</h3>
        {upcomingSpots.length === 0 ? (
          <p className="text-gray-500 text-center py-3 sm:py-4 bg-gray-50 rounded-lg shadow-inner text-sm sm:text-base">Nessuno Spot in programma per il futuro.</p>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {upcomingSpots.slice(0, 5).map(spot => ( // Show the next 5 spots
              <div
                key={spot.id}
                className="bg-white p-3 sm:p-4 rounded-xl shadow-md border border-gray-100 flex items-center space-x-3 sm:space-x-4 cursor-pointer hover:shadow-lg transition-all duration-200 ease-in-out transform hover:-translate-y-0.5"
                onClick={() => onShowSpotDetail(spot, upcomingSpots, 'calendar')}
              >
                {spot.coverImage ? (
                  <img src={spot.coverImage} alt={spot.tag} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg shadow-sm flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs sm:text-sm font-semibold flex-shrink-0">No Img</div>
                )}
                <div className="flex-grow">
                  <h4 className="font-bold text-base sm:text-lg text-gray-900 mb-0.5 sm:mb-1">#{spot.tag}</h4>
                  <p className="text-xs sm:text-sm text-gray-700 mb-0.5 sm:mb-1">{new Date(`${spot.date}T${spot.time}`).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-xs text-gray-500 truncate">{spot.locationName}</p>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3 text-gray-500 text-xs sm:text-sm">
                    <span className="flex items-center">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"></path></svg>
                        {spot.likes.length}
                    </span>
                    <span className="flex items-center">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.111A8.85 8.85 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"></path></svg>
                        {spot.commentCount}
                    </span>
                </div>
              </div>
            ))}
            {upcomingSpots.length > 5 && (
              <p className="text-center text-gray-500 text-xs sm:text-sm mt-3 sm:mt-4">...e altri {upcomingSpots.length - 5} Spot.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotCalendar;
