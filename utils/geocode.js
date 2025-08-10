export const getCityNameFromCoordinates = async (lat, lng) => {
  try {
    const response = await fetch(
      `http://localhost:5000/api/location/get-city?lat=${lat}&lng=${lng}`
    );

    if (!response.ok) throw new Error("Failed to fetch city name");

    const data = await response.json();
    return data.city || "فشل ايجاد المدينة";
  } catch (error) {
    console.error("Error in getCityNameFromCoordinates:", error);
    return "فشل ايجاد المدينة";
  }
};
