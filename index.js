import express from "express";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/intro", (req, res) => {
  res.sendFile("/home/j/Documents/learn_mern/express_1/public/sample.html");
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
