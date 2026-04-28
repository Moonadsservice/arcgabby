const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

export const fetchWeather = async (location) => {
  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY.startsWith('YOUR_')) {
    console.warn('OpenWeather API Key not configured.');
    return { success: false, error: 'API Key missing' };
  }

  try {
    // First, get coordinates for the location
    const geoResponse = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${OPENWEATHER_API_KEY}`);
    const geoData = await geoResponse.json();

    if (!geoData || geoData.length === 0) {
      return { success: false, error: 'Location not found' };
    }

    const { lat, lon, name, country } = geoData[0];

    // Now get the actual weather data
    const weatherResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_API_KEY}`);
    const weatherData = await weatherResponse.json();

    if (weatherResponse.ok) {
      return {
        success: true,
        data: {
          location: `${name}, ${country}`,
          temp: Math.round(weatherData.main.temp),
          condition: weatherData.weather[0].main,
          description: weatherData.weather[0].description,
          wind: Math.round(weatherData.wind.speed),
          humidity: weatherData.main.humidity,
          uv: 'N/A', // OpenWeather basic API doesn't include UV in the standard call
          icon: weatherData.weather[0].icon
        }
      };
    } else {
      return { success: false, error: weatherData.message };
    }
  } catch (err) {
    console.error('Weather Fetch Error:', err);
    return { success: false, error: err.message };
  }
};
