import mongoose from 'mongoose'

const AgentRemitSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  approverRole: { type: String, enum: ['user','manager'], required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'PKR' },
  note: { type: String, default: '' },
  status: { type: String, enum: ['pending','approved','sent'], default: 'pending', index: true },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentAt: { type: Date },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.model('AgentRemit', AgentRemitSchema)
