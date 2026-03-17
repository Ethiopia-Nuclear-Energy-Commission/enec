require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


const News = require("./News"); // ✅ moved here
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
destination: "./uploads/",
filename: function (req, file, cb) {
cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
}
});

const upload = multer({ storage: storage });

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* -----------------------------
   CONNECT TO MONGODB
------------------------------*/

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(()=> console.log("✅ MongoDB Connected"))
.catch(err=> console.log("❌ MongoDB Connection Error:", err));

/* -----------------------------
   ADMIN MODEL
------------------------------*/

const AdminSchema = new mongoose.Schema({
username:String,
password:String
});

const Admin = mongoose.model("Admin",AdminSchema);

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

const token = req.headers.authorization;

if(!token){
return res.status(401).send("Access denied. No token provided.");
}

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

// CREATE NEWS
app.post("/news", verifyAdmin, upload.array("files",10), async (req,res)=>{

const {title,content} = req.body;

const files = req.files ? req.files.map(f => f.filename) : [];

try{

const news = new News({
title:title,
content:content,
files:files
});

await news.save();

res.json({message:"News published successfully"});

}catch(error){

console.log(error);
res.status(500).send("Error publishing news");

}

});


// GET ALL NEWS
app.get("/news", async (req,res)=>{

try{

const news = await News.find().sort({date:-1});

res.json(news);

}catch(error){

console.log("❌ Error fetching news:", error);
res.status(500).send("Error fetching news");

}

});


// DELETE NEWS
app.delete("/news/:id", verifyAdmin, async (req,res)=>{

try{

await News.findByIdAndDelete(req.params.id);

res.json({message:"News deleted"});

}catch(error){

res.status(500).send("Delete failed");

}

});


// UPDATE NEWS (EDIT)
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