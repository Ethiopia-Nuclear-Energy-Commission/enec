require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const News = require("./News"); // ✅ moved here
const multer = require("multer");

// ====================== CLOUDINARY INTEGRATION ======================
// ====================== CLOUDINARY INTEGRATION ======================
const cloudinary = require('cloudinary').v2;

// Uses the single CLOUDINARY_URL you just added (easiest & cleanest)
cloudinary.config(process.env.CLOUDINARY_URL);
// ====================== MULTER CHANGED TO MEMORY STORAGE (NO DISK) ======================
const upload = multer({ storage: multer.memoryStorage() });

const app = express();

app.use(cors());
app.use(express.json());
// REMOVED: app.use("/uploads", express.static("uploads"));  ← no longer needed

/* -----------------------------
   CONNECT TO MONGODB
------------------------------*/

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB Connected");
    await createAdmin(); // 👈 ADD THIS LINE
  })
  .catch(err => console.log("❌ MongoDB Connection Error:", err));

/* -----------------------------
   ADMIN MODEL
------------------------------*/

const AdminSchema = new mongoose.Schema({
username:String,
password:String
});

const Admin = mongoose.model("Admin",AdminSchema);
// ✅ CREATE DEFAULT ADMIN (RUNS ON SERVER START)
const createAdmin = async () => {
  try {

    const hashedPassword = await bcrypt.hash("admin123", 10);

    await Admin.findOneAndUpdate(
      { username: "admin" },
      { password: hashedPassword },
      { upsert: true }
    );

    console.log("✅ Admin RESET: admin / admin123");

  } catch (error) {
    console.log("❌ Error creating admin:", error);
  }
};

/* -----------------------------
   EMAIL FUNCTION (UNCHANGED)
------------------------------*/

app.post("/send-email", async (req, res) => {

console.log("Request received:", req.body);

const { name, email, message } = req.body;

try {

let transporter = nodemailer.createTransport({

service: "gmail",

auth: {
user: process.env.EMAIL_USER,
pass: process.env.EMAIL_PASS
}

});

let mailOptions = {

from: email,

to: "eto.fkr@gmail.com",

subject: "New Message from ENEC Platform",

text: `
Name: ${name}
Email: ${email}

Message:
${message}
`

};

await transporter.sendMail(mailOptions);

res.status(200).send("Message Sent Successfully");

} catch (error) {

console.log(error);

res.status(500).send("Email Failed");

}

});

/* -----------------------------
   ADMIN LOGIN
------------------------------*/

const SECRET = process.env.JWT_SECRET;

app.post("/login", async (req,res)=>{

const {username,password} = req.body;

try{

const admin = await Admin.findOne({username});

if(!admin){
return res.status(401).send("Invalid user");
}

const valid = await bcrypt.compare(password,admin.password);

if(!valid){
return res.status(401).send("Wrong password");
}

const token = jwt.sign({id:admin._id},SECRET,{expiresIn:"2h"});

res.json({
message:"Login successful",
token
});

}catch(err){

res.status(500).send("Server error");

}

});
/* -----------------------------
   VERIFY ADMIN TOKEN
------------------------------*/

function verifyAdmin(req,res,next){

const authHeader = req.headers.authorization;

if(!authHeader){
return res.status(401).send("Access denied. No token provided.");
}

const token = authHeader.split(" ")[1];

try{

jwt.verify(token, SECRET);

next();

}catch(err){

return res.status(401).send("Invalid or expired token");

}

}
/* -----------------------------
   NEWS API – NOW USING CLOUDINARY (images, videos, PDFs)
------------------------------*/

// CREATE NEWS – Cloudinary upload (fixed & proven method)
app.post("/news", verifyAdmin, upload.array("files",10), async (req,res)=>{

const {title,content} = req.body;
const fileUrls = [];

try {
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      let resourceType = 'image';

      if (file.mimetype.startsWith('video/')) resourceType = 'video';
      else if (file.mimetype === 'application/pdf') resourceType = 'raw';

      // Simpler & more reliable upload method (works perfectly with memoryStorage)
      const base64String = file.buffer.toString('base64');
      const dataUri = `data:${file.mimetype};base64,${base64String}`;

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
    title: title,
    content: content,
    files: fileUrls,
    date: new Date()
  });

  await news.save();

  console.log(`🎉 News published with ${fileUrls.length} Cloudinary files`);
  res.json({message:"News published successfully"});

} catch(error){
  console.error("❌ Upload/publish error:", error.message);
  res.status(500).json({ error: "Error publishing news", details: error.message });
}

});
// GET ALL NEWS (unchanged – now returns tiny JSON with Cloudinary URLs)
// GET ALL NEWS (Fixed: Protects frontend from old Base64 crashes)
app.get("/news", async (req, res) => {
  try {
    // 1. Fetch all news from MongoDB
    const news = await News.find().sort({ date: -1 });

    // 2. Clean the data to protect the frontend
    const safeNews = news.map(doc => {
      // Convert Mongoose document to a standard JavaScript object
      const item = doc.toObject();

      // 3. Filter the files array
      if (item.files && Array.isArray(item.files)) {
        item.files = item.files.filter(fileString => {
          // ONLY keep files that are real URLs (Cloudinary). 
          // This automatically destroys any old "data:image/..." Base64 strings.
          return typeof fileString === 'string' && fileString.startsWith('http');
        });
      } else {
        // Fallback: ensure 'files' is always an array so frontend loops don't crash
        item.files = []; 
      }

      return item;
    });

    console.log(`Fetched ${safeNews.length} news items (Filtered heavy Base64)`);
    res.json(safeNews);

  } catch (error) {
    console.log("❌ Error fetching news:", error);
    res.status(500).send("Error fetching news");
  }
});


// DELETE NEWS (unchanged)
app.delete("/news/:id", verifyAdmin, async (req,res)=>{

try{

await News.findByIdAndDelete(req.params.id);

res.json({message:"News deleted"});

}catch(error){

res.status(500).send("Delete failed");

}

});


// UPDATE NEWS (EDIT) (unchanged - only title & content)
app.put("/news/:id", verifyAdmin, async (req,res)=>{

const {title,content} = req.body;

try{

await News.findByIdAndUpdate(req.params.id,{
title:title,
content:content
});

res.json({message:"News updated"});

}catch(error){

res.status(500).send("Update failed");

}

});
/* -----------------------------
   START SERVER
------------------------------*/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});