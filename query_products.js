const { getCliClient } = require('sanity/cli');
const client = getCliClient();

async function run() {
  try {
    const products = await client.fetch('*[_type == "product"]');
    const total = products.length;
    const hasDiscount = products.filter(p => p.discount !== undefined).length;
    const hasDescuento = products.filter(p => p.descuento !== undefined).length;
    const hasOffer = products.filter(p => p.offer !== undefined).length;
    const hasFixedDiscount = products.filter(p => (p.offer && p.offer.fixedDiscount !== undefined)).length;
    
    const sampleKeys = products.length > 0 ? Object.keys(products[0]) : [];

    console.log('--- Resumen de Productos ---');
    console.log('Total de productos:', total);
    console.log('Con campo "discount":', hasDiscount);
    console.log('Con campo "descuento":', hasDescuento);
    console.log('Con campo "offer":', hasOffer);
    console.log('Con campo "offer.fixedDiscount":', hasFixedDiscount);
    console.log('Ejemplo de claves de un producto:', sampleKeys.join(', '));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
run();
