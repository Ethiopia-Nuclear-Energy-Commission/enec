let selectedFiles = [];

document.getElementById("files").addEventListener("change", function(){

const preview = document.getElementById("preview");

for(let file of this.files){

selectedFiles.push(file);

const div = document.createElement("div");

div.innerHTML = `
${file.name}
<button onclick="removeFile('${file.name}')">Remove</button>
`;

preview.appendChild(div);

}

});

function removeFile(name){

selectedFiles = selectedFiles.filter(f => f.name !== name);

const preview = document.getElementById("preview");

preview.innerHTML="";

selectedFiles.forEach(file=>{

const div=document.createElement("div");

div.innerHTML=`
${file.name}
<button onclick="removeFile('${file.name}')">Remove</button>
`;

preview.appendChild(div);

});

}

let editingId = null;

async function publishNews(){

const title=document.getElementById("title").value;
const content=document.getElementById("content").value;

const formData=new FormData();

formData.append("title",title);
formData.append("content",content);

selectedFiles.forEach(file=>{
formData.append("files",file);
});

const url = editingId 
? `http://localhost:5000/news/${editingId}`
: "http://localhost:5000/news";

const method = editingId ? "PUT" : "POST";

await fetch(url,{
method:method,
body: editingId ? JSON.stringify({title,content}) : formData,
headers: editingId ? {"Content-Type":"application/json"} : undefined
});

alert(editingId ? "News Updated Successfully" : "News Published Successfully");

editingId = null;

selectedFiles = [];

loadNews();

}

async function loadNews(){

const res = await fetch("http://localhost:5000/news");

const news = await res.json();

const container = document.getElementById("newsList");

container.innerHTML="";

news.forEach(n=>{

const card = document.createElement("div");

card.className = "newsCard";

card.innerHTML = `

<h3>${n.title}</h3>

<p>${n.content.substring(0,150)}...</p>

<div class="cardButtons">

<button class="editBtn">Edit</button>
<button class="deleteBtn">Delete</button>

</div>

`;

card.querySelector(".editBtn").onclick = () => editNews(n._id,n.title,n.content);

card.querySelector(".deleteBtn").onclick = () => deleteNews(n._id);

container.appendChild(card);

});

}

loadNews();

async function deleteNews(id){

if(!confirm("Delete this article?")) return;

await fetch(`http://localhost:5000/news/${id}`,{

method:"DELETE"

});

alert("News deleted");

loadNews();

}

function editNews(id,title,content){

editingId = id;

document.getElementById("title").value = title;

document.getElementById("content").value = content;

window.scrollTo({
top:0,
behavior:"smooth"
});

}