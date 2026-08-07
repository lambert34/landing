import { loadConfig } from '@g64/config';
const config = loadConfig();
console.log(JSON.stringify({ service: 'g64-worker', status: 'healthy', environment: config.NODE_ENV, message: 'Worker ready; no background tasks configured.' }));
