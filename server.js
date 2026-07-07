const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const {
  RawData,
  CalibratedData,
  Recommendation,
  ManualData,
} = require("./models/DataModel");

const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 3001;

// ==========================================
// KONFIGURASI
// ==========================================

// URL API Machine Learning (Hugging Face)
const ML_KALIBRASI_API_URL = "https://sauqing-api-ml-sitras.hf.space/predict";
const ML_REKOMENDASI_API_URL = "https://sauqing-api-ml-sitras.hf.space/predict_rekomendasi";

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// DATABASE CONNECTION
// ==========================================
mongoose
  .connect(
    "mongodb+srv://bimapopo81:Bima1234@sinau.q23pt.mongodb.net/pupuk-sdlp"
  )
  .then(() => {
    console.log("✅ MongoDB connected to pupuk-sdlp database");
  })
  .catch((err) => console.log("❌ MongoDB connection error:", err));

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Konversi nilai target_padi dari string (<6, 6-8, >8) ke angka (1, 2, 3)
const convertTargetPadi = (targetString) => {
  switch (targetString) {
    case "<6":
      return 1;
    case "6-8":
      return 2;
    case ">8":
      return 3;
    case "N/A":
    default:
      return 4;
  }
};

// ==========================================
// API ROUTES
// ==========================================

// === SETUP DEFAULT ADMIN ===
// Jalankan server, ini akan otomatis membuat akun admin jika belum ada
const createDefaultAdmin = async () => {
  try {
    const admin = await User.findOne({ role: "admin" });
    if (!admin) {
      await User.create({
        username: "admin",
        password: "admin123",
        role: "admin"
      });
      console.log("✅ Admin Default dibuat: admin / admin123");
    }
  } catch (err) {
    console.error("Gagal buat admin:", err);
  }
};
createDefaultAdmin();

// === ROUTES AUTH ===
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ success: false, message: "Username atau Password salah" });
    }

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Username atau Password salah" });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      },
      token: "dummy-token-jwt" 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. GET ALL USERS (Khusus Admin)
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. ADD NEW USER (Dari Admin Dashboard)
app.post("/api/users", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username sudah digunakan!" });
    }

    const newUser = new User({ username, password, role });
    await newUser.save(); 
    
    res.status(201).json({ success: true, message: "User berhasil dibuat" });
  } catch (error) {
    res.status(400).json({ message: "Gagal membuat user", error: error.message });
  }
});

// 4. DELETE USER
app.delete("/api/users/:id", async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan" });
    }

    if (targetUser.username === "admin") {
      return res.status(403).json({ 
        success: false, 
        message: "⛔ AKSES DITOLAK: Superadmin tidak bisa dihapus!" 
      });
    }

    await User.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: "User berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// === 6. USER MANAGEMENT (CHANGE PASSWORD) ===
app.put("/api/users/change-password", async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password minimal 6 karakter" });
    }

    const user = await User.findOne({ username: username });

    if (!user) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password berhasil diubah" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Gagal mengubah password" });
  }
});


// ------------------------------------------
// 1. RAW DATA ENDPOINTS (Data Mentah dari Sensor)
// ------------------------------------------

// POST: Simpan Data Mentah & Trigger Kalibrasi ML
app.post("/api/data/raw", async (req, res) => {
  try {
    const rawData = new RawData(req.body);
    await rawData.save();

    // --- INTEGRASI ML (MODEL 1: KALIBRASI) ---
    (async () => {
      try {
        console.log("📡 Data mentah disimpan. Memulai proses kalibrasi ML...");
        const rawVars = rawData.variables;
        
        // ⚠️ PERUBAHAN: Kirim 6 fitur sesuai model baru (Ridge Poly3)
        const dataForML = {
          pH: rawVars.pH ?? 0,
          N: rawVars.N ?? 0,
          P: rawVars.P ?? 0,
          K: rawVars.K ?? 0,
          EC: rawVars.EC ?? 0,
          Kelembaban: rawVars.kelembaban ?? 0   // pastikan nama key sesuai ml_api
        };
        
        const mlResponse = await axios.post(ML_KALIBRASI_API_URL, dataForML, {
          timeout: 10000,
        });

        const calibratedValues = mlResponse.data;
        
        const calibratedData = new CalibratedData({
          timestamp: rawData.timestamp, 
          variables: {
            pH: calibratedValues.pH_calibrated,
            N: calibratedValues.N_calibrated,
            P: calibratedValues.P_calibrated,
            K: calibratedValues.K_calibrated,
            suhu: rawVars.suhu,
            kelembaban: rawVars.kelembaban,
            EC: rawVars.EC,
          },
        });

        await calibratedData.save();
        console.log("✅ Data terkalibrasi berhasil disimpan.");
      } catch (mlError) {
        console.error(`⚠️ PERINGATAN: Gagal melakukan kalibrasi ML: ${mlError.message}`);
      }
    })();
    
    res.status(201).json({
      success: true,
      message: "Raw data saved successfully (calibration triggered in background)",
      data: rawData,
    });
  } catch (error) {
    console.error("Error saving raw data:", error.message);
    res.status(400).json({ success: false, message: "Error saving raw data", error: error.message });
  }
});

// POST: Bulk Insert Data Mentah (Array)
app.post("/api/data/raw/bulk", async (req, res) => {
  try {
    const dataArray = req.body;
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return res.status(400).json({ success: false, message: "Body harus berupa array data yang tidak kosong." });
    }
    for (let i = 0; i < dataArray.length; i++) {
      if (!dataArray[i].variables || typeof dataArray[i].variables !== "object") {
        return res.status(400).json({ success: false, message: `Item ke-${i+1} tidak valid.` });
      }
    }
    const savedDocs = await RawData.insertMany(dataArray);
    
    (async () => {
      for (const doc of savedDocs) {
        try {
          const rawVars = doc.variables;
          const dataForML = {
            pH: rawVars.pH ?? 0,
            N: rawVars.N ?? 0,
            P: rawVars.P ?? 0,
            K: rawVars.K ?? 0,
            EC: rawVars.EC ?? 0,
            Kelembaban: rawVars.kelembaban ?? 0
          };
          const mlResponse = await axios.post(ML_KALIBRASI_API_URL, dataForML, { timeout: 10000 });
          const cal = mlResponse.data;
          await CalibratedData.create({
            timestamp: doc.timestamp,
            variables: {
              pH: cal.pH_calibrated,
              N: cal.N_calibrated,
              P: cal.P_calibrated,
              K: cal.K_calibrated,
              suhu: rawVars.suhu,
              kelembaban: rawVars.kelembaban,
              EC: rawVars.EC,
            },
          });
        } catch (err) {
          console.error(`Gagal kalibrasi item ${doc._id}:`, err.message);
        }
      }
    })();

    res.status(201).json({ success: true, message: `${savedDocs.length} data mentah berhasil disimpan.`, data: savedDocs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal menyimpan bulk data", error: error.message });
  }
});

// GET: Ambil 1 Data Mentah Terbaru
app.get("/api/data/raw", async (req, res) => {
  try {
    const rawData = await RawData.findOne().sort({ timestamp: -1 });
    if (!rawData) return res.status(404).json({ success: false, message: "No raw data found" });
    res.json({ success: true, data: rawData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching raw data", error: error.message });
  }
});

// GET: Ambil History Data Mentah (Limit)
app.get("/api/data/raw/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const rawData = await RawData.find().sort({ timestamp: -1 }).limit(limit);
    res.json({ success: true, data: rawData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching raw history", error: error.message });
  }
});

// DELETE: Hapus Data Mentah berdasarkan Rentang Waktu (ISO)
app.delete("/api/data/raw/range", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ 
        success: false, 
        message: "Parameter start dan end (ISO) harus diisi." 
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: "Format tanggal tidak valid." });
    }

    const result = await RawData.deleteMany({
      timestamp: {
        $gte: startDate,
        $lte: endDate
      }
    });

    console.log(`🗑️ Berhasil menghapus ${result.deletedCount} data raw.`);

    res.json({ 
      success: true, 
      message: `${result.deletedCount} data berhasil dihapus.`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error("❌ Error delete range:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error", 
      error: error.message 
    });
  }
});

// DELETE: Hapus 1 Data Mentah by ID
app.delete("/api/data/raw/:id", async (req, res) => {
  try {
    const rawData = await RawData.findByIdAndDelete(req.params.id);
    if (!rawData) return res.status(404).json({ success: false, message: "Raw data not found" });
    res.json({ success: true, message: "Raw data deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting raw data", error: error.message });
  }
});

// DELETE: Hapus SEMUA Data Mentah
app.delete("/api/data/raw", async (req, res) => {
  try {
    await RawData.deleteMany({});
    res.json({ success: true, message: "All raw data deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting all raw data", error: error.message });
  }
});

// ------------------------------------------
// 2. CALIBRATED DATA ENDPOINTS (Hasil Kalibrasi)
// ------------------------------------------

// POST: Simpan Manual Data Kalibrasi
app.post("/api/data/calibrated", async (req, res) => {
  try {
    const calibratedData = new CalibratedData(req.body);
    await calibratedData.save();
    res.status(201).json({ success: true, message: "Calibrated data saved", data: calibratedData });
  } catch (error) {
    res.status(400).json({ success: false, message: "Error saving calibrated data", error: error.message });
  }
});

// GET: Ambil 1 Data Kalibrasi Terbaru
app.get("/api/data/calibrated", async (req, res) => {
  try {
    const calibratedData = await CalibratedData.findOne().sort({ timestamp: -1 });
    if (!calibratedData) return res.status(404).json({ success: false, message: "No calibrated data found" });
    res.json({ success: true, data: calibratedData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching calibrated data", error: error.message });
  }
});

// GET: Ambil History Data Kalibrasi
app.get("/api/data/calibrated/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const calibratedData = await CalibratedData.find().sort({ timestamp: -1 }).limit(limit);
    res.json({ success: true, data: calibratedData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching calibrated history", error: error.message });
  }
});

// DELETE: Hapus Data Kalibrasi berdasarkan Rentang Waktu (ISO)
app.delete("/api/data/calibrated/range", async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ success: false, message: "Parameter start dan end (ISO) harus diisi." });
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: "Format tanggal tidak valid." });
    }
    const result = await CalibratedData.deleteMany({
      timestamp: { $gte: startDate, $lte: endDate }
    });
    res.json({ success: true, message: `${result.deletedCount} data berhasil dihapus.`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

// DELETE: Hapus 1 Data Kalibrasi by ID
app.delete("/api/data/calibrated/:id", async (req, res) => {
  try {
    const calibratedData = await CalibratedData.findByIdAndDelete(req.params.id);
    if (!calibratedData) return res.status(404).json({ success: false, message: "Data not found" });
    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting data", error: error.message });
  }
});

// DELETE: Hapus SEMUA Data Kalibrasi
app.delete("/api/data/calibrated", async (req, res) => {
  try {
    await CalibratedData.deleteMany({});
    res.json({ success: true, message: "All calibrated data deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting all data", error: error.message });
  }
});

// ------------------------------------------
// 3. MANUAL DATA ENDPOINTS (Input Lahan & Koordinat)
// ------------------------------------------

// POST: Simpan Manual Data
app.post("/api/data/manual", async (req, res) => {
  try {
    const manualData = new ManualData(req.body);
    await manualData.save();
    
    res.status(201).json({
      success: true,
      message: "Manual data saved successfully",
      data: manualData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error saving manual data",
      error: error.message,
    });
  }
});

// GET: Ambil History Manual Data (List untuk Sidebar)
app.get("/api/data/manual", async (req, res) => {
  try {
    const manualDataList = await ManualData.find().sort({ timestamp: -1 });

    res.json({
      success: true,
      data: manualDataList,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching manual data",
      error: error.message,
    });
  }
});

// GET: Ambil 1 Manual Data by ID (Detail)
app.get("/api/data/manual/:id", async (req, res) => {
  try {
    const manualData = await ManualData.findById(req.params.id);
    if (!manualData) {
      return res.status(404).json({ success: false, message: "Manual data not found" });
    }
    res.json({ success: true, data: manualData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching manual detail", error: error.message });
  }
});

// DELETE: Hapus 1 Manual Data by ID
app.delete("/api/data/manual/:id", async (req, res) => {
  try {
    const deletedData = await ManualData.findByIdAndDelete(req.params.id);
    if (!deletedData) {
      return res.status(404).json({ success: false, message: "Manual data not found" });
    }
    res.json({ success: true, message: "Manual data deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting manual data",
      error: error.message,
    });
  }
});

// DELETE: Hapus SEMUA Manual Data
app.delete("/api/data/manual", async (req, res) => {
  try {
    await ManualData.deleteMany({});
    res.json({ success: true, message: "All manual data deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting all manual data", error: error.message });
  }
});

// ------------------------------------------
// 4. RECOMMENDATION ENDPOINTS (Rekomendasi Pemupukan)
// ------------------------------------------

// POST: Rekomendasi Tab "Input" (Langsung ke ML, TANPA simpan ke DB)
app.post("/api/recommendation/input", async (req, res) => {
  try {
    // ⚠️ PERUBAHAN: Payload tidak lagi mengandung N, hanya P, K, jenis_tanaman, target_padi
    const payloadForML = {
      P: req.body.P,
      K: req.body.K,
      jenis_tanaman: req.body.jenis_tanaman,
      target_padi: req.body.target_padi,
    };
    console.log("📨 Request /input diteruskan ke ML API:", payloadForML);
    
    const mlResponse = await axios.post(ML_REKOMENDASI_API_URL, payloadForML, { 
      timeout: 10000 
    });
    
    if (!mlResponse.data || !mlResponse.data.success) {
      throw new Error("ML API call was not successful");
    }
    
    res.json(mlResponse.data);
  } catch (error) {
    console.error("❌ Error in /recommendation/input:", error.message);
    res.status(400).json({ 
      success: false, 
      message: "Error calling ML recommendation engine", 
      error: error.message 
    });
  }
});

// POST: Rekomendasi Tab "Data" / Dashboard (ML + Simpan ke DB)
app.post("/api/recommendation", async (req, res) => {
  try {
    const { P, K, jenis_tanaman, target_padi } = req.body;
    // ⚠️ Tidak ada N lagi

    const payloadForML = {
      P: parseFloat(P),
      K: parseFloat(K),
      jenis_tanaman,
      target_padi,
    };

    console.log("📨 Request /recommendation diteruskan ke ML API:", payloadForML);
    const mlResponse = await axios.post(ML_REKOMENDASI_API_URL, payloadForML, { 
      timeout: 10000 
    });

    if (!mlResponse.data || !mlResponse.data.success) {
      throw new Error("ML API Error: Response not success");
    }
    
    const { recommendations, status_hara } = mlResponse.data.data;

    // Konversi target_padi untuk penyimpanan (jika diperlukan)
    const convertedTargetPadi = convertTargetPadi(target_padi);

    const recommendationData = new Recommendation({
      input: {
        P: parseFloat(P),
        K: parseFloat(K),
        jenis_tanaman,
        target_padi: convertedTargetPadi,
        // N tidak disimpan karena tidak dipakai
      },
      recommendation: recommendations,
      // reasons, tips tidak ada lagi di response baru, kita set default
      reasons: { info: "Rekomendasi berdasarkan status hara" },
      tips: "Dosis sesuai aturan pemupukan",
      conversion_results: status_hara, // gunakan status_hara sebagai conversion_results
    });

    await recommendationData.save();

    res.json({
      success: true,
      message: "Recommendation generated and saved",
      data: {
        recommendation: recommendations,
        timestamp: recommendationData.timestamp,
        conversion_results: status_hara
      },
    });
  } catch (error) {
    console.error("❌ Error generating recommendation:", error.message);
    res.status(400).json({ 
      success: false, 
      message: "Error generating recommendation", 
      error: error.message 
    });
  }
});

// GET: History Rekomendasi
app.get("/api/recommendation/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const recommendations = await Recommendation.find().sort({ timestamp: -1 }).limit(limit);
    res.json({ success: true, data: recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching history", error: error.message });
  }
});

// DELETE: Hapus 1 History Rekomendasi
app.delete("/api/recommendation/:id", async (req, res) => {
  try {
    const rec = await Recommendation.findByIdAndDelete(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: "Recommendation not found" });
    res.json({ success: true, message: "Recommendation deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting recommendation", error: error.message });
  }
});

// POST: Simpan Hasil ML Manual (Endpoint khusus jika ada trigger eksternal)
app.post("/api/recommendation/ml", async (req, res) => {
  try {
    const { input, recommendations, reasons, tips, conversion_results } = req.body;
    if (!input) return res.status(400).json({ success: false, message: "Input data missing" });

    const convertedTargetPadi = convertTargetPadi(input.target_padi);
    const mlRecommendation = new Recommendation({
      input: { ...input, target_padi: convertedTargetPadi },
      recommendation: recommendations,
      reasons,
      tips,
      conversion_results,
    });

    await mlRecommendation.save();
    res.status(201).json({ success: true, message: "Saved successfully", data: mlRecommendation });
  } catch (error) {
    res.status(400).json({ success: false, message: "Error saving", error: error.message });
  }
});

// ------------------------------------------
// 5. UTILITY ENDPOINTS
// ------------------------------------------

// GET: Data Kalibrasi Terakhir (Untuk Auto-populate Form)
app.get("/api/latest/calibrated", async (req, res) => {
  try {
    const latestData = await CalibratedData.findOne().sort({ timestamp: -1 });
    if (!latestData) return res.status(404).json({ success: false, message: "No data found" });
    
    res.json({
      success: true,
      data: {
        P: latestData.variables.P,
        N: latestData.variables.N,
        K: latestData.variables.K,
        timestamp: latestData.timestamp,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching latest data", error: error.message });
  }
});

app.get("/api/data/calibrated/all", async (req, res) => {
  try {
    const calibratedData = await CalibratedData.find()
      .sort({ timestamp: -1 })
      .select("timestamp variables _id");

    res.json({ success: true, data: calibratedData });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Error fetching all calibrated data", 
      error: error.message 
    });
  }
});

// GET: Health Check
app.get("/api/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "API is running", 
    timestamp: new Date().toISOString() 
  });
});



// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
