import mongoose from "mongoose";
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Product from "../models/productModel.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await connectDB();

const filePath = path.join(__dirname, "../uploadsData/data.xlsx"); 
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(sheet);

const formattedData = jsonData.map((item) => {
  const images = [];
  let index = 0;

  while (item[`images[${index}].url`]) {
    images.push({
      url: item[`images[${index}].url`] || "",
      //public_id: item[`images[${index}].public_id`] || "",
    });
    index++;
  }

  return {
    name: item.name,
    description: item.description,
    price: Number(item.price),
    quantity: Number(item.quantity) || 0,
    discount: Number(item.discount) || 0,
    store: item.store, 
    category: item.category, 
    subCategory: item.subCategory|| null,
    images,
  };
});

try {
  await Product.insertMany(formattedData);
  console.log("Data inserted successfully");
} catch (error) {
  console.error("Error inserting data:", error);
}

mongoose.disconnect();




