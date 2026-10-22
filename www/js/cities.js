/* Villes proposées : [nom, latitude, longitude, fuseau horaire]. La position GPS ou des coordonnées saisies sont aussi possibles. */
(function (R) {
  'use strict';
  var A = 'Africa/Dakar';
  R.cities = [
    ['Dakar', 14.6937, -17.4441, A], ['Mbour', 14.4198, -16.9640, A], ['Thiès', 14.7886, -16.9260, A],
    ['Touba', 14.8500, -15.8833, A], ['Saint-Louis', 16.0179, -16.4896, A], ['Kaolack', 14.1652, -16.0726, A],
    ['Ziguinchor', 12.5833, -16.2719, A], ['Tambacounda', 13.7707, -13.6673, A], ['Diourbel', 14.6553, -16.2313, A],
    ['Kolda', 12.8939, -14.9408, A], ['Louga', 15.6144, -16.2246, A], ['Fatick', 14.3390, -16.4111, A],
    ['Matam', 15.6559, -13.2554, A], ['Kédougou', 12.5579, -12.1743, A], ['Sédhiou', 12.7081, -15.5569, A],
    ['Kaffrine', 14.1059, -15.5508, A], ['Rufisque', 14.7167, -17.2667, A], ['Joal-Fadiouth', 14.1667, -16.8333, A],
    ['Richard-Toll', 16.4625, -15.7000, A], ['Banjul', 13.4549, -16.5790, 'Africa/Banjul'],
    ['Nouakchott', 18.0735, -15.9582, 'Africa/Nouakchott'], ['Bamako', 12.6392, -8.0029, 'Africa/Bamako'],
    ['Conakry', 9.6412, -13.5784, 'Africa/Conakry'], ['Abidjan', 5.3600, -4.0083, 'Africa/Abidjan'],
    ['Ouagadougou', 12.3714, -1.5197, 'Africa/Ouagadougou'], ['Niamey', 13.5116, 2.1254, 'Africa/Niamey'],
    ['Accra', 5.6037, -0.1870, 'Africa/Accra'], ['Lagos', 6.5244, 3.3792, 'Africa/Lagos'],
    ['Casablanca', 33.5731, -7.5898, 'Africa/Casablanca'], ['Rabat', 34.0209, -6.8416, 'Africa/Casablanca'],
    ['Alger', 36.7538, 3.0588, 'Africa/Algiers'], ['Tunis', 36.8065, 10.1815, 'Africa/Tunis'],
    ['Le Caire', 30.0444, 31.2357, 'Africa/Cairo'], ['La Mecque', 21.4225, 39.8262, 'Asia/Riyadh'],
    ['Médine', 24.4686, 39.6142, 'Asia/Riyadh'], ['Djeddah', 21.4858, 39.1925, 'Asia/Riyadh'],
    ['Dubaï', 25.2048, 55.2708, 'Asia/Dubai'], ['Istanbul', 41.0082, 28.9784, 'Europe/Istanbul'],
    ['Paris', 48.8566, 2.3522, 'Europe/Paris'], ['Marseille', 43.2965, 5.3698, 'Europe/Paris'],
    ['Lyon', 45.7640, 4.8357, 'Europe/Paris'], ['Bruxelles', 50.8503, 4.3517, 'Europe/Brussels'],
    ['Genève', 46.2044, 6.1432, 'Europe/Zurich'], ['Londres', 51.5072, -0.1276, 'Europe/London'],
    ['Madrid', 40.4168, -3.7038, 'Europe/Madrid'], ['Rome', 41.9028, 12.4964, 'Europe/Rome'],
    ['Montréal', 45.5017, -73.5673, 'America/Toronto'], ['New York', 40.7128, -74.0060, 'America/New_York']
  ].map(function (c) { return { name: c[0], lat: c[1], lon: c[2], tz: c[3] }; });
})(window.R = window.R || {});
