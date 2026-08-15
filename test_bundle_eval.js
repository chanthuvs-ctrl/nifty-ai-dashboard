const fs = require('fs');

try {
  const code = fs.readFileSync('clinic-app/dist/assets/index-BJuiByd2.js', 'utf8');
  console.log("Read JS bundle successfully. Length:", code.length);
  
  // Check for syntax errors by parsing as JS
  new Function(code);
  console.log("Bundle evaluated successfully without syntax error!");
} catch (e) {
  console.error("Syntax or evaluation error in JS bundle:", e);
}
