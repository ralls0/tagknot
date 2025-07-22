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
            {upcomingItems.map(item => (
              <div
                key={item.id}
                className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => onShowSpotDetail(item as EventType)} // Cast to EventType for onShowSpotDetail
              >
                {item.type === 'event' ? (
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path></svg>
                ) : (
                  <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V7z"></path></svg>
                )}
                <div>
                  <p className="font-semibold text-gray-800">
                    {item.type === 'event' ? `#${item.tag}` : `Knot: ${item.tag}`}
                  </p>
                  <p className="text-sm text-gray-600">
                    {item.type === 'event' ?
                      `${new Date(`${item.date}T${item.time}`).toLocaleDateString('it-IT')} alle ${item.time}` :
                      `${new Date(item.startDate).toLocaleDateString('it-IT')} - ${new Date(item.endDate).toLocaleDateString('it-IT')}`
                    }
                  </p>
                  <p className="text-xs text-gray-500">{item.locationName}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotCalendar;
