const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Caminho temporário para salvar o arquivo JSON (em tempo de execução)
const tempCredentialsPath = path.join(__dirname, '../temp-credentials.json');

if (!fs.existsSync(tempCredentialsPath)) {
  const credentialsString = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!credentialsString) {
    throw new Error('Credenciais do Google não encontradas na variável de ambiente GOOGLE_CREDENTIALS_JSON');
  }
  fs.writeFileSync(tempCredentialsPath, credentialsString);
}

// Autenticação com conta de serviço
const auth = new google.auth.GoogleAuth({
  keyFile: tempCredentialsPath,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const uploadToDrive = async (filePath, fileName, mimeType) => {
  const client = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: client });

  const fileMetadata = {
    name: fileName,
    parents: ['1Z8d6i1lA2vs7ex2FOyvqd4zSl08P2ZQe'], // ID da pasta no Drive
  };

  const media = {
    mimeType,
    body: fs.createReadStream(filePath),
  };

  try {
    const response = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id',
    });

    // Tornar o arquivo público
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const fileUrl = `https://drive.google.com/uc?id=${response.data.id}`;

    // ✅ Remover o arquivo local APÓS o upload e permissão concluídos
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Erro ao deletar arquivo local ${filePath}:`, err);
    });

    return fileUrl;
  } catch (err) {
    console.error('Erro no upload para o Google Drive:', err);
    throw err;
  }
};

module.exports = uploadToDrive;
