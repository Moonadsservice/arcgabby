const AVIATIONSTACK_API_KEY = import.meta.env.VITE_AVIATIONSTACK_API_KEY;

export const fetchFlightStatus = async (flightNumber) => {
  if (!AVIATIONSTACK_API_KEY || AVIATIONSTACK_API_KEY.startsWith('YOUR_')) {
    console.warn('AviationStack API Key not configured.');
    return { success: false, error: 'API Key missing' };
  }

  try {
    const response = await fetch(`https://api.aviationstack.com/v1/flights?access_key=${AVIATIONSTACK_API_KEY}&flight_iata=${flightNumber}`);
    const data = await response.json();

    if (data && data.data && data.data.length > 0) {
      const flight = data.data[0];
      return {
        success: true,
        data: {
          number: flightNumber,
          status: flight.flight_status,
          departure: flight.departure.estimated || flight.departure.scheduled,
          arrival: flight.arrival.estimated || flight.arrival.scheduled,
          airline: flight.airline.name,
          lastUpdate: new Date().toLocaleTimeString()
        }
      };
    } else {
      return { success: false, error: 'Flight not found' };
    }
  } catch (err) {
    console.error('AviationStack Fetch Error:', err);
    return { success: false, error: err.message };
  }
};
