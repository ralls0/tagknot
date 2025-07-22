import React, { useState, useEffect } from 'react';
import { EventType, SpotCalendarProps, KnotType } from '../interfaces';

// The SpotCalendar component, enhanced for full responsiveness and Instagram-like style
const SpotCalendar: React.FC<SpotCalendarProps> = ({ spots, knots, onShowSpotDetail }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarItems, setCalendarItems] = useState<{ [key: string]: (EventType | KnotType)[] }>({});

  useEffect(() => {
    const itemsByDate: { [key: string]: (EventType | KnotType)[] } = {};

    // Process Spots
    spots.forEach(spot => {
      const spotDate = new Date(spot.date);
      const dateKey = spotDate.toDateString();
      if (!itemsByDate[dateKey]) {
        itemsByDate[dateKey] = [];
      }
      itemsByDate[dateKey].push({ ...spot, type: 'event' }); // Aggiungi il tipo per distinguerli
    });

    // Process Knots
    knots.forEach(knot => {
      const startDate = new Date(knot.startDate);
      const endDate = new Date(knot.endDate);
      let currentDateIterator = new Date(startDate);

      while (currentDateIterator <= endDate) {
        const dateKey = currentDateIterator.toDateString();
        if (!itemsByDate[dateKey]) {
          itemsByDate[dateKey] = [];
        }
        itemsByDate[dateKey].push({ ...knot, type: 'knot' }); // Aggiungi il tipo per distinguerli
        currentDateIterator.setDate(currentDateIterator.getDate() + 1);
      }
    });

    setCalendarItems(itemsByDate);
  }, [spots, knots]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    // getDay() returns 0 for Sunday, 1 for Monday, etc.
    // We want Monday to be the first day (index 0)
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday (0) to 6, Monday (1) to 0, etc.
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const renderCalendarDays = () => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for comparison

    // Empty cells for the start of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 border border-gray-200 bg-gray-50"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isToday = currentDay.toDateString() === today.toDateString();
      const dateKey = currentDay.toDateString();
      const itemsOnThisDay = calendarItems[dateKey] || [];

      days.push(
        <div
          key={day}
          className={`p-2 border border-gray-200 flex flex-col items-center justify-start relative overflow-hidden ${isToday ? 'bg-blue-100' : 'bg-white'}`}
          style={{ minHeight: '100px' }} // Altezza minima per le celle
        >
          <span className={`font-bold ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>{day}</span>
          <div className="flex flex-col items-center mt-1 w-full">
            {itemsOnThisDay.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className={`text-xs w-full text-center px-1 py-0.5 rounded-md mb-0.5 truncate cursor-pointer ${
                  item.type === 'event' ? 'bg-green-200 text-green-800' : 'bg-purple-200 text-purple-800'
                }`}
                onClick={() => onShowSpotDetail(item as EventType, [item as EventType], 'calendar')} // Passa l'evento cliccato
                title={item.tag}
              >
                {item.tag}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  const monthNames = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];
  const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <button onClick={prevMonth} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center font-semibold text-gray-700 mb-2">
        {dayNames.map(day => <div key={day} className="p-2">{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {renderCalendarDays()}
      </div>
    </div>
  );
};

export default SpotCalendar;
