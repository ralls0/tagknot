import React, { useState, useEffect } from 'react';
import { EventType, KnotType, SpotCalendarProps } from '../interfaces';

// The SpotCalendar component, enhanced for full responsiveness and Instagram-like style
const SpotCalendar: React.FC<SpotCalendarProps> = ({ spots, knots, onShowSpotDetail }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [upcomingItems, setUpcomingItems] = useState<(EventType | KnotType)[]>([]);

  useEffect(() => {
    // Filter and sort future spots and knots
    const now = new Date();

    // Process spots: ensure 'type' is explicitly 'event' literal
    const filteredSpots = spots
      .filter(spot => {
        const spotDateTime = new Date(`${spot.date}T${spot.time}`);
        return spotDateTime >= now;
      })
      .map(spot => ({ ...spot, type: 'event' as const })); // Use 'as const' for literal type

    // Process knots: ensure 'type' is explicitly 'knot' literal
    const filteredKnots = knots
      .filter(knot => {
        const knotStartDate = new Date(knot.startDate);
        // Consider a knot "upcoming" if its start date is in the future
        // or if it has started but not yet ended
        const knotEndDate = new Date(knot.endDate);
        return knotStartDate >= now || (knotStartDate <= now && knotEndDate >= now);
      })
      .map(knot => ({ ...knot, type: 'knot' as const })); // Use 'as const' for literal type

    // Combine and sort all upcoming items
    const combinedUpcoming = [...filteredSpots, ...filteredKnots]
      .sort((a, b) => {
        let dateA: number;
        // Safely access properties based on the 'type' discriminator
        if (a.type === 'event') {
          dateA = new Date(`${a.date}T${a.time}`).getTime();
        } else { // a.type === 'knot'
          dateA = new Date(a.startDate).getTime();
        }

        let dateB: number;
        if (b.type === 'event') {
          dateB = new Date(`${b.date}T${b.time}`).getTime();
        } else { // b.type === 'knot'
          dateB = new Date(b.startDate).getTime();
        }
        return dateA - dateB;
      });

    setUpcomingItems(combinedUpcoming);
  }, [spots, knots]); // Re-run when spots or knots change

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    // getDay() returns 0 for Sunday, 1 for Monday, etc.
    // We want Monday to be the first day (index 0)
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday (0) to 6
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate); // 0 for Monday, 6 for Sunday

  const renderCalendarDays = () => {
    const days = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Fill leading empty days
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-start-${i}`} className="p-2 text-center text-gray-400"></div>);
    }

    // Fill days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      const isToday = dayDate.toDateString() === new Date().toDateString();

      const spotsOnDay = upcomingItems.filter(item =>
        item.type === 'event' && new Date(item.date).toDateString() === dayDate.toDateString()
      ).length;

      const knotsOnDay = upcomingItems.filter(item =>
        item.type === 'knot' && dayDate >= new Date(item.startDate) && dayDate <= new Date(item.endDate)
      ).length;

      let dayClasses = 'p-2 text-center rounded-lg border border-gray-200 relative flex flex-col items-center justify-center min-h-[60px]'; // Added min-h for better spacing

      if (isToday) {
        dayClasses += ' bg-blue-200 font-bold'; // Highlight for today
      }

      days.push(
        <div
          key={`day-${i}`}
          className={dayClasses}
        >
          <span className="text-lg font-semibold">{i}</span>
          <div className="flex flex-wrap justify-center mt-1">
            {spotsOnDay > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-1 mb-1">
                {spotsOnDay}
              </span>
            )}
            {knotsOnDay > 0 && (
              <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center mb-1">
                {knotsOnDay}
              </span>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200 w-full max-w-4xl mx-auto">
      <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">Calendario Spot & Knot</h3>

      <div className="flex justify-between items-center mb-4">
        <button onClick={goToPreviousMonth} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"> </path></svg>
        </button>
        <h4 className="text-xl font-semibold text-gray-800">
          {currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
        </h4>
        <button onClick={goToNextMonth} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"> </path></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-sm font-medium text-gray-700 mb-2">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
          <div key={day} className="text-center p-2">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {renderCalendarDays()}
      </div>

      <div className="mt-8">
        <h4 className="text-xl font-bold text-gray-800 mb-3">Prossimi Spot & Knot</h4>
        {upcomingItems.length === 0 ? (
          <p className="text-gray-600 text-center">Nessun spot o knot imminente.</p>
        ) : (
          <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
            {upcomingItems.map(item => {
              const defaultImage = item.locationName ?
                `https://placehold.co/100x100/E0E0E0/888?text=${encodeURIComponent(item.locationName.split(',')[0])}` :
                'https://placehold.co/100x100/E0E0E0/888?text=No+Image';

              return (
                <div
                  key={item.id}
                  className="flex items-center space-x-3 bg-white p-3 rounded-lg shadow-md border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => onShowSpotDetail(item as EventType)} // Cast to EventType for onShowSpotDetail
                >
                  <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden">
                    {item.type === 'event' && (item as EventType).coverImage ? (
                      <img
                        src={(item as EventType).coverImage}
                        alt={(item as EventType).tag}
                        className="w-full h-full object-cover"
                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultImage; }}
                      />
                    ) : item.type === 'knot' && (item as KnotType).coverImage ? (
                      <img
                        src={(item as KnotType).coverImage}
                        alt={(item as KnotType).tag}
                        className="w-full h-full object-cover"
                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultImage; }}
                      />
                    ) : (
                      <img
                        src={defaultImage}
                        alt="Placeholder"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-grow">
                    <p className="font-semibold text-gray-800 text-lg sm:text-xl">
                      {item.type === 'event' ? `${(item as EventType).tag}` : `Knot: ${(item as KnotType).tag}`}
                    </p>
                    <p className="text-sm text-gray-600">
                      {item.type === 'event' ?
                        `${new Date(`${(item as EventType).date}T${(item as EventType).time}`).toLocaleDateString('it-IT')} alle ${(item as EventType).time}` :
                        `${new Date((item as KnotType).startDate).toLocaleDateString('it-IT')} - ${new Date((item as KnotType).endDate).toLocaleDateString('it-IT')}`
                      }
                    </p>
                    <p className="text-xs text-gray-500 truncate">{item.locationName}</p>
                    <div className="flex items-center space-x-2 sm:space-x-3 text-gray-500 text-xs sm:text-sm mt-1">
                      <span className="flex items-center">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"></path></svg>
                        {item.type === 'event' ? ((item as EventType).likes ? (item as EventType).likes.length : 0) : 0}
                      </span>
                      <span className="flex items-center">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" clipRule="evenodd"></path></svg>
                        {item.type === 'event' ? ((item as EventType).commentCount ? (item as EventType).commentCount : 0) : 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotCalendar;
