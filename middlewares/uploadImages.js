import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");     
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);   
    cb(null, `product-${Date.now()}${ext}`);   
  }
});

const upload = multer({ storage });

export const uploadProductImages = upload.array("images", 5);    
