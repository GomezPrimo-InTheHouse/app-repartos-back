// server.js
const { app } = require('./src/app');
const { env } = require('./src/config/env');

app.listen(env.port, () => {
  console.log(`Servidor corriendo en puerto ${env.port} (${env.nodeEnv})`);
});