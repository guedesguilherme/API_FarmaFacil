const { google } = require('googleapis');
const stream = require('stream');
const fs = require('fs');
const path = require('path');

// Caminho temporário para credenciais (manter como estava)
const tempCredentialsPath = path.join(__dirname, '../temp-credentials.json');

if (!fs.existsSync(tempCredentialsPath)) {
  const credentialsString = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!credentialsString) {
    throw new Error('Credenciais do Google não encontradas na variável de ambiente GOOGLE_CREDENTIALS_JSON');
  }
  fs.writeFileSync(tempCredentialsPath, credentialsString);
}

const auth = new google.auth.GoogleAuth({
  keyFile: tempCredentialsPath,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

// ✅ Função modificada para aceitar buffer ou caminho de arquivo
const uploadToDrive = async (fileData, fileName, mimeType) => {
  const client = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: client });

  const fileMetadata = {
    name: fileName,
    parents: ['1Z8d6i1lA2vs7ex2FOyvqd4zSl08P2ZQe'],
  };

  let media;
  
  // Verifica se é um buffer
  if (Buffer.isBuffer(fileData)) {
    // Cria stream a partir do buffer
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileData);
    media = {
      mimeType,
      body: bufferStream
    };
  } 
  // Se for string (caminho de arquivo)
  else if (typeof fileData === 'string') {
    media = {
      mimeType,
      body: fs.createReadStream(fileData)
    };
  } 
  else {
    throw new Error('Tipo de dado inválido para upload');
  }

  const response = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id',
  });

  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return `https://drive.google.com/uc?id=${response.data.id}`;
};

module.exports = uploadToDrive;
