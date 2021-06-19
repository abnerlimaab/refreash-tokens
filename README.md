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