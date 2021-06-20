# Blog do código
> Uma API de blog em Node.js

### Controle de Acesso na API (Aula 3.1)

- Criamos o arquivo controleDeAcesso.js para o importe do módilo accesscontrol, definição de cargos e permissões.

~~~javascript
const AccessControl = require('accesscontrol')
const controle = new AccessControl()

controle.grant('assinante').read('post', ['id', 'titulo', 'conteudo', 'autor'])

module.exports = controle
~~~

- Ajustes no middleware autorizacao.js

~~~javascript
//Importamos o controleDeAcesso implementado anteriormente
const controle = require('../controleDeAcesso')

//A função que inicia o middleware passa a receber  entidade e acao como parametros
module.exports = (entidade, acao) => (requisicao, resposta, proximo) => {
    //Na const permissoesDoCargo, armazenamos os permissões definidas para o usuário da requisição
    const permissoesDoCargo = controle.can(requisicao.user.cargo)
    //Coletamos as ações executadas pela entidade e verificamos se tem permissão para tal.
    const permissao = permissoesDoCargo[acao](entidade)
    if (permissao.granted === false) {
        resposta.status(403)
        resposta.end()
        return
    }
    //Adicionamos o objeto acesso na requisição com as permissões atribuidas ao cargo.
    requisicao.acesso = {
        atributos: permissao.attributes
    }

    proximo()
}
~~~

- Ajustes em usuarios-rotas.js após o importer do controleDeAcesso

~~~javascript
  app
    .route('/usuario')
    .post(usuariosControlador.adiciona)
    //O método get utilizará a estratégia bearer para autenticação e passará a entidade e ação a ser executada no middleware de autorização. Só então, será retornada a lista de usuários criados
    .get(
      [middlewaresAutenticacao.bearer, autorizacao('usuario', 'readAny')],
      usuariosControlador.lista
    )
~~~

### Definindo cargos mais complexos (Aula 3.2)

- No arquivo controleDeAcesso, implementamos os cargos e definimos as permissões

~~~javascript
controle
    .grant('assinante')
    .readAny('post', ['id', 'titulo', 'conteudo', 'autor'])

controle
    .grant('editor')
    .extend('assinante')
    .createOwn('post')
    .deleteOwn('post')

controle
    .grant('admin')
    .createAny('post')
    .deleteAny('post')
    .readAny('usuario')
    .deleteAny('usuario')
~~~

- No arquivo autorizacao.js, implementamos um dicionário para concentrar as permissões.

~~~javascript
const metodos = {
    ler: {
        todos: 'readAny',
        apenasSeu: 'readOwn'
    },
    criar: {
        todos: 'createAny',
        apenasSeu: 'createOwn'
    },
    remover: {
        todos: 'deleteAny',
        apenasSeu: 'deleteOwn'
    }
}
~~~

- Criamos uma const para cada ação da entidade

~~~javascript
    const permissaoTodos = permissoesDoCargo[acoes.todos](entidade)
    const permisaoApenasSeu = permissoesDoCargo[acoes.apenasSeu](entidade)
~~~

- Atualizamos o teste de permissões concedidas

~~~javascript
if (permissaoTodos.granted === false && permisaoApenasSeu.granted === false)
~~~

- Atualizamos o objeto de acesso passado para requisição

~~~javascript
    requisicao.acesso = {
        todos: {
            permitido: permissaoTodos.granted,
            atributos: permissaoTodos.attributes
        },
        apenasSeu: {
            permitido: permisaoApenasSeu.granted,
            atributos: permisaoApenasSeu.attributes
        },
        atributos: permissao.attributes
    }
~~~

- Atualizamos as rotas dos posts para utilização do middleware de autorização

### Controlando Acesso nas rotas (Aula 3.3)

- Implementamos o middleware tentarAutenticar

~~~javascript
module.exports = (requisicao, resposta, proximo) => {
    //Adicionamos o atributo estaAutenticado na requisição e o iniciamos com false
    requisicao.estaAutenticado = false
    //Verificamos se há o parâmetro Authorization na requisição
    if (requisicao.get('Authorization')) {
        //para entçao chamarmos bearer do middlewaresAutenticacao
        return middlewaresAutenticacao.bearer(requisicao, resposta, proximo)
    }
    proximo()
}
~~~

- Ajustamos os middlewares de autenticação local e bearer para que atualizem o status de estaAutenticado como true após o processo de autenticação

- Implementamos o middleware tentarAutorizar

~~~javascript
//Estamos exportando uma função que recebe a entidade e ação como parâmetros e então executa o middleware
module.exports = (entidade, acao) => (requisicao, resposta, proximo) => {
    //Verificamos se o usuário da requisição está autenticado
    if (requisicao.estaAutenticado === true) {
        //Para então chamarmos o middleware de autorizacao
        return autorizacao(entidade, acao)(requisicao, resposta, proximo)
    }
    //Caso o usuário não esteja autenticado, seguiremos para o próximo middleware
    proximo()
}
~~~

- Atualizamos a query do método dbAll no método listarTodos de posts-dao com a adição dos campos conteudo e autor

~~~sql
SELECT id, titulo, conteudo, autor FROM posts
~~~

- Atualizações no método lista em posts-controlador

~~~javascript
async lista (req, res) {
try {
    //transformamos a const posts para let que agora recebe o retorno de listaTodos do nosso modelo
    let posts = await Post.listaTodos()
    //Realizamos o teste lógico verificando se o usuário da requisição está autenticado
    if (req.estaAutenticado === true) {
        //E então criamos um mapa em posts com o retorno de listaTodos
        posts = posts.map(post => ({
            titulo: post.titulo,
            conteudo: post.conteudo
        }))
    }
}
~~~

- Importamos os middlewares tentarAutenticar e tentarAutorizar em posts- rotas

~~~javascript
const tentarAutenticar = require('../middlewares/tentarAutenticar')
const tentarAutorizar = require('../middlewares/tentarAutorizar')
~~~

- E passamos a utilizá-los na rota de post que lista os posts

~~~javascript
    .route('/post')
    .get(
      [tentarAutenticar, tentarAutorizar('post', 'ler')],
      postsControlador.lista
    )
~~~

### Confirmando ações perigosas (Aula 4.1)

- Adicionamos o middleware de autenticação local na rota delete de posts como uma camada adicional de segurança

~~~javascript
  app.route('/post/:id')
      .delete([
        //Valida o token
        middlewaresAutenticacao.bearer,
        //Valida informações de login
        middlewaresAutenticacao.local,
        //Valida permissões
        autorizacao(['post', 'remover'])
    ],
      postsControlador.remover
    )
~~~

- Realizamos o mesmo procedimento na rota delete de usuários

~~~javascript
  app.route('/usuario/:id')
     .delete([
      middlewaresAutenticacao.bearer, 
      middlewaresAutenticacao.local, 
      autorizacao('usuario', 'remover')
    ],
    usuariosControlador.deleta)
~~~

### Middleware de tratamento de erros (Aula 4.2)

- Implementamos o middleware de tratamento de erro no server.js

~~~javascript
//Para que o express o reconheça como middleware de tratamento de erro, devemos adicionar erro como primeiro parâmetro
app.use((erro, requisicao, resposta, proximo) => {
    //Definimos o status padrão de resposta e o ajustaremos conforme o erro recebido
    let status = 500
    //Definimos o corpo padrão da resposta e o ajustaremos conforme o erro recebido
    const corpo = {
        mensagem: erro.message
    }
    //Neste if capturamos erros da classe InvalidArgumentError
    if (erro instanceof InvalidArgumentError) {
        status = 400
    }
    //Neste if capturamos erros da classe JsonWebTokenError
    if (erro instanceof jwt.JsonWebTokenError) {
        status = 401
    }
    //Neste if capturamos erros da classe TokenExpiredError
    if (erro instanceof jwt.TokenExpiredError) {
        status = 401
        corpo.expiradoEm = erro.expiredAt
    }
    //Após os testes lógicos, enviamos a resposta para o cliente
    resposta.status(status)
    resposta.json(corpo)
})
~~~

- Ajustamos os catches de usuarios-controlador e middlewares-autenticação para que passem a utilizar nosso novo middleware, dessa forma concentramos a responsabilidade em um único middleware

### Erros customizados (Aula 4.3)

- Criamos as classes NaoEncontrado e NaoAutorizado e extendemos a classe Error

~~~javascript
class NaoEncontrado extends Error {
  constructor (entidade) {
    const mensagem = `Não foi possível encontrar ${entidade}`
    super(mensagem)
    this.name = 'NaoEncontrado'
  }
}

class NaoAutorizado extends Error {
  constructor () {
    const mensagem = `Não foi possível acessar esse recurso`
    super(mensagem)
    this.name = 'NaoAutorizado'
  }
}
~~~

- Passamos a utilizar NaoEncontrado na passagem de erros do model de usuários nos métodos buscaPorId e buscaPorEmail

- Passamos a utilizar NaoAutorizado na passagem de erros da estratégia de autenticação nas funções verificaUsuario e verificaSenha

- Adicionamos os testes lógicos para tratamento dos erros customizados em nosso middleware de tratamento de erros

~~~javascript
    if (erro instanceof NaoEncontrado) {
        status = 404
    }

    if (erro instanceof NaoAutorizado) {
        status = 401
    }
~~~