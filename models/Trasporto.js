
import mongoose from "mongoose";

const TrasportoSchema = new mongoose.Schema({
  f_: { type: Date }, // #
  cliente: { type: String }, // CLIENTE
  data: { type: String }, // DATA
  modello: { type: String }, // MODELLO
  targa: { type: String }, // TARGA
  regione_carico: { type: String }, // REGIONE CARICO
  carico: { type: String }, // CARICO
  scarico: { type: String }, // SCARICO
  pagamento: { type: String }, // PAGAMENTO
  autista_carico: { type: String }, // AUTISTA CARICO
  autista_scarico: { type: String }, // AUTISTA SCARICO
  indirizzo_ritiro: { type: String }, // INDIRIZZO RITIRO
  n_fattura: { type: String }, // n° FATTURA
  deposito: { type: String }, // DEPOSITO
  note: { type: String },
  rowColor: { type: String, default: "" },
}, { timestamps: true });

export default mongoose.model("Trasporto", TrasportoSchema);
