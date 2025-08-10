import express from "express";
import fetch from "node-fetch"; // لو شغال Node < 18 لازم تثبته
const router = express.Router();

router.get("/get-city", async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ message: "Latitude and longitude are required" });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "User-Agent": "MyAppName/1.0 (myemail@example.com)", // غيرهم لبياناتك
          "Accept-Language": "ar"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.state ||
      data.address?.county || "";

    res.json({ city: city || "فشل ايجاد المدينة" });
  } catch (error) {
    console.error("Error fetching city:", error);
    res.status(500).json({ message: "فشل ايجاد المدينة" });
  }
});

export default router;
