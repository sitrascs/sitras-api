const http = require("http");
const mongoose = require("mongoose");

// Connect to MongoDB
mongoose
  .connect(
    "mongodb+srv://bimapopo81:Bima1234@sinau.q23pt.mongodb.net/pupuk-sdlp"
  )
  .then(() => {
    console.log("MongoDB connected to pupuk-sdlp database");

    // Create a simple model to ensure database is created
    const TestSchema = new mongoose.Schema({
      name: String,
      createdAt: { type: Date, default: Date.now },
    });

    const TestModel = mongoose.model("Test", TestSchema);

    // Insert a dummy document to ensure database is created
    const dummyDoc = new TestModel({ name: "Database initialized" });
    return dummyDoc.save();
  })
  .then(() => console.log("Database initialized with test document"))
  .catch((err) => console.log("MongoDB connection error:", err));

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Backend server is running!\n");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
