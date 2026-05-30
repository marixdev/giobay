export type Airport = {
  iata: string;
  icao: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
};

export const VN_AIRPORTS: Airport[] = [
  { iata: "SGN", icao: "VVTS", name: "Tân Sơn Nhất", city: "TP. Hồ Chí Minh", lat: 10.8188, lon: 106.6519 },
  { iata: "HAN", icao: "VVNB", name: "Nội Bài", city: "Hà Nội", lat: 21.2212, lon: 105.8073 },
  { iata: "DAD", icao: "VVDN", name: "Đà Nẵng", city: "Đà Nẵng", lat: 16.0439, lon: 108.1995 },
  { iata: "CXR", icao: "VVCR", name: "Cam Ranh", city: "Nha Trang", lat: 11.9982, lon: 109.2192 },
  { iata: "HPH", icao: "VVCI", name: "Cát Bi", city: "Hải Phòng", lat: 20.8194, lon: 106.7249 },
  { iata: "PQC", icao: "VVPQ", name: "Phú Quốc", city: "Phú Quốc", lat: 10.1698, lon: 103.9931 },
  { iata: "VCA", icao: "VVCT", name: "Trà Nóc", city: "Cần Thơ", lat: 10.0851, lon: 105.7118 },
  { iata: "VII", icao: "VVVH", name: "Vinh", city: "Vinh", lat: 18.7376, lon: 105.6708 },
  { iata: "HUI", icao: "VVPB", name: "Phú Bài", city: "Huế", lat: 16.4015, lon: 107.7026 },
  { iata: "UIH", icao: "VVPC", name: "Phù Cát", city: "Quy Nhơn", lat: 13.9549, lon: 109.0421 },
  { iata: "BMV", icao: "VVBM", name: "Buôn Ma Thuột", city: "Buôn Ma Thuột", lat: 12.6683, lon: 108.1203 },
  { iata: "DLI", icao: "VVDL", name: "Liên Khương", city: "Đà Lạt", lat: 11.7503, lon: 108.3672 },
  { iata: "VCS", icao: "VVCS", name: "Côn Đảo", city: "Côn Đảo", lat: 8.7318, lon: 106.6328 },
  { iata: "THD", icao: "VVTH", name: "Thọ Xuân", city: "Thanh Hóa", lat: 19.9018, lon: 105.4677 },
  { iata: "VKG", icao: "VVRG", name: "Rạch Giá", city: "Rạch Giá", lat: 9.9580, lon: 105.1325 },
  { iata: "TBB", icao: "VVTH", name: "Tuy Hòa", city: "Tuy Hòa", lat: 13.0496, lon: 109.3339 },
  { iata: "VCL", icao: "VVCA", name: "Chu Lai", city: "Tam Kỳ", lat: 15.4033, lon: 108.7059 },
  { iata: "DIN", icao: "VVDB", name: "Điện Biên", city: "Điện Biên Phủ", lat: 21.3974, lon: 103.0079 },
  { iata: "CAH", icao: "VVCM", name: "Cà Mau", city: "Cà Mau", lat: 9.1777, lon: 105.1778 },
];

export function findAirport(code: string): Airport | undefined {
  const c = code.toUpperCase();
  return VN_AIRPORTS.find((a) => a.iata === c || a.icao === c);
}

export const VN_BBOX = { lamin: 7.5, lomin: 101.5, lamax: 24.0, lomax: 110.5 };