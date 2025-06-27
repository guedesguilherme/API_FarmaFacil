const router = require('express').Router()
const Produtos = require('../models/Produtos')
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const uploadToDrive = require('../utils/googleDrive');

// 🔥 Detecta se está no Azure App Service
const isAzure = process.env.WEBSITE_INSTANCE_ID !== undefined;

// Define o caminho para uploads
const uploadPath = isAzure 
  ? '/tmp/uploads' 
  : path.join(__dirname, '..', 'uploads');

// Garante que o diretório de upload existe
if (!fs.existsSync(uploadPath)) {
  try {
    fs.mkdirSync(uploadPath, { recursive: true });
    console.log(`Diretório de upload criado: ${uploadPath}`);
  } catch (err) {
    console.error(`Erro ao criar diretório de upload: ${uploadPath}`, err);
    // Em produção, você pode querer tratar isso de forma mais rigorosa
  }
}

// ✅ Configuração do multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

//Acessando todos os produtos:
router.get("/", async (req, res) => {

    try {
        const produtos = await Produtos.find().populate('farmacia', 'nome')
        if (produtos.length === 0){
            return res.status(404).json({ msg: 'Não há produtos cadastrados' });
        }

        res.status(200).json(produtos)
        
    } catch (error) {
        res.status(500).json({error: error})
    }

})


router.get("/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const produto = await Produtos.findById(id).populate("farmacia", "nome cep");

    if (!produto) {
      return res.status(404).json({ msg: "Produto inexistente" });
    }

    res.status(200).json({ produto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Erro no servidor" });
  }
});


router.get('/farmacia/:farmaciaId', async (req, res) => {
    try {
      const farmaciaId = req.params.farmaciaId;
      
      // Buscar os produtos que pertencem à farmácia com o id fornecido
      const produtos = await Produtos.find({ 'farmacia': farmaciaId });
  
      // Verificar se encontramos produtos
      if (produtos.length === 0) {
        return res.status(404).json({ message: 'Nenhum produto encontrado para esta farmácia.' });
      }
  
      // Retornar os produtos encontrados
      res.json(produtos);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erro ao buscar produtos' });
    }
  });


//Registrar o produto:
router.post("/auth/register", upload.single('imagem'), async(req, res) => {

    const{farmacia, nome, nome_quimico, preco, quantidade, validade, lote, label} = req.body

    //Validações:
    if (!farmacia){
        return res.status(422).json({msg: "O id da farmácia é obrigatório!"})
    }

    if (!nome){
        return res.status(422).json({msg: "O nome do produto é obrigatório!"})
    }

    if (!nome_quimico){
        return res.status(422).json({msg: "O nome químico do produto é obrigatório!"})
    }

    if (!preco){
        return res.status(422).json({msg: "O preço do produto é obrigatório!"})
    }

    if (!quantidade){
        return res.status(422).json({msg: "A quantidade do produto é obrigatória!"})
    }

    if (!validade){
        return res.status(422).json({msg: "A validade do produto é obrigatória!"})
    }

    if (!lote){
        return res.status(422).json({msg: "O lote do produto é obrigatório!"})
    }

    if (!label){
        return res.status(422).json({msg: "O rótulo do produto é obrigatório!"})
    }

    if (!req.file) return res.status(422).json({ msg: 'Imagem é obrigatória' });
    

    try {

        console.log(`Tentando fazer upload do arquivo: ${req.file.path}`);

        const imagem_url = await uploadToDrive(req.file.path, req.file.originalname, req.file.mimetype)

        const produto = new Produtos({
            farmacia,
            nome,
            nome_quimico,
            preco,
            quantidade,
            validade,
            lote,
            label,
            imagem_url
        })

        await produto.save()


        res.status(201).json({msg: "Produto cadastrado com sucesso!"})
    } catch (error) {
        console.log(error)
        res.status(500).json({msg:"Algo deu errado. Tente novamente mais tarde!"})
    }  } finally {
        // Remove o arquivo temporário se existir
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
                console.log(`Arquivo temporário removido: ${req.file.path}`);
            } catch (err) {
                console.error('Erro ao remover arquivo temporário:', err);
            }
        }
    }
});


//Atualiza dados do Produto
router.patch('/:id', upload.single('imagem'), async (req, res) => {

    const id = req.params.id
    const {farmacia, nome, nome_quimico, preco, quantidade, validade, lote, label} = req.body

    try {
        const produtoExistente = await Produtos.findById(id)

        if (!produtoExistente) {
            return res.status(404).json({ msg: "Produto não encontrado" })
        }

        let imagem_url = produtoExistente.imagem_url // mantém a imagem antiga caso ela exista

        //caso uma nova imagem tenha sido enviada
        if (req.file) {
            try {
                imagem_url = await uploadToDrive(req.file.path, req.file.originalname, req.file.mimetype)
            } catch (err) {
                console.error('Erro ao fazer upload da nova imagem:', err)
                return res.status(500).json({ msg: 'Erro ao atualizar imagem' })
            } finally {
                try {
                    if (req.file.path) {
                        fs.unlinkSync(req.file.path) // remove imagem temporária local
                    }
                } catch (err) {
                    console.error('Erro ao deletar imagem temporária:', err);
                }
            }
        }

        const produtoUpdated = await Produtos.findByIdAndUpdate(id, {nome, nome_quimico, preco, quantidade, validade, lote, label, imagem_url})

        res.status(200).json({msg: "Atualizado com sucesso"})
        
    } catch (error) {
        res.status(500).json({msg: error})
    }

})

//Deleta produtos
router.delete('/:id', async (req, res) => {

    const id = req.params.id

    //verifica se o produto existe
    const product = await Produtos.findById(id)

    if (!product){
        return res.status(404).json({msg: "Produto inexistente!"})
    }

    try {
        
        await Produtos.findByIdAndDelete(id)
        res.status(200).json({msg: "Produto excluído com sucesso!"})
        
    } catch (error) {
        res.status(500).json({msg: "Algo deu errado. Tenta novamente mais tarde!"})
    }

})


module.exports = router
