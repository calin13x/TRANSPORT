import mongoose from "mongoose";

const carSchema = new mongoose.Schema({
  tipoCliente: String,
  telefono: String,
  dataIncarico: String,
  dataConsegna: String,
  modelloAuto: String,
  targa: String,
  regioneCarico: String,
  paese: String,
  indirizzo: String,
  note: String,
  pagamento: String,
  autista_Carico: String,
  autistaS_carico: String,
  posizioneAuto: String,
}, { timestamps: true });

const Car = mongoose.model("Car", carSchema);
export default Car;
