import mongoose from 'mongoose'

const RemittanceSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  country: { type: String, default: '' },
  currency: { type: String, enum: ['AED','SAR','OMR','BHD',''], default: '' },
  amount: { type: Number, required: true, min: 0 },
  fromDate: { type: Date },
  toDate: { type: Date },
  totalDeliveredOrders: { type: Number, default: 0 },
  status: { type: String, enum: ['pending','accepted','rejected'], default: 'pending', index: true },
  acceptedAt: { type: Date },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, default: '' },
}, { timestamps: true })

export default mongoose.model('Remittance', RemittanceSchema)
