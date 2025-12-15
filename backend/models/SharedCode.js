import mongoose from "mongoose";

const SharedCodeSchema = new mongoose.Schema({
  language: { type: String, required: true }, // "web", "cpp", "java", "python"
  
  // 'Mixed' type allows us to store either a String (C++) or an Object (HTML/CSS/JS)
  code: { type: mongoose.Schema.Types.Mixed, required: true }, 
  
  stdin: { type: String, default: "" }, // For C++ inputs
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("SharedCode", SharedCodeSchema);