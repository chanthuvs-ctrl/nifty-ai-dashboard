const fs = require('fs');

// Simple parser check
const tsContent = fs.readFileSync('clinic-app/src/constants/staffRegistry.ts', 'utf8');
console.log("Includes alchemy_ads in staffRegistry:", tsContent.includes('alchemy_ads'));

const loginContent = fs.readFileSync('clinic-app/src/components/Login.tsx', 'utf8');
console.log("Includes alchemy in Login.tsx:", loginContent.includes('alchemy'));

const indexContent = fs.readFileSync('clinic-app/index.html', 'utf8');
console.log("Includes inline auth in index.html:", indexContent.includes('alchemy_ads'));

