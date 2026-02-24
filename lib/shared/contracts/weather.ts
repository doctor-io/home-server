export type WeatherSource = "navigator";

export type WeatherLocation = {
  label: string;
  latitude: number | null;
  longitude: number | null;
};

export type WeatherCurrent = {
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPercent: number | null;
  windSpeedKph: number | null;
  weatherCode: number | null;
  condition: string;
};

export type WeatherForecastDay = {
  date: string;
  weatherCode: number | null;
  condition: string;
  tempMaxC: number | null;
  tempMinC: number | null;
};

export type WeatherSnapshot = {
  timestamp: string;
  source: WeatherSource;
  location: WeatherLocation;
  current: WeatherCurrent;
  dailyForecast: WeatherForecastDay[];
};
