import whatsappService from './src/modules/services/whatsapp.js';

async function testStatus() {
  try {
    const status = await whatsappService.getStatus();
    console.log('WhatsApp Status:', status);
    
    const connectedNumber = whatsappService.getConnectedNumber();
    console.log('Connected Number:', connectedNumber);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testStatus();