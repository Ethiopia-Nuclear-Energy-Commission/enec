document.getElementById("contactForm").addEventListener("submit", function(e){

e.preventDefault();

const name = document.getElementById("name").value;
const email = document.getElementById("email").value;
const message = document.getElementById("message").value;

emailjs.send("service_fb85zme","template_20oufch",{

name: name,
email: email,
message: message

})
.then(function(){

const successBox = document.getElementById("successMessage");

successBox.classList.add("show");

document.getElementById("contactForm").reset();

setTimeout(function(){

successBox.classList.remove("show");

},5000);
}, function(error){

alert("Failed to send message.");

});

});