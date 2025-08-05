 export const getCityNameFromCoordinates = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    );

    if (!response.ok) throw new Error("Failed to fetch city name");

    const data = await response.json();
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.state ||
      data.address?.county || ''

    return city || "فشل ايجاد المدينة";
  } catch (error) {
    console.error("Error in getCityNameFromCoordinates:", error);
    return "فشل ايجاد المدينة";
  }
};