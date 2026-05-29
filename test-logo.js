const fs = require('fs');
const path = require('path');
console.log('Exists:', fs.existsSync(path.join(process.cwd(), 'public', 'logo.png')));
