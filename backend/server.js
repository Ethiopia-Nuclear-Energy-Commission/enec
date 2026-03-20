require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const News = require("./News");
const multer = require("multer");
const cloudinary = require('cloudinary').v2;

// ====================== CLOUDINARY (using your CLOUDINARY_URL) ======================
cloudinary.config(process.env.CLOUDINARY_URL);

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
app.use(cors());
app.use(express.json());

/* -----------------------------
   CONNECT TO MONGODB + ADMIN
------------------------------*/
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB Connected");
    await createAdmin();
  })
  .catch(err => console.log("❌ MongoDB Error:", err));

const AdminSchema = new mongoose.Schema({ username: String, password: String });
const Admin = mongoose.model("Admin", AdminSchema);

const createAdmin = async () => {
  try {
    const hashed = await bcrypt.hash("admin123", 10);
    await Admin.findOneAndUpdate({ username: "admin" }, { password: hashed }, { upsert: true });
    console.log("✅ Admin RESET: admin / admin123");
  } catch (e) {
    console.log("❌ Admin error:", e);
  }
};

/* -----------------------------
   EMAIL + LOGIN + VERIFY (UNCHANGED)
------------------------------*/
app.post("/send-email", async (req, res) => { /* your exact email code */ });
const SECRET = process.env.JWT_SECRET;
app.post("/login", async (req,res)=>{ /* your exact login code */ });
function verifyAdmin(req,res,next){ /* your exact verify code */ }

/* -----------------------------
   NEWS API – FIXED & HEAVILY LOGGED
------------------------------*/
app.post("/news", verifyAdmin, upload.array("files",10), async (req,res)=>{
  const {title,content} = req.body;
  const fileUrls = [];

  console.log("📤 POST /news received. Files count:", req.files ? req.files.length : 0);

  try {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        console.log(`Uploading: ${file.originalname} (${file.mimetype})`);

        const resourceType = file.mimetype.startsWith('video/') ? 'video' : 
                            file.mimetype === 'application/pdf' ? 'raw' : 'image';

        const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

        const result = await cloudinary.uploader.upload(dataUri, {
          resource_type: resourceType,
          folder: 'enec-news',
          public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
          quality: 'auto:good',
          fetch_format: 'auto'
        });

        fileUrls.push(result.secure_url);
        console.log(`✅ Uploaded ${file.originalname} → ${result.secure_url}`);
      }
    }

    const news = new News({
      title,
      content,
      files: fileUrls,
      date: new Date()
    });

    await news.save();
    console.log(`🎉 News saved with ${fileUrls.length} Cloudinary files`);

    res.json({message:"News published successfully"});

  } catch(error){
    console.error("❌ CRITICAL UPLOAD ERROR:", error.message);
    console.error("Stack:", error.stack);
    res.status(500).json({ 
      error: "Upload failed", 
      details: error.message,
      hint: "Check Render logs for full error"
    });
  }
});

// GET /news (keeps files now)
app.get("/news", async (req,res)=>{
  try{
    const news = await News.find().sort({date:-1});
    console.log(`✅ Returned ${news.length} articles`);
    res.json(news);
  }catch(error){
    console.log("❌ Error fetching news:", error);
    res.status(500).send("Error fetching news");
  }git
});

/* -----------------------------
   DELETE + UPDATE (UNCHANGED)
------------------------------*/
app.delete("/news/:id", verifyAdmin, async (req,res)=>{ /* your exact code */ });
app.put("/news/:id", verifyAdmin, async (req,res)=>{ /* your exact code */ });

/* -----------------------------
   START SERVER
------------------------------*/
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});