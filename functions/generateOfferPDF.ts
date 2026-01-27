import { buildPDFHTML } from './pdfTemplateGenerator.js';

Deno.serve(async (req) => {
  try {
    const { documentData, lineItems, templateData } = await req.json();
    
    const puppeteer = (await import('npm:puppeteer')).default;
    let browser;
    
    try {
      browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      
      // Build unified HTML template
      const html = buildPDFHTML(documentData, lineItems, templateData);
      
      // Set content with print styling
      await page.setContent(html, { waitUntil: 'networkidle2' });
      
      // Generate PDF with proper A4 formatting
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false
      });
      
      await browser.close();
      
      // Convert to base64
      const base64PDF = pdfBuffer.toString('base64');
      
      return Response.json({
        success: true,
        pdf: `data:application/pdf;base64,${base64PDF}`,
        fileName: `${documentData.document_number || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`
      });
    } catch (error) {
      if (browser) await browser.close();
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 400 });
  }
});