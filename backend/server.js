require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const News = require("./News"); // ✅ moved here
const multer = require("multer");

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
   NEWS API
------------------------------*/

// CREATE NEWS  ← UPDATED TO STORE IMAGES DIRECTLY IN MONGODB AS BASE64
app.post("/news", verifyAdmin, upload.array("files",10), async (req,res)=>{

const {title,content} = req.body;

const imageDataUrls = [];

if (req.files && req.files.length > 0) {
  for (const file of req.files) {
    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64}`;
    imageDataUrls.push(dataUrl);
  }
}

try{

const news = new News({
title:title,
content:content,
files: imageDataUrls   // ← now stores full image data inside MongoDB
});

await news.save();

res.json({message:"News published successfully"});

}catch(error){

console.log(error);
res.status(500).send("Error publishing news");

}

});


// GET ALL NEWS (unchanged)
app.get("/news", async (req,res)=>{

try{

const news = await News.find().sort({date:-1});

res.json(news);

}catch(error){

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