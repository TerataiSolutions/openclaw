const mammoth = require('mammoth');
const cheerio = require('cheerio');

async function processPDF(buffer) {
 // Use pdf-parse if available, otherwise extract as plain text
 try {
 const pdfParse = await import('pdf-parse');
 const data = await pdfParse.default(buffer);
 return {
 text: data.text,
 sections: splitIntoSections(data.text),
 metadata: { pages: data.numpages, format: 'pdf' },
 format: 'pdf'
 };
 } catch (e) {
 return { text: buffer.toString(), sections: [], metadata: { format: 'pdf', error: 'pdf-parse unavailable' }, format: 'pdf' };
 }
}

async function processDOCX(buffer) {
 const result = await mammoth.extractRawText({ buffer });
 return {
 text: result.value,
 sections: splitIntoSections(result.value),
 metadata: { format: 'docx', warnings: result.messages },
 format: 'docx'
 };
}

async function processPPTX(buffer) {
 try {
 const JSZip = (await import('jszip')).default;
 const zip = await JSZip.loadAsync(buffer);
 const slides = [];
 const slideFiles = Object.keys(zip.files).filter(f => f.match(/ppt\/slides\/slide\d+\.xml/)).sort();
 for (let i = 0; i < slideFiles.length; i++) {
 const content = await zip.files[slideFiles[i]].async('string');
 const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
 slides.push({ slide: i + 1, text });
 }
 const fullText = slides.map(s => `[Slide ${s.slide}] ${s.text}`).join('\n');
 return { text: fullText, sections: slides.map(s => ({ title: `Slide ${s.slide}`, content: s.text })), metadata: { format: 'pptx', slide_count: slides.length }, format: 'pptx' };
 } catch (e) {
 return { text: '', sections: [], metadata: { format: 'pptx', error: e.message }, format: 'pptx' };
 }
}

async function processHTML(content) {
 const $ = cheerio.load(content);
 $('script, style').remove();
 const sections = [];
 $('h1, h2, h3, h4, h5, h6').each((i, el) => {
 const title = $(el).text().trim();
 const content = $(el).nextUntil('h1, h2, h3, h4, h5, h6').text().trim();
 if (title) sections.push({ title, content });
 });
 const text = $('body').text().replace(/\s+/g, ' ').trim();
 return { text, sections, metadata: { format: 'html' }, format: 'html' };
}

async function processFile(buffer, format) {
 const fmt = format.toLowerCase().replace('.', '');
 switch (fmt) {
 case 'pdf': return processPDF(buffer);
 case 'docx': return processDOCX(buffer);
 case 'pptx': return processPPTX(buffer);
 case 'html': return processHTML(buffer.toString());
 default: throw new Error(`Unsupported file format: ${format}`);
 }
}

function splitIntoSections(text) {
 return text.split(/\n{2,}/).filter(s => s.trim().length > 50).map((content, i) => ({ title: `Section ${i + 1}`, content: content.trim() }));
}

module.exports = { processPDF, processDOCX, processPPTX, processHTML, processFile };